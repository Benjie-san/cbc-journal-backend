require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { connectDB } = require("../src/db");
const ReadingPlanDay = require("../src/models/ReadingPlanDay");

const DATA_DIR = path.join(__dirname, "..", "data");
const YEAR_FILE = /^\d{4}\.json$/;

function loadPlan(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function normalizeVerse(verse) {
  return (verse || "").trim();
}

function buildOps(plan, year) {
  const ops = [];

  Object.entries(plan).forEach(([month, days]) => {
    days.forEach((day) => {
      const verse = normalizeVerse(day.verse);
      if (!verse) return;

      const date = Number(day.date);
      const order = Number(day.id);
      const isSermonNotes = verse.toLowerCase() === "sermon notes";

      ops.push({
        updateOne: {
          filter: { year, month, date },
          update: {
            $set: {
              year,
              month,
              date,
              order,
              verse,
              isSermonNotes,
            },
          },
          upsert: true,
        },
      });
    });
  });

  return ops;
}

function getTargetFiles() {
  const args = process.argv.slice(2);
  const yearArg = args.find((arg) => /^\d{4}$/.test(arg));
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => YEAR_FILE.test(file));

  if (!files.length) {
    throw new Error(`No year JSON files found in ${DATA_DIR}`);
  }

  if (!yearArg) return files;

  const target = files.filter((file) => file.startsWith(yearArg));
  if (!target.length) {
    throw new Error(`No JSON file found for year ${yearArg}`);
  }

  return target;
}

async function seed() {
  const files = getTargetFiles();
  const summary = {};

  for (const file of files) {
    const year = Number(file.slice(0, 4));
    const plan = loadPlan(path.join(DATA_DIR, file));
    const ops = buildOps(plan, year);

    if (!ops.length) {
      summary[year] = { upserted: 0, modified: 0, matched: 0 };
      continue;
    }

    const result = await ReadingPlanDay.bulkWrite(ops, { ordered: false });
    summary[year] = {
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
      matched: result.matchedCount,
    };
  }

  console.log("Seed complete:", summary);
}

connectDB()
  .then(seed)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
