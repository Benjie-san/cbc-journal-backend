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
            currentStreak: user.currentStreak ?? 0,
            longestStreak: user.longestStreak ?? 0,
            lastJournalDate: user.lastJournalDate ?? null,
        });

    } catch (err) {
        console.error("ME route error:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
});

router.post("/streak", async (req, res) => {
    try {
        const header = req.headers.authorization || "";
        const [type, token] = header.split(" ");

        if (type !== "Bearer" || !token) {
            return res.status(401).json({ error: "Missing token" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const currentStreak = Number(req.body?.currentStreak ?? 0);
        const longestStreak = Number(req.body?.longestStreak ?? 0);
        const lastJournalDate = req.body?.lastJournalDate ?? null;

        user.currentStreak = Number.isFinite(currentStreak) ? currentStreak : 0;
        user.longestStreak = Number.isFinite(longestStreak) ? longestStreak : 0;
        user.lastJournalDate = lastJournalDate || null;
        await user.save();

        return res.json({
            currentStreak: user.currentStreak,
            longestStreak: user.longestStreak,
            lastJournalDate: user.lastJournalDate,
        });
    } catch (err) {
        console.error("Streak update error:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
});

module.exports = router;
