const express = require("express");
const admin = require("../firebaseAdmin");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const jwtAuth = require("../middleware/jwtAuth");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
        return res.status(400).json({ error: "Missing idToken" });
        }

        // 1️⃣ Verify Firebase token
        const decoded = await admin.auth().verifyIdToken(idToken, true);

        // 2️⃣ Sync user to MongoDB
        let user;
        try {
        user = await User.findOneAndUpdate(
            { firebaseUid: decoded.uid },
            {
            $setOnInsert: {
                firebaseUid: decoded.uid,
                role: "user",
            },
            $set: {
                email: decoded.email || null,
                phoneNumber: decoded.phone_number || null,
            },
            },
            { new: true, upsert: true }
        );
        } catch (err) {
        if (err?.code === 11000) {
            user = await User.findOne({ firebaseUid: decoded.uid });
        } else {
            throw err;
        }
        }

        // 3️⃣ Issue backend JWT (optional but recommended)
        const backendToken = jwt.sign(
            {
                userId: user._id,
                role: user.role,
                tokenVersion: Number(user.tokenVersion ?? 0),
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
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

router.post("/revoke", jwtAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await admin.auth().revokeRefreshTokens(user.firebaseUid);
        user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
        await user.save();

        return res.json({ success: true });
    } catch (err) {
        console.error("Revoke error:", err.message);
        return res.status(500).json({ error: "Failed to revoke sessions" });
    }
});

module.exports = router;
