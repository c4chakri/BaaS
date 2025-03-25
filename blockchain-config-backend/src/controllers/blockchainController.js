const blockchainService = require("../services/blockchainService.js");

exports.createBlockchain = async (req, res) => {
    try {
        console.log("Received request to create blockchain:");
        
        const result = await blockchainService.createBlockchain(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error creating blockchain", error: error.message });
    }
};
