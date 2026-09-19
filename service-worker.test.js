import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const workerSource = readFileSync(new URL("service-worker.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("index.html", import.meta.url), "utf8");

const createHarness = ({ failOptional = false, fetchImpl = async () => new Response("network") } = {}) => {
  const listeners = new Map();
  const records = new Map();
  const deleted = [];
  let claimed = false;
  let skipped = false;
  const cache = {
    addAll: async (assets) => {
      for (const asset of assets) records.set(asset, new Response(`cached:${asset}`));
    },
    add: async (asset) => {
      if (failOptional && asset === "/assets/icon-512.svg") throw new Error("optional unavailable");
      records.set(asset, new Response(`cached:${asset}`));
    },
    put: async (request, response) => records.set(typeof request === "string" ? request : request.url, response),
  };
  const caches = {
    open: async () => cache,
    keys: async () => ["focusdev-shell-old", "focusdev-shell-v73"],
    delete: async (key) => { deleted.push(key); return true; },
    match: async (request) => records.get(typeof request === "string" ? request : request.url),
  };
  const self = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    skipWaiting: async () => { skipped = true; },
    clients: { claim: async () => { claimed = true; } },
  };
  vm.runInNewContext(workerSource, { self, caches, fetch: fetchImpl, Response, Promise });
  const dispatchExtendable = async (type) => {
    let pending;
    listeners.get(type)({ waitUntil: (promise) => { pending = promise; } });
    await pending;
  };
  const dispatchFetch = async (request) => {
    let response;
    listeners.get("fetch")({ request, respondWith: (promise) => { response = promise; } });
    return response ? response : undefined;
  };
  return { records, deleted, dispatchExtendable, dispatchFetch, state: () => ({ claimed, skipped }) };
};

test("APP_SHELL acompanha as referências locais versionadas do index", () => {
  const indexAssets = [...htmlSource.matchAll(/(?:src|href)="((?:styles\.css|ui\.css|design\.css|app\.js|ui\.js|module-loader\.js)\?v=\d+)"/g)]
    .map((match) => `/${match[1]}`);
  assert.ok(indexAssets.length > 0);
  for (const asset of indexAssets) assert.ok(workerSource.includes(`"${asset}"`), `${asset} precisa estar no APP_SHELL`);
  assert.doesNotMatch(workerSource, /APP_SHELL[\s\S]*portal-actions\.js/);
});

test("instala, ativa e atende navegação offline mesmo se asset opcional falhar", async () => {
  const harness = createHarness({
    failOptional: true,
    fetchImpl: async () => { throw new Error("offline"); },
  });

  await assert.doesNotReject(harness.dispatchExtendable("install"));
  assert.equal(harness.state().skipped, true);
  assert.ok(harness.records.has("/index.html"));
  assert.equal(harness.records.has("/assets/icon-512.svg"), false);

  await assert.doesNotReject(harness.dispatchExtendable("activate"));
  assert.deepEqual(harness.deleted, ["focusdev-shell-old"]);
  assert.equal(harness.state().claimed, true);

  const response = await harness.dispatchFetch({ method: "GET", url: "https://app.test/dashboard", mode: "navigate" });
  assert.equal(await response.text(), "cached:/index.html");
});

test("fetch offline de asset sem cache retorna erro sem rejeitar", async () => {
  const harness = createHarness({ fetchImpl: async () => { throw new Error("offline"); } });
  await harness.dispatchExtendable("install");
  const response = await harness.dispatchFetch({ method: "GET", url: "https://app.test/missing.js", mode: "cors" });
  assert.equal(response.type, "error");
});
