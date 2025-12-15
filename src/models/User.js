// src/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        firebaseUid: { type: String, required: true, unique: true },
        email: { type: String },
        phoneNumber: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
