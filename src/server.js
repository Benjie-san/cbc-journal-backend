const { createApp } = require("./app");
const { loadConfig } = require("./config");
const { connectDB, closeDB } = require("./db");

function closeHttpServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Shutdown timed out")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function startServer(options = {}) {
  const config = options.config || loadConfig(options.env || process.env, { requireSecrets: true });
  const app = options.app || createApp({ config, env: options.env });
  const connectDatabase = options.connectDatabase || connectDB;
  const closeDatabase = options.closeDatabase || closeDB;
  const connectOptions = options.connectOptions || { uri: config.mongodbUri };

  await connectDatabase(connectOptions);

  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const candidate = app.listen(config.port, () => resolve(candidate));
      candidate.once("error", reject);
    });
  } catch (error) {
    await closeDatabase().catch(() => {});
    throw error;
  }

  let shuttingDown;
  const shutdown = async (signal = "shutdown") => {
    if (shuttingDown) return shuttingDown;
    shuttingDown = (async () => {
      let exitCode = 0;
      try {
        // Closing the HTTP listener first stops new work from entering the app.
        await withTimeout(closeHttpServer(server), config.shutdownTimeoutMs);
        await withTimeout(Promise.resolve(closeDatabase()), config.shutdownTimeoutMs);
      } catch (error) {
        exitCode = 1;
        console.error(`[server] ${signal} shutdown failed (${error?.name || "Error"})`);
      }
      return exitCode;
    })();
    return shuttingDown;
  };

  if (options.installSignalHandlers !== false) {
    const handleSignal = (signal) => {
      shutdown(signal).then((exitCode) => {
        process.exitCode = exitCode;
      });
    };
    process.once("SIGINT", () => handleSignal("SIGINT"));
    process.once("SIGTERM", () => handleSignal("SIGTERM"));
  }

  return { app, server, shutdown, config };
}

module.exports = { closeHttpServer, startServer, withTimeout };
