import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (file) => readFileSync(new URL(file, import.meta.url), "utf8");

function extractFunction(fileSource, name) {
  const asyncStart = fileSource.indexOf(`async function ${name}(`);
  const start = asyncStart === -1 ? fileSource.indexOf(`function ${name}(`) : asyncStart;
  assert.notEqual(start, -1, `${name} precisa existir`);
  const bodyStart = fileSource.indexOf(") {", start) + 2;
  assert.ok(bodyStart > 1, `corpo de ${name} precisa existir`);
  let depth = 0;
  for (let index = bodyStart; index < fileSource.length; index += 1) {
    if (fileSource[index] === "{") depth += 1;
    if (fileSource[index] === "}") depth -= 1;
    if (depth === 0) return fileSource.slice(start, index + 1);
  }
  throw new Error(`Não foi possível extrair ${name}`);
}

function pendingFetch() {
  let requestSignal;
  const fetch = (_path, options) => {
    requestSignal = options.signal;
    return new Promise((resolve, reject) => requestSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
  };
  return { fetch, signal: () => requestSignal };
}

test("login e cadastro usam o helper autenticado com timeout", () => {
  const app = source("app.js");
  assert.match(app, /api\("\/api\/auth\/register", \{ method: "POST", body:/);
  assert.match(app, /api\("\/api\/auth\/login", \{ method: "POST", body:/);
  assert.doesNotMatch(app, /fetch\("\/api\/auth\/(?:register|login)"/);
});

test("helper da API aborta deterministicamente no timeout e limpa o timer", async () => {
  const apiSource = extractFunction(source("app.js"), "api");
  let timeoutCallback;
  let clearedTimer;
  const window = { setTimeout(callback) { timeoutCallback = callback; return 17; }, clearTimeout(timer) { clearedTimer = timer; } };
  const request = pendingFetch();
  const api = Function("window", "fetch", "AbortController", "scheduleTransientRetry", `${apiSource}; return api;`)(window, request.fetch, AbortController, () => {});
  const result = api("/api/auth/login", { method: "POST", body: { email: "a@b.com" } });
  timeoutCallback();
  await assert.rejects(result, /Não foi possível conectar ao servidor/);
  assert.equal(request.signal().aborted, true);
  assert.equal(clearedTimer, 17);
});

test("helper do portal propaga cancelamento e timeout sem deixar timer pendente", async () => {
  const portalFetchSource = extractFunction(source("portal-actions.js"), "portalFetch");
  for (const trigger of ["timeout", "external"]) {
    let timeoutCallback;
    let clearedTimer;
    const window = { setTimeout(callback) { timeoutCallback = callback; return 23; }, clearTimeout(timer) { clearedTimer = timer; } };
    const request = pendingFetch();
    const defaultController = new AbortController();
    const portalFetch = Function("window", "fetch", "AbortController", "portalController", `${portalFetchSource}; return portalFetch;`)(window, request.fetch, AbortController, defaultController);
    const externalController = new AbortController();
    const result = portalFetch("/api/portal/token", { signal: externalController.signal });
    if (trigger === "timeout") timeoutCallback(); else externalController.abort();
    if (trigger === "timeout") await assert.rejects(result, /demorou mais que o esperado/);
    else await assert.rejects(result, { name: "AbortError" });
    assert.equal(request.signal().aborted, true);
    assert.equal(clearedTimer, 23);
  }
});

test("busca de configurações distingue resultados locais, atalhos externos e estado vazio", () => {
  const hubSource = source("modules/configuracoes-hub.js");
  const normalizeSource = hubSource.match(/const normalizeSettingsSearch = .*?;/)?.[0];
  assert.ok(normalizeSource);
  const searchSource = extractFunction(hubSource, "getSettingsSearchState");
  const getSettingsSearchState = Function(`${normalizeSource}; ${searchSource}; return getSettingsSearchState;`)();
  const panels = ["Empresa e dados CNPJ Site", "Minha conta E-mail"];
  const links = [{ text: "Empresa e dados", external: false }, { text: "Mercado Pago", external: true }];
  assert.deepEqual(getSettingsSearchState("empresa", panels, links), { query: "empresa", panelMatches: [true, false], linkMatches: [true, false], mode: "results" });
  assert.equal(getSettingsSearchState("mercado pago", panels, links).mode, "external");
  assert.equal(getSettingsSearchState("inexistente", panels, links).mode, "empty");
});
