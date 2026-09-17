require("dotenv").config();

const { createApp } = require("./app");
const { loadConfig } = require("./config");
const { startServer } = require("./server");

// App construction is intentionally side-effect free: importing this module
// must not connect to MongoDB, bind a port, or load production credentials.
const app = createApp();

if (require.main === module) {
  startServer({ app })
    .then(({ config }) => {
      console.log(`[server] API listening on port ${config.port}`);
    })
    .catch((error) => {
      console.error(`[server] startup failed (${error?.name || "Error"})`);
      process.exitCode = 1;
    });
}

module.exports = { app, createApp, loadConfig, startServer };
