const express = require("express");
const mongoose = require("mongoose");
const ReadingPlanDay = require("../models/ReadingPlanDay");
const ReadingCompletion = require("../models/ReadingCompletion");
const JournalEntry = require("../models/JournalEntry");
const jwtAuth = require("../middleware/jwtAuth");

const router = express.Router();

router.use(jwtAuth);

router.get("/:year/:month", async (req, res) => {
  try {
    const year = Number(req.params.year);
    const month = req.params.month;

    if (!year || Number.isNaN(year)) {
      return res.status(400).json({ error: "Invalid year" });
    }

    const days = await ReadingPlanDay.find({ year, month }).sort({ order: 1 });
    if (!days.length) {
      return res.json([]);
    }

    const dayIds = days.map((day) => day._id);
    const completions = await ReadingCompletion.find({
      userId: req.user.userId,
      dayId: { $in: dayIds },
    });

    const completionByDay = new Map(
      completions.map((completion) => [
        completion.dayId.toString(),
        completion,
      ])
    );

    const response = days.map((day) => {
      const completion = completionByDay.get(day._id.toString());
      return {
        ...day.toObject(),
        completed: completion?.completed ?? false,
        completedAt: completion?.completedAt ?? null,
        journalEntryId: completion?.journalEntryId ?? null,
      };
    });

    return res.json(response);
  } catch (err) {
    console.error("Reading plan load error:", err);
    return res.status(500).json({ error: "Failed to load reading plan" });
  }
});

router.post("/:dayId/complete", async (req, res) => {
  try {
    const { dayId } = req.params;
    const { journalEntryId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dayId)) {
      return res.status(400).json({ error: "Invalid dayId" });
    }
    if (!mongoose.Types.ObjectId.isValid(journalEntryId)) {
      return res.status(400).json({ error: "Invalid journalEntryId" });
    }

    const day = await ReadingPlanDay.findById(dayId);
    if (!day) {
      return res.status(404).json({ error: "Reading plan day not found" });
    }

    const entry = await JournalEntry.findOne({
      _id: journalEntryId,
      userId: req.user.userId,
    });
    if (!entry) {
      return res.status(404).json({ error: "Journal entry not found" });
    }

    const completion = await ReadingCompletion.findOneAndUpdate(
      { userId: req.user.userId, dayId: day._id },
      {
        $set: {
          completed: true,
          completedAt: new Date(),
          journalEntryId,
        },
      },
      { new: true, upsert: true }
    );

    return res.json(completion);
  } catch (err) {
    console.error("Reading plan completion error:", err);
    return res.status(500).json({ error: "Failed to complete reading plan day" });
  }
});

module.exports = router;
