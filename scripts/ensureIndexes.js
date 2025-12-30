require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../src/db");

const JournalEntry = require("../src/models/JournalEntry");
const JournalVersion = require("../src/models/JournalVersion");
const ReadingCompletion = require("../src/models/ReadingCompletion");
const ReadingPlanDay = require("../src/models/ReadingPlanDay");
const User = require("../src/models/User");

async function syncIndexes(model, name) {
  const result = await model.syncIndexes();
  console.log(`${name} indexes synced`, result);
}

(async () => {
  try {
    await connectDB();
    await syncIndexes(User, "User");
    await syncIndexes(JournalEntry, "JournalEntry");
    await syncIndexes(JournalVersion, "JournalVersion");
    await syncIndexes(ReadingPlanDay, "ReadingPlanDay");
    await syncIndexes(ReadingCompletion, "ReadingCompletion");
  } catch (err) {
    console.error("Index sync failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
