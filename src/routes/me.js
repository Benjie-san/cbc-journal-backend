const express = require("express");
const jwtAuth = require("../middleware/jwtAuth");
const User = require("../models/User");

const router = express.Router();

router.use(jwtAuth);

router.get("/", async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
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
        const user = await User.findById(req.user.userId);

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
