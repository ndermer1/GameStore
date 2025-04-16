import express from "express";
import supabase from "../config/supabase.js";

const router = express.Router();

// Get all products (used to display everything on the store pages)
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("product").select("*");

  if (error) return res.status(500).json({ error: error.message });

  res.json(data); // send back list of all products
});

// Get a specific product by ID (used to fetch updated price/stock)
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("product")
    .select("*")
    .eq("product_id", id)
    .single();

  if (error) return res.status(404).json({ error: "Product not found" });

  res.json(data); // send back product info
});

// Admin route — updates stock for a product based on button clicks
router.post("/:id/update-stock", async (req, res) => {
  const { id } = req.params;
  const { change } = req.body; // either +1 or -1

  // get current stock first
  const { data: product, error: fetchError } = await supabase
    .from("product")
    .select("stock_quantity")
    .eq("product_id", id)
    .maybeSingle();

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!product) return res.status(404).json({ error: "Product not found" });

  // prevent stock from going below 0
  const newStock = Math.max(0, product.stock_quantity + change);

  // update the product’s stock in the DB
  const { error: updateError } = await supabase
    .from("product")
    .update({ stock_quantity: newStock })
    .eq("product_id", id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  res.json({ message: "Stock updated", stock_quantity: newStock });
});

export default router;
