const mongoose = require("mongoose");

const journalEntrySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },

        title: String,
        scriptureRef: String,

        content: {
            question: { type: String, default: "" },
            observation: { type: String, default: "" },
            application: { type: String, default: "" },
            prayer: { type: String, default: "" },
        },

        version: {
            type: Number,
            default: 1,
            index: true,
        },

        deleted: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("JournalEntry", journalEntrySchema);
