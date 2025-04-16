import express from "express";
import cors from "cors";
import productRoutes from "./routes/products.js";
import cartRoutes from "./routes/cart.js";

const app = express();
const PORT = 4000;

// allow frontend to talk to backend
app.use(cors());

// let backend accept JSON
app.use(express.json());

// connect product and cart routes
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

// start the server
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
