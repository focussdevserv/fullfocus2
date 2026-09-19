import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const PROTECTED_PATHS = ["/api/auth/me", "/api/clients", "/api/tasks", "/api/organization"];
const CORE_ASSETS = ["/service-worker.js"];

const truthy = (value) => TRUE_VALUES.has(String(value || "").trim().toLowerCase());
const cleanBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

export function readConfig(env = process.env) {
  return {
    baseUrl: cleanBaseUrl(env.SMOKE_URL),
    email: String(env.SMOKE_EMAIL || "").trim(),
    password: String(env.SMOKE_PASSWORD || ""),
    allowWrites: truthy(env.SMOKE_ALLOW_WRITES),
    keepData: truthy(env.SMOKE_KEEP_DATA),
    timeoutMs: Math.max(1000, Number.parseInt(env.SMOKE_TIMEOUT_MS, 10) || 8000),
  };
}

export function createReporter(write = console.log, writeError = console.error) {
  const entries = [];
  const emit = (state, label, detail = "") => {
    const entry = { state, label, detail };
    entries.push(entry);
    const line = `${state.padEnd(5)} ${label}${detail ? ` — ${detail}` : ""}`;
    (state === "ERRO" ? writeError : write)(line);
    return entry;
  };
  return {
    entries,
    loading: (label, detail) => emit("LOAD", label, detail),
    success: (label, detail) => emit("OK", label, detail),
    error: (label, detail) => emit("ERRO", label, detail),
    skip: (label, detail) => emit("SKIP", label, detail),
  };
}

const localPath = (value) => {
  if (!value || value.startsWith("data:") || value.startsWith("#") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "http://smoke.local");
    return url.origin === "http://smoke.local" ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
};

export function assetsFromHtml(html) {
  return [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
    .map((match) => localPath(match[1]))
    .filter(Boolean);
}

export function assetsFromServiceWorker(source) {
  return [...source.matchAll(/["'](\/[^"']+\.(?:js|css|svg|png|webmanifest)(?:\?[^"']*)?)["']/gi)]
    .map((match) => match[1]);
}

export function assetsFromModuleLoader(source) {
  const version = source.match(/modules\/\$\{file\}\?v=(\d+)/)?.[1] || "4";
  const scripts = [...source.matchAll(/["']([\w-]+\.js)["']/g)].map((match) => `/modules/${match[1]}?v=${version}`);
  const styles = [...source.matchAll(/["']([\w-]+\.js)["']:\s*["']([\w-]+)["']/g)].map((match) => `/modules/${match[2]}.css?v=${version}`);
  return [...new Set([...scripts, ...styles])];
}

function responseError(response, payload) {
  const message = payload?.error || payload?.message || `HTTP ${response.status}`;
  return new Error(`${response.status} ${message}`);
}

async function bodyOf(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export function createHttpClient({ baseUrl, timeoutMs = 8000, fetchImpl = fetch }) {
  let cookie = "";
  const request = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (cookie) headers.set("cookie", cookie);
    let body = options.body;
    if (body && typeof body !== "string") {
      headers.set("content-type", "application/json");
      body = JSON.stringify(body);
    }
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...options,
      body,
      headers,
      redirect: "follow",
      signal: options.signal || AbortSignal.timeout(timeoutMs),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0];
    const payload = await bodyOf(response);
    if (!response.ok) throw responseError(response, payload);
    return { response, payload };
  };
  return { request, hasSession: () => Boolean(cookie), clearSession: () => { cookie = ""; } };
}

async function checked(reporter, label, action) {
  reporter.loading(label);
  try {
    const result = await action();
    reporter.success(label);
    return result;
  } catch (error) {
    reporter.error(label, error?.message || String(error));
    throw error;
  }
}

async function checkPublicSurface(config, reporter, fetchImpl) {
  const anonymous = createHttpClient({ ...config, fetchImpl });
  const home = await checked(reporter, "aplicação", () => anonymous.request("/"));
  await checked(reporter, "health da API", async () => {
    const { payload } = await anonymous.request("/api/health");
    if (payload?.ok !== true) throw new Error("health não confirmou ok=true");
  });
  const worker = await checked(reporter, "service worker", () => anonymous.request("/service-worker.js"));
  const htmlAssets = assetsFromHtml(typeof home.payload === "string" ? home.payload : "");
  const loaderPath = htmlAssets.find((path) => path.startsWith("/module-loader.js"));
  const loader = loaderPath ? await checked(reporter, "manifesto de módulos", () => anonymous.request(loaderPath)) : null;
  const assets = [...new Set([
    ...CORE_ASSETS,
    ...htmlAssets,
    ...assetsFromServiceWorker(typeof worker.payload === "string" ? worker.payload : ""),
    ...assetsFromModuleLoader(typeof loader?.payload === "string" ? loader.payload : ""),
  ])].filter((path) => path !== "/" && path !== "/index.html" && path !== "/service-worker.js");
  await checked(reporter, `assets (${assets.length})`, async () => {
    const results = await Promise.allSettled(assets.map((path) => anonymous.request(path)));
    const failed = results.flatMap((result, index) => result.status === "rejected" ? [`${assets[index]}: ${result.reason.message}`] : []);
    if (failed.length) throw new Error(failed.join("; "));
  });
  await checked(reporter, "acesso anônimo bloqueado", async () => {
    const failures = [];
    for (const path of PROTECTED_PATHS) {
      try {
        await anonymous.request(path);
        failures.push(`${path} ficou acessível`);
      } catch (error) {
        if (!String(error.message).startsWith("401 ")) failures.push(`${path} retornou ${error.message}`);
      }
    }
    if (failures.length) throw new Error(failures.join("; "));
  });
}

async function checkAuthenticatedReads(config, reporter, client) {
  await checked(reporter, "autenticação", async () => {
    const login = await client.request("/api/auth/login", {
      method: "POST",
      body: { email: config.email, password: config.password },
    });
    if (!client.hasSession() || !login.payload?.user?.id) throw new Error("login não retornou sessão e usuário");
    return login;
  });
  const me = await checked(reporter, "sessão e permissões", async () => {
    const result = await client.request("/api/auth/me");
    if (!result.payload?.user?.role) throw new Error("papel do usuário não foi informado");
    return result;
  });
  const clients = await checked(reporter, "cadastro de clientes", async () => {
    const result = await client.request("/api/clients?limit=10");
    if (!Array.isArray(result.payload?.clients)) throw new Error("resposta não contém clients[]");
    return result.payload.clients;
  });
  if (clients[0]?.id) {
    await checked(reporter, "ficha 360", async () => {
      const { payload } = await client.request(`/api/clients/${encodeURIComponent(clients[0].id)}/overview`);
      if (!payload?.client || !payload?.summary || !Array.isArray(payload?.tasks)) throw new Error("ficha 360 incompleta");
    });
  } else {
    reporter.skip("ficha 360", "nenhum cliente existente; use SMOKE_ALLOW_WRITES=1 para criar um registro temporário");
  }
  await checked(reporter, "tarefas", async () => {
    const { payload } = await client.request("/api/tasks?limit=10");
    if (!Array.isArray(payload?.tasks)) throw new Error("resposta não contém tasks[]");
  });
  await checked(reporter, "configurações", async () => {
    const { payload } = await client.request("/api/organization");
    if (!payload?.organization?.id) throw new Error("organização não foi retornada");
  });
  await checked(reporter, "cargos e permissões", async () => {
    const { payload } = await client.request("/api/team/roles");
    if (!Array.isArray(payload?.roles)) throw new Error("resposta não contém roles[]");
  });
  return me.payload.user;
}

async function checkWritableFlow(config, reporter, client) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const created = { clientId: null, taskId: null };
  try {
    const clientResult = await checked(reporter, "criar cadastro temporário", () => client.request("/api/clients/quick", {
      method: "POST",
      body: { name: `Smoke cliente ${suffix}` },
    }));
    created.clientId = clientResult.payload?.client?.id || clientResult.payload?.id;
    if (!created.clientId || clientResult.payload?.created === false) throw new Error("cadastro temporário não foi criado");
    await checked(reporter, "ficha 360 temporária", async () => {
      const { payload } = await client.request(`/api/clients/${encodeURIComponent(created.clientId)}/overview`);
      if (String(payload?.client?.id) !== String(created.clientId)) throw new Error("ficha retornou outro cliente");
    });
    const taskResult = await checked(reporter, "criar tarefa temporária", () => client.request("/api/tasks", {
      method: "POST",
      body: { title: `Smoke tarefa ${suffix}`, client_id: created.clientId, status: "todo", priority: "low" },
    }));
    created.taskId = taskResult.payload?.task?.id || taskResult.payload?.id;
    if (!created.taskId) throw new Error("tarefa temporária não foi criada");
    await checked(reporter, "consultar tarefa temporária", async () => {
      const { payload } = await client.request(`/api/tasks?client_id=${encodeURIComponent(created.clientId)}&limit=20`);
      if (!payload?.tasks?.some((task) => String(task.id) === String(created.taskId))) throw new Error("tarefa criada não apareceu na listagem");
    });
  } finally {
    if (config.keepData) {
      reporter.skip("cleanup", `SMOKE_KEEP_DATA=1; registros preservados (${created.taskId || "sem tarefa"}, ${created.clientId || "sem cliente"})`);
    } else {
      if (created.taskId) await checked(reporter, "cleanup da tarefa", () => client.request(`/api/tasks/${encodeURIComponent(created.taskId)}`, { method: "DELETE" }));
      if (created.clientId) await checked(reporter, "cleanup do cliente", () => client.request(`/api/clients/${encodeURIComponent(created.clientId)}`, { method: "DELETE" }));
    }
  }
}

export async function runAuthenticatedSmoke({ env = process.env, fetchImpl = fetch, reporter = createReporter() } = {}) {
  const config = readConfig(env);
  if (!config.baseUrl) {
    reporter.skip("smoke autenticado", "defina SMOKE_URL; use também SMOKE_EMAIL e SMOKE_PASSWORD para a camada autenticada");
    return { skipped: true, failed: 0, reporter };
  }
  try {
    const url = new URL(config.baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocolo inválido");
  } catch {
    reporter.error("configuração", "SMOKE_URL precisa ser uma URL http(s) válida");
    return { skipped: false, failed: 1, reporter };
  }
  let failed = 0;
  try { await checkPublicSurface(config, reporter, fetchImpl); } catch { failed += 1; }
  if (!config.email || !config.password) {
    reporter.skip("fluxos autenticados", "defina SMOKE_EMAIL e SMOKE_PASSWORD; nenhuma credencial foi lida ou exibida");
    return { skipped: false, failed, reporter };
  }
  const client = createHttpClient({ ...config, fetchImpl });
  try {
    await checkAuthenticatedReads(config, reporter, client);
    if (config.allowWrites) await checkWritableFlow(config, reporter, client);
    else reporter.skip("mutações", "modo somente leitura; defina SMOKE_ALLOW_WRITES=1 para cadastro/tarefa temporários com cleanup");
  } catch { failed += 1; }
  return { skipped: false, failed, reporter };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const result = await runAuthenticatedSmoke();
  if (result.failed) {
    console.error(`ERRO  smoke reprovado — ${result.failed} etapa(s) com falha`);
    process.exitCode = 1;
  } else if (!result.skipped) {
    console.log("OK    smoke concluído sem falhas");
  }
}
