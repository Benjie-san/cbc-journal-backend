const express = require("express");
const router = express.Router();
const JournalEntry = require("../models/JournalEntry");
const JournalVersion = require("../models/JournalVersion");
const jwtAuth = require("../middleware/jwtAuth");

router.use(jwtAuth);

/**
 * CREATE
 */
router.post("/", async (req, res) => {
   const clientId = req.body.clientId || null;
   if (clientId) {
      const existing = await JournalEntry.findOne({
         userId: req.user.userId,
         clientId,
      });
      if (existing) {
         return res.json(existing);
      }
   }

   const entry = await JournalEntry.create({
      userId: req.user.userId,
      title: req.body.title,
      scriptureRef: req.body.scriptureRef,
      content: req.body.content,
      tags: req.body.tags || [],
      clientId,
   });

   res.json(entry);
});

/**
 * GET ALL (ACTIVE)
 */
router.get("/", async (req, res) => {
   const entries = await JournalEntry.find({
      userId: req.user.userId,
      deleted: false,
   }).sort({ createdAt: -1 });

   res.json(entries);
});

/**
 * GET RECYCLE BIN
 */
router.get("/trash", async (req, res) => {
   const entries = await JournalEntry.find({
      userId: req.user.userId,
      deleted: true,
   }).sort({ deletedAt: -1 });

   res.json(entries);
});

/**
 * GET ONE
 */
router.get("/:id", async (req, res) => {
   const entry = await JournalEntry.findOne({
      _id: req.params.id,
      userId: req.user.userId,
   });

   if (!entry) return res.status(404).json({ error: "Not found" });
   res.json(entry);
});

/**
 * GET VERSION HISTORY
 */
router.get("/:id/versions", async (req, res) => {
   const entry = await JournalEntry.findOne({
      _id: req.params.id,
      userId: req.user.userId,
   });

   if (!entry) return res.status(404).json({ error: "Not found" });

   const versions = await JournalVersion.find({
      journalId: entry._id,
   }).sort({ version: -1, createdAt: -1 });

   res.json(versions);
});

/**
 * HARD RESTORE VERSION (no new snapshot)
 */
router.post("/:id/versions/:version/restore", async (req, res) => {
   const entry = await JournalEntry.findOne({
      _id: req.params.id,
      userId: req.user.userId,
   });

   if (!entry) return res.status(404).json({ error: "Not found" });

   const versionNumber = Number(req.params.version);
   if (!Number.isFinite(versionNumber)) {
      return res.status(400).json({ error: "Invalid version" });
   }

   const snapshot = await JournalVersion.findOne({
      journalId: entry._id,
      version: versionNumber,
   });

   if (!snapshot) return res.status(404).json({ error: "Version not found" });

   entry.title = snapshot.snapshot?.title ?? "";
   entry.scriptureRef = snapshot.snapshot?.scriptureRef ?? "";
   entry.content = snapshot.snapshot?.content ?? {
      question: "",
      observation: "",
      application: "",
      prayer: "",
   };
   entry.tags = snapshot.snapshot?.tags ?? [];
   entry.version = versionNumber;

   await entry.save();

   res.json(entry);
});


//UPDATE WITH VERSIONING AND CONFLICT DETECTION
router.put("/:id", async (req, res) => {
   try {
      const { content, title, scriptureRef, tags, baseVersion } = req.body;

   if (baseVersion === undefined) {
      return res.status(400).json({
      error: "baseVersion is required",
      });
   }

   const journal = await JournalEntry.findOne({
   _id: req.params.id,
   userId: req.user.userId,
   deleted: false,
   });

   if (!journal) {
   return res.status(404).json({ error: "Journal not found" });
   }

   // 🔴 VERSION CONFLICT CHECK
   if (journal.version !== baseVersion) {
      return res.status(409).json({
         error: "VERSION_CONFLICT",
         serverVersion: journal.version,
         serverEntry: {
            title: journal.title,
            scriptureRef: journal.scriptureRef,
            content: journal.content,
            tags: journal.tags,
            updatedAt: journal.updatedAt,
            createdAt: journal.createdAt,
         },
      });
   }

   // 🧠 Save snapshot BEFORE modifying
   await JournalVersion.create({
      journalId: journal._id,
      version: journal.version,
      snapshot: {
         title: journal.title,
         scriptureRef: journal.scriptureRef,
         content: journal.content,
         tags: journal.tags,
      },
   });

   // Apply update
   journal.title = title ?? journal.title;
   journal.scriptureRef = scriptureRef ?? journal.scriptureRef;
   journal.content = content ?? journal.content;
   if (tags !== undefined) {
      journal.tags = tags;
   }
   journal.version += 1;

   await journal.save();

   res.json(journal);
   } catch (err) {
      console.error("Update journal error:", err);
      res.status(500).json({ error: "Failed to update journal" });
   }
});

/**
 * SOFT DELETE → Move to recycle bin
 */
router.delete("/:id", async (req, res) => {
   const entry = await JournalEntry.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { deleted: true, deletedAt: new Date() },
      { new: true }
   );

   if (!entry) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
});

/**
 * RESTORE FROM RECYCLE BIN
 */
router.post("/:id/restore", async (req, res) => {
   const entry = await JournalEntry.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { deleted: false, deletedAt: null },
      { new: true }
   );

   if (!entry) return res.status(404).json({ error: "Not found" });
   res.json(entry);
});

/**
 * PERMANENT DELETE
 */
router.delete("/:id/permanent", async (req, res) => {
   const result = await JournalEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
   });

   if (!result) return res.status(404).json({ error: "Not found" });
   res.json({ success: true });
});

module.exports = router;
