const mongoose = require("mongoose");

const journalVersionSchema = new mongoose.Schema({
    journalId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
    },

    version: {
        type: Number,
        required: true,
    },

    snapshot: {
        type: Object,
        required: true,
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

journalVersionSchema.index({ journalId: 1, version: 1 }, { unique: true });
journalVersionSchema.index({ journalId: 1, createdAt: -1 });

module.exports = mongoose.model("JournalVersion", journalVersionSchema);
