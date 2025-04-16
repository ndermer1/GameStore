import express from "express";
import supabase from "../config/supabase.js";
const router = express.Router();

// Adds product to cart. If it's already there, increase quantity
router.post("/add", async (req, res) => {
  const { session_id, product_id } = req.body;

  // Check if item already exists in cart
  const { data: existingItem, error: fetchError } = await supabase
    .from("cart")
    .select("*")
    .eq("session_id", session_id)
    .eq("product_id", product_id)
    .maybeSingle();

  if (fetchError) return res.status(500).json({ error: fetchError.message });

  // If it’s already in cart, just increment quantity
  if (existingItem) {
    const { data, error } = await supabase
      .from("cart")
      .update({ product_quantity: existingItem.product_quantity + 1 })
      .eq("session_id", session_id)
      .eq("product_id", product_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ message: "Cart updated", data });
  }

  // If not in cart, insert as new item
  const { data, error } = await supabase.from("cart").insert([
    {
      session_id,
      product_id,
      product_quantity: 1,
    },
  ]);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Item added to cart", data });
});

// Removes product from cart or decreases quantity
router.post("/remove", async (req, res) => {
  const { session_id, product_id } = req.body;

  const { data: existingCartItem, error: fetchError } = await supabase
    .from("cart")
    .select("*")
    .eq("session_id", session_id)
    .eq("product_id", product_id)
    .single();

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!existingCartItem) return res.status(404).json({ error: "Item not found in cart" });

  // If there's more than 1, just lower the quantity
  if (existingCartItem.product_quantity > 1) {
    const { error: updateError } = await supabase
      .from("cart")
      .update({ product_quantity: existingCartItem.product_quantity - 1 })
      .eq("session_id", session_id)
      .eq("product_id", product_id);

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(200).json({ message: "Quantity decreased" });
  } else {
    // If only 1 left, remove the product from cart
    const { error: deleteError } = await supabase
      .from("cart")
      .delete()
      .eq("session_id", session_id)
      .eq("product_id", product_id);

    if (deleteError) return res.status(500).json({ error: deleteError.message });
    return res.status(200).json({ message: "Item removed from cart" });
  }
});

// Fetches all products in user’s cart
router.get("/:session_id", async (req, res) => {
  const { session_id } = req.params;

  // Join cart with product table to get product details
  const { data, error } = await supabase
    .from("cart")
    .select("product_id, product_quantity, product(name, price)")
    .eq("session_id", session_id);

  if (error) return res.status(500).json({ error: error.message });

  // Cleaned up cart data to send to frontend
  const cartWithDetails = data.map(item => ({
    product_id: item.product_id,
    product_quantity: item.product_quantity,
    name: item.product.name,
    price: item.product.price,
  }));

  res.json(cartWithDetails);
});

// Associates a phone number to a session for loyalty points
router.post("/link-phone", async (req, res) => {
  const { session_id, phone } = req.body;

  // Check if phone already exists in customer table
  const { data: existingCustomer, error: fetchError } = await supabase
    .from("customer")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (fetchError) return res.status(500).json({ error: fetchError.message });

  // If phone not found, add new customer with 0 points
  if (!existingCustomer) {
    const { error: insertError } = await supabase
      .from("customer")
      .insert([{ phone, reward_points: 0 }]);

    if (insertError) return res.status(500).json({ error: insertError.message });
  }

  res.json({ message: "Phone linked (or already exists)" });
});

// Gets current reward points for a customer
router.get("/customer/:phone", async (req, res) => {
  const { phone } = req.params;

  const { data, error } = await supabase
    .from("customer")
    .select("reward_points")
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: "Customer not found" });

  res.json(data);
});

// Checkout route - handles payment, updates stock, calculates points
router.post("/checkout", async (req, res) => {
  const { session_id, phone, name, card_number, cvv, exp_date, redeem_points = 0 } = req.body;

  // Get all cart items with product info
  const { data: cartItems, error: cartError } = await supabase
    .from("cart")
    .select("product_id, product_quantity, product(name, price, stock_quantity)")
    .eq("session_id", session_id);

  if (cartError) return res.status(500).json({ error: cartError.message });
  if (!cartItems || cartItems.length === 0)
    return res.status(400).json({ error: "Cart is empty. Cannot checkout." });

  let total = 0;

  // Check stock and calculate total
  for (const item of cartItems) {
    if (item.product_quantity > item.product.stock_quantity) {
      return res.status(400).json({
        error: `Not enough stock for ${item.product.name}. Only ${item.product.stock_quantity} left.`,
      });
    }
    total += item.product_quantity * item.product.price;
  }

  const pointsEarned = Math.floor(total);
  const redeemableDollars = Math.floor(redeem_points / 100);
  const finalTotal = Math.max(total - redeemableDollars, 0);

  // Save card info & use upsert to allow use of same CC
  const { error: paymentError } = await supabase
    .from("payment")
    .upsert([{ card_number, name, cvv, exp_date }],
      {onConflict: "card_number"});

  if (paymentError) return res.status(500).json({ error: paymentError.message });

  // Save order details
  const { error: orderError } = await supabase
    .from("order")
    .insert([{ phone, session_id, total_amount: finalTotal }]);

  if (orderError) return res.status(500).json({ error: orderError.message });

  // Get current points, update with earned/redeemed
  const { data: customer, error: customerError } = await supabase
    .from("customer")
    .select("reward_points")
    .eq("phone", phone)
    .maybeSingle();

  if (customerError) return res.status(500).json({ error: customerError.message });

  const newPoints = (customer?.reward_points || 0) - (redeemableDollars * 100) + pointsEarned;

  // Update customer with new points
  const { error: pointsError } = await supabase
    .from("customer")
    .upsert({ phone, reward_points: newPoints }, { onConflict: "phone" });

  if (pointsError) return res.status(500).json({ error: pointsError.message });

  // Decrease stock for each product
  for (const item of cartItems) {
    const newStock = item.product.stock_quantity - item.product_quantity;
    const { error: stockError } = await supabase
      .from("product")
      .update({ stock_quantity: newStock })
      .eq("product_id", item.product_id);

    if (stockError) return res.status(500).json({ error: stockError.message });
  }

  // Clear cart
  const { error: clearError } = await supabase
    .from("cart")
    .delete()
    .eq("session_id", session_id);

  if (clearError) return res.status(500).json({ error: clearError.message });

  res.json({
    message: "Checkout complete",
    final_total: finalTotal.toFixed(2),
    points_earned: pointsEarned,
  });
});

export default router;
