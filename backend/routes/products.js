import express from "express";
import supabase from "../config/supabase.js";

const router = express.Router();

// Gets all the products
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("product").select("*");

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

// Route to fetch a product by product_id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("product")
    .select("*")
    .eq("product_id", id)
    .single();

  if (error) return res.status(404).json({ error: "Product not found" });

  res.json(data);
});

// Logic for updating stock on admin page
router.post("/:id/update-stock", async (req, res) => {
  const { id } = req.params;
  const { change } = req.body;

  // Get current stock
  const { data: product, error: fetchError } = await supabase
    .from("product")
    .select("stock_quantity")
    .eq("product_id", id)
    .maybeSingle();

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const newStock = Math.max(0, product.stock_quantity + change); // prevent negative stock

  const { error: updateError } = await supabase
    .from("product")
    .update({ stock_quantity: newStock })
    .eq("product_id", id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  res.json({ message: "Stock updated", stock_quantity: newStock });
});

export default router;
