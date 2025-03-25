require("dotenv").config();
const express = require("express");
const cors = require("cors");
const blockchainRoutes = require("./src/routes/blockchainRoutes.js");

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/blockchain", blockchainRoutes);
app.use("/", (req, res) => res.send("Hello from Blockchain Config Backend!"));

const PORT = process.env.PORT || 6666;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
