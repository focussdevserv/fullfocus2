import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { once } from "node:events";
import { createReporter, readConfig, runAuthenticatedSmoke } from "./scripts/authenticated-smoke.mjs";

const json = (response, status, body, headers = {}) => {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(body));
};

async function fixture() {
  const state = { clients: [], tasks: [], created: [], deleted: [] };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://fixture.local");
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
    const authenticated = request.headers.cookie === "focus_session=test-session";
    if (url.pathname === "/") return response.end('<link rel="stylesheet" href="/styles.css?v=1"><script src="/app.js?v=1"></script>');
    if (url.pathname === "/styles.css" || url.pathname === "/app.js") return response.end("/* asset */");
    if (url.pathname === "/service-worker.js") return response.end('const APP_SHELL=["/styles.css?v=1","/app.js?v=1","/assets/icon.svg"];');
    if (url.pathname === "/assets/icon.svg") return response.end("<svg></svg>");
    if (url.pathname === "/api/health") return json(response, 200, { ok: true });
    if (url.pathname === "/api/auth/login") {
      if (body.email !== "dev@example.test" || body.password !== "segredo-seguro") return json(response, 401, { error: "credenciais inválidas" });
      return json(response, 200, { user: { id: 7, role: "owner" } }, { "set-cookie": "focus_session=test-session; HttpOnly; Path=/" });
    }
    if (!authenticated) return json(response, 401, { error: "Autenticação necessária." });
    if (url.pathname === "/api/auth/me") return json(response, 200, { user: { id: 7, role: "owner" } });
    if (url.pathname === "/api/organization") return json(response, 200, { organization: { id: 3, name: "Teste" } });
    if (url.pathname === "/api/team/roles") return json(response, 200, { roles: [{ id: 1, permissions: { crm: true } }] });
    if (url.pathname === "/api/clients" && request.method === "GET") return json(response, 200, { clients: state.clients });
    if (url.pathname === "/api/clients/quick" && request.method === "POST") {
      const client = { id: 101, name: body.name };
      state.clients.push(client); state.created.push("client");
      return json(response, 201, { client, id: client.id, created: true });
    }
    if (/^\/api\/clients\/\d+\/overview$/.test(url.pathname)) {
      const id = Number(url.pathname.split("/")[3]);
      const client = state.clients.find((item) => item.id === id);
      return client ? json(response, 200, { client, summary: {}, tasks: [] }) : json(response, 404, { error: "não encontrado" });
    }
    if (/^\/api\/clients\/\d+$/.test(url.pathname) && request.method === "DELETE") {
      state.deleted.push("client"); state.clients = [];
      response.writeHead(204); return response.end();
    }
    if (url.pathname === "/api/tasks" && request.method === "GET") return json(response, 200, { tasks: state.tasks });
    if (url.pathname === "/api/tasks" && request.method === "POST") {
      const task = { id: 202, title: body.title, client_id: body.client_id };
      state.tasks.push(task); state.created.push("task");
      return json(response, 201, { task });
    }
    if (/^\/api\/tasks\/\d+$/.test(url.pathname) && request.method === "DELETE") {
      state.deleted.push("task"); state.tasks = [];
      response.writeHead(204); return response.end();
    }
    return json(response, 404, { error: `sem fixture para ${request.method} ${url.pathname}` });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return { server, state, url: `http://127.0.0.1:${address.port}` };
}

const silentReporter = () => createReporter(() => {}, () => {});

test("sem URL o smoke explica o skip sem tentar rede", async () => {
  let fetched = false;
  const reporter = silentReporter();
  const result = await runAuthenticatedSmoke({ env: {}, reporter, fetchImpl: async () => { fetched = true; throw new Error("não deveria chamar"); } });
  assert.equal(result.skipped, true);
  assert.equal(result.failed, 0);
  assert.equal(fetched, false);
  assert.match(reporter.entries[0].detail, /SMOKE_URL/);
});

test("com URL e sem credenciais valida assets e acesso indevido, depois pula autenticação", async (t) => {
  const app = await fixture();
  t.after(() => app.server.close());
  const reporter = silentReporter();
  const result = await runAuthenticatedSmoke({ env: { SMOKE_URL: app.url }, reporter });
  assert.equal(result.failed, 0);
  assert.ok(reporter.entries.some((entry) => entry.state === "OK" && entry.label.startsWith("assets")));
  assert.ok(reporter.entries.some((entry) => entry.state === "OK" && entry.label === "acesso anônimo bloqueado"));
  assert.ok(reporter.entries.some((entry) => entry.state === "SKIP" && entry.label === "fluxos autenticados"));
});

test("modo autenticado gravável cobre cliente, ficha, tarefa, configurações, permissões e cleanup", async (t) => {
  const app = await fixture();
  t.after(() => app.server.close());
  const reporter = silentReporter();
  const result = await runAuthenticatedSmoke({ env: {
    SMOKE_URL: app.url,
    SMOKE_EMAIL: "dev@example.test",
    SMOKE_PASSWORD: "segredo-seguro",
    SMOKE_ALLOW_WRITES: "1",
  }, reporter });
  assert.equal(result.failed, 0);
  assert.deepEqual(app.state.created, ["client", "task"]);
  assert.deepEqual(app.state.deleted, ["task", "client"]);
  for (const label of ["sessão e permissões", "ficha 360 temporária", "tarefas", "configurações", "cargos e permissões", "cleanup da tarefa", "cleanup do cliente"]) {
    assert.ok(reporter.entries.some((entry) => entry.state === "OK" && entry.label === label), label);
  }
  assert.ok(reporter.entries.every((entry) => !entry.detail.includes("segredo-seguro")));
});

test("configuração mantém escritas desligadas por padrão", () => {
  assert.deepEqual(readConfig({ SMOKE_URL: "https://example.test/" }), {
    baseUrl: "https://example.test",
    email: "",
    password: "",
    allowWrites: false,
    keepData: false,
    timeoutMs: 8000,
  });
});
