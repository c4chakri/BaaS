const express = require("express");
const router = express.Router();
const blockchainController = require("../controllers/blockchainController");

// Route to create a blockchain
router.post("/create", blockchainController.createBlockchain);

module.exports = router;
