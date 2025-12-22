const mongoose = require("mongoose");

const readingCompletionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadingPlanDay",
      required: true,
      index: true,
    },
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      required: true,
    },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

readingCompletionSchema.index(
  { userId: 1, dayId: 1 },
  { unique: true }
);

module.exports = mongoose.model("ReadingCompletion", readingCompletionSchema);
