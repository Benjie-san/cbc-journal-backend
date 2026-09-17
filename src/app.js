const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { pingDB } = require("./db");

const meRoutes = require("./routes/me");
const journalRoutes = require("./routes/journals");
const authRoutes = require("./routes/auth");
const readingPlanRoutes = require("./routes/readingPlan");
const { apiLimiter, authLimiter } = require("./middleware/rateLimit");
const { loadConfig } = require("./config");

const PRIVATE_PATHS = ["/auth", "/me", "/journals", "/reading-plan"];

function isPrivatePath(path) {
  return PRIVATE_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function noStoreForPrivateResponses(req, res, next) {
  if (isPrivatePath(req.path)) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}

function logRequestError(req, status, error) {
  const kind = error?.type || error?.code || error?.name || "Error";
  console.error(`[api] ${req.method} ${req.path} -> ${status} (${kind})`);
}

function createApp(options = {}) {
  const app = express();
  const env = options.env || process.env;
  const config = options.config || loadConfig(env);
  const readyCheck = options.readyCheck || pingDB;

  app.set("trust proxy", 1);
  app.use(helmet());
  const corsOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : null;
  // CORS remains permissive for the native-only deployment phase.
  app.use(cors(corsOrigins ? { origin: corsOrigins, credentials: true } : undefined));
  app.use(noStoreForPrivateResponses);
  app.use(express.json({ limit: config.jsonBodyLimit || config.bodyLimit }));
  app.use(morgan("dev"));

  app.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok" });
  });

  app.get("/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok" });
  });

  app.get("/ready", apiLimiter, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await readyCheck();
      return res.json({ status: "ok" });
    } catch (error) {
      logRequestError(_req, 503, error);
      return res.status(503).json({ status: "not_ready" });
    }
  });

  app.use("/me", apiLimiter, meRoutes);
  app.use("/journals", apiLimiter, journalRoutes);
  app.use("/auth", authLimiter, authRoutes);
  app.use("/reading-plan", apiLimiter, readingPlanRoutes);

  // Keep all unknown routes JSON, including routes that never reached a router.
  app.use((req, res) => {
    if (isPrivatePath(req.path)) {
      res.setHeader("Cache-Control", "no-store");
    }
    res.status(404).json({ error: "Not found" });
  });

  // Express/body-parser errors must not fall through to its HTML handler.
  app.use((error, req, res, _next) => {
    const isMalformedJson = error?.type === "entity.parse.failed";
    const isTooLarge = error?.type === "entity.too.large";
    const status = isMalformedJson ? 400 : isTooLarge ? 413 : 500;
    const message = isMalformedJson
      ? "Malformed JSON payload"
      : isTooLarge
        ? "Request payload too large"
        : "Internal server error";

    logRequestError(req, status, error);
    if (isPrivatePath(req.path)) {
      res.setHeader("Cache-Control", "no-store");
    }
    if (res.headersSent) return res.end();
    return res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp, isPrivatePath };
