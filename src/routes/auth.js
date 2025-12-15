const express = require("express");
const admin = require("../firebaseAdmin");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
        return res.status(400).json({ error: "Missing idToken" });
        }

        // 1️⃣ Verify Firebase token
        const decoded = await admin.auth().verifyIdToken(idToken);

        // 2️⃣ Sync user to MongoDB
        let user = await User.findOne({ firebaseUid: decoded.uid });

        if (!user) {
        user = await User.create({
            firebaseUid: decoded.uid,
            email: decoded.email || null,
            phoneNumber: decoded.phone_number || null,
            provider: decoded.firebase.sign_in_provider,
            role: "user",
        });
        }

        // 3️⃣ Issue backend JWT (optional but recommended)
        const backendToken = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
        );
        console.log("JWT GENERATED:", backendToken);
        console.log("BACKEND JWT SECRET:", process.env.JWT_SECRET);


        res.json({
        token: backendToken,
        user: {
            id: user._id,
            email: user.email,
            role: user.role,
        },
        });

    } catch (err) {
        console.error("Auth sync error:", err.message);
        res.status(401).json({ error: "Invalid Firebase token" });
    }
});

module.exports = router;
