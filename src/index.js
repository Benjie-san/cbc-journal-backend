const dotenvOptions = process.env.DOTENV_CONFIG_PATH
  ? { path: process.env.DOTENV_CONFIG_PATH }
  : undefined;

require("dotenv").config(dotenvOptions);

const { createApp } = require("./app");
const { loadConfig } = require("./config");
const { startServer } = require("./server");

// App construction is intentionally side-effect free: importing this module
// must not connect to MongoDB, bind a port, or load production credentials.
let importedApp;

if (require.main === module) {
  startServer()
    .then(({ config }) => {
      console.log(`[server] API listening on port ${config.port}`);
    })
    .catch((error) => {
      console.error(`[server] startup failed (${error?.name || "Error"})`);
      process.exitCode = 1;
    });
}

module.exports = {
  get app() {
    importedApp ||= createApp();
    return importedApp;
  },
  createApp,
  loadConfig,
  startServer,
};
