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

export default router;
