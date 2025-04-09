import express from "express";
import supabase from "../config/supabase.js";
const router = express.Router();

// Add to cart 1 
router.post("/add", async (req, res) => {
  const { session_id, product_id } = req.body;

  const { data: existingItem, error: fetchError } = await supabase
    .from("cart")
    .select("*")
    .eq("session_id", session_id)
    .eq("product_id", product_id)
    .maybeSingle();

  if (fetchError) return res.status(500).json({ error: fetchError.message });

  if (existingItem) {
    const { data, error } = await supabase
      .from("cart")
      .update({ product_quantity: existingItem.product_quantity + 1 })
      .eq("session_id", session_id)
      .eq("product_id", product_id);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ message: "Cart updated", data });
  }

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

// Remove from cart
router.post("/remove", async (req, res) => {
  const { session_id, product_id } = req.body;

  const { data: existingCartItem, error: fetchError } = await supabase
    .from("cart")
    .select("*")
    .eq("session_id", session_id)
    .eq("product_id", product_id)
    .single();

  if (fetchError) return res.status(500).json({ error: fetchError.message });

  if (!existingCartItem) {
    return res.status(404).json({ error: "Item not found in cart" });
  }

  if (existingCartItem.product_quantity > 1) {
    const { error: updateError } = await supabase
      .from("cart")
      .update({ product_quantity: existingCartItem.product_quantity - 1 })
      .eq("session_id", session_id)
      .eq("product_id", product_id);

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(200).json({ message: "Quantity decreased" });
  } else {
    const { error: deleteError } = await supabase
      .from("cart")
      .delete()
      .eq("session_id", session_id)
      .eq("product_id", product_id);

    if (deleteError) return res.status(500).json({ error: deleteError.message });
    return res.status(200).json({ message: "Item removed from cart" });
  }
});

// Get cart by session ID with product name and price only
router.get("/:session_id", async (req, res) => {
  const { session_id } = req.params;

  const { data, error } = await supabase
    .from("cart")
    .select("product_id, product_quantity, product(name, price)")
    .eq("session_id", session_id);

  if (error) return res.status(500).json({ error: error.message });

  const cartWithDetails = data.map(item => ({
    product_id: item.product_id,
    product_quantity: item.product_quantity,
    name: item.product.name,
    price: item.product.price,
  }));

  res.json(cartWithDetails);
});

export default router;
