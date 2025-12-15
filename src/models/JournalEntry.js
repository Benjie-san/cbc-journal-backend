const mongoose = require("mongoose");

const journalEntrySchema = new mongoose.Schema(
    {
    userId: {
      type: mongoose.Schema.Types.ObjectId, // recommended
        ref: "User",
        required: true,
        index: true,
    },

    title: { type: String, default: "" },
    scriptureRef: { type: String, default: "" },

    content: {
        question: { type: String, default: "" },
        observation: { type: String, default: "" },
        application: { type: String, default: "" },
        prayer: { type: String, default: "" },
    },

    tags: [{ type: String }],

    deleted: { type: Boolean, default: false }, // soft delete
    deletedAt: { type: Date, default: null },   // recycle bin support
    },
    { timestamps: true }
);

module.exports = mongoose.model("JournalEntry", journalEntrySchema);
