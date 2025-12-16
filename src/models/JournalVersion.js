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

module.exports = mongoose.model("JournalVersion", journalVersionSchema);
