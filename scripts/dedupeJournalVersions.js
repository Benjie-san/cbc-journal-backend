require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../src/db");
const JournalVersion = require("../src/models/JournalVersion");

async function dedupeJournalVersions() {
  const duplicates = await JournalVersion.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { journalId: "$journalId", version: "$version" },
        ids: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  let removed = 0;
  for (const group of duplicates) {
    const idsToDelete = group.ids.slice(1); // keep newest
    if (!idsToDelete.length) continue;
    const result = await JournalVersion.deleteMany({
      _id: { $in: idsToDelete },
    });
    removed += result.deletedCount ?? 0;
  }

  console.log(
    `Removed ${removed} duplicate JournalVersion documents across ${duplicates.length} groups.`
  );
}

(async () => {
  try {
    await connectDB();
    await dedupeJournalVersions();
  } catch (err) {
    console.error("Dedupe failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
