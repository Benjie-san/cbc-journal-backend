const mongoose = require("mongoose");

const readingPlanDaySchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    month: { type: String, required: true, index: true },
    date: { type: Number, required: true, index: true },
    order: { type: Number, required: true, index: true },
    verse: { type: String, required: true },
    isSermonNotes: { type: Boolean, default: false },
  },
  { timestamps: true }
);

readingPlanDaySchema.index({ year: 1, month: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("ReadingPlanDay", readingPlanDaySchema);
