const baseUrl = (process.env.SMOKE_URL || "https://focussdev.space").replace(/\/$/, "");
const checks = [
  ["aplicação", "/"],
  ["health da API", "/api/health"],
  ["loader de módulos", "/module-loader.js?v=3"],
  ["CSS principal", "/styles.css?v=18"],
  ["módulo inicial", "/modules/inicio.js?v=4"],
];

let failed = 0;
for (const [label, path] of checks) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    const body = path === "/api/health" ? await response.text() : "";
    const healthOk = path !== "/api/health" || response.ok && body.includes('"ok":true');
    if (!response.ok || !healthOk) throw new Error(`HTTP ${response.status}`);
    console.log(`OK  ${label.padEnd(20)} ${response.status} ${path}`);
  } catch (error) {
    failed += 1;
    console.error(`ERR ${label.padEnd(20)} ${path} — ${error.message}`);
  }
}

if (failed) {
  console.error(`Smoke test falhou: ${failed} verificação(ões).`);
  process.exitCode = 1;
} else {
  console.log(`Smoke test aprovado: ${checks.length} verificações em ${baseUrl}.`);
}
