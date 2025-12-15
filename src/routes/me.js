const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const header = req.headers.authorization || "";
        const [type, token] = header.split(" ");

        console.log("ME ROUTE HEADER:", header);

        if (type !== "Bearer" || !token) {
            return res.status(401).json({ error: "Missing token" });
        }

        // Verify BACKEND token (NOT Firebase token)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);
        console.log("AUTH HEADER:", req.headers.authorization);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.json({
            id: user._id,
            email: user.email,
            role: user.role,
            firebaseUid: user.firebaseUid,
        });

    } catch (err) {
        console.error("ME route error:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
});

module.exports = router;
