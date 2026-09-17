const DEFAULT_PORT = 4000;
const DEFAULT_JSON_BODY_LIMIT = "100kb";
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

function parsePort(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

function parseByteLimit(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("JSON_BODY_LIMIT must be a positive size");
    }
    return value;
  }

  const text = String(value ?? "").trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error("JSON_BODY_LIMIT must be a positive byte size (for example, 1mb)");
  }

  const multiplier = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[
    match[2] || "b"
  ];
  const bytes = Number(match[1]) * multiplier;
  if (!Number.isFinite(bytes) || bytes < 1 || !Number.isInteger(bytes)) {
    throw new Error("JSON_BODY_LIMIT must be a positive size");
  }
  return bytes;
}

function parseShutdownTimeout(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_SHUTDOWN_TIMEOUT_MS;
  }
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1) {
    throw new Error("SHUTDOWN_TIMEOUT_MS must be a positive integer");
  }
  return timeout;
}

function loadConfig(env = process.env, { requireSecrets = false } = {}) {
  const mongodbUri = String(env.MONGODB_URI || "").trim();
  const jwtSecret = String(env.JWT_SECRET || "").trim();

  if (requireSecrets) {
    const missing = [];
    if (!mongodbUri) missing.push("MONGODB_URI");
    if (!jwtSecret) missing.push("JWT_SECRET");
    if (missing.length) {
      throw new Error(`Missing required configuration: ${missing.join(", ")}`);
    }
  }

  const jsonBodyLimit = env.JSON_BODY_LIMIT || DEFAULT_JSON_BODY_LIMIT;
  // Validate the value while retaining the original Express-compatible form.
  parseByteLimit(jsonBodyLimit);

  const config = {
    mongodbUri,
    jwtSecret,
    port: parsePort(env.PORT),
    jsonBodyLimit,
    bodyLimit: jsonBodyLimit,
    shutdownTimeoutMs: parseShutdownTimeout(env.SHUTDOWN_TIMEOUT_MS),
  };

  return config;
}

module.exports = {
  DEFAULT_JSON_BODY_LIMIT,
  DEFAULT_PORT,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  loadConfig,
  parseByteLimit,
  parsePort,
};
