const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const { createApp } = require("./src/app");
const { loadConfig } = require("./src/config");
const { startServer } = require("./src/server");

async function withServer(app, callback) {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const testConfig = { jsonBodyLimit: "64b", bodyLimit: "64b" };

test("liveness and compatibility health endpoints return JSON", async () => {
  const app = createApp({ config: testConfig, readyCheck: async () => {} });
  await withServer(app, async (baseUrl) => {
    for (const path of ["/", "/health"]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok" });
    }
  });
});

test("unknown routes return a JSON 404 instead of HTML", async () => {
  const app = createApp({ config: testConfig });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("content-type").includes("application/json"), true);
    assert.deepEqual(await response.json(), { error: "Not found" });
  });
});

test("malformed JSON is a safe 400 response", async () => {
  const app = createApp({ config: { jsonBodyLimit: "1kb", bodyLimit: "1kb" } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Malformed JSON payload" });
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("configured request-size limit returns a safe 413 response", async () => {
  const app = createApp({ config: testConfig });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: "x".repeat(200) }),
    });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "Request payload too large" });
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("auth and private API responses are not cacheable", async () => {
  const app = createApp({ config: testConfig });
  await withServer(app, async (baseUrl) => {
    const authResponse = await fetch(`${baseUrl}/auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(authResponse.status, 400);
    assert.equal(authResponse.headers.get("cache-control"), "no-store");

    const privateResponse = await fetch(`${baseUrl}/me`);
    assert.equal(privateResponse.status, 401);
    assert.equal(privateResponse.headers.get("cache-control"), "no-store");
  });
});

test("readiness reports dependency success and failure without a live database", async () => {
  const readyApp = createApp({ config: testConfig, readyCheck: async () => ({ ok: 1 }) });
  await withServer(readyApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });

  const notReadyApp = createApp({
    config: testConfig,
    readyCheck: async () => {
      throw new Error("stubbed dependency failure");
    },
  });
  await withServer(notReadyApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "not_ready" });
  });
});

test("startup configuration requires secrets and validates numeric settings", () => {
  assert.throws(
    () => loadConfig({ PORT: "4000", JSON_BODY_LIMIT: "1mb" }, { requireSecrets: true }),
    /MONGODB_URI, JWT_SECRET/
  );
  assert.throws(
    () => loadConfig({ MONGODB_URI: "mongodb://stub", JWT_SECRET: "stub", PORT: "nope" }),
    /PORT must be an integer/
  );
  assert.throws(
    () => loadConfig({ MONGODB_URI: "mongodb://stub", JWT_SECRET: "stub", JSON_BODY_LIMIT: "nope" }),
    /JSON_BODY_LIMIT must be/
  );
  const config = loadConfig({
    MONGODB_URI: "mongodb://stub",
    JWT_SECRET: "stub",
    PORT: "4100",
    JSON_BODY_LIMIT: "2mb",
  }, { requireSecrets: true });
  assert.equal(config.port, 4100);
  assert.equal(config.jsonBodyLimit, "2mb");
});

test("server startup and shutdown can be exercised with injected dependencies", async () => {
  const events = [];
  const config = {
    mongodbUri: "mongodb://stub",
    jwtSecret: "stub",
    port: 0,
    jsonBodyLimit: "1mb",
    shutdownTimeoutMs: 1000,
  };
  const started = await startServer({
    config,
    app: createApp({ config, readyCheck: async () => {} }),
    connectDatabase: async () => events.push("connect"),
    closeDatabase: async () => events.push("close"),
    installSignalHandlers: false,
  });
  assert.equal(started.server.listening, true);
  assert.deepEqual(events, ["connect"]);
  assert.equal(await started.shutdown("test"), 0);
  assert.deepEqual(events, ["connect", "close"]);
});
