const rateLimit = require("express-rate-limit");

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const enabled = process.env.RATE_LIMIT_ENABLED !== "false";

const createLimiter = (windowMs, max) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

const apiWindowMs = parseNumber(
  process.env.RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const apiMax = parseNumber(process.env.RATE_LIMIT_MAX, 600);

const authWindowMs = parseNumber(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const authMax = parseNumber(process.env.AUTH_RATE_LIMIT_MAX, 30);

const apiLimiter = enabled ? createLimiter(apiWindowMs, apiMax) : (_req, _res, next) => next();
const authLimiter = enabled
  ? createLimiter(authWindowMs, authMax)
  : (_req, _res, next) => next();

module.exports = { apiLimiter, authLimiter };
