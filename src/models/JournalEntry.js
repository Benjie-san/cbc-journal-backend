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
        tags: {
            type: [String],
            default: [],
        },
        clientId: {
            type: String,
        },

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
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

journalEntrySchema.index({ userId: 1, deleted: 1, createdAt: -1 });
journalEntrySchema.index({ userId: 1, deleted: 1, deletedAt: -1 });
journalEntrySchema.index(
    { userId: 1, clientId: 1 },
    { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
);

module.exports = mongoose.model("JournalEntry", journalEntrySchema);
