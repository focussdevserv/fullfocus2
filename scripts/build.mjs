// Build check da SPA vanilla: valida JavaScript e referências locais do shell.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const syntax = spawnSync(process.execPath, ["scripts/check.mjs"], { stdio: "inherit" });
if (syntax.status !== 0) process.exit(syntax.status || 1);
const html = readFileSync("index.html", "utf8");
const references = [...html.matchAll(/(?:src|href)="(modules\/[^"?#]+|styles\.css|ui\.js|app\.js|service-worker\.js)\??[^\"]*"/g)].map((match) => match[1]);
const missing = references.filter((file) => !existsSync(path.resolve(file)));
const serviceWorker = readFileSync("service-worker.js", "utf8");
const shellReferences = [...serviceWorker.matchAll(/"(\/[^"?]+)(?:\?[^"\n]*)?"/g)].map((match) => match[1]).filter((file) => file !== "/" && !file.startsWith("/api/")).map((file) => file.replace(/^\/+/, ""));
const missingShell = shellReferences.filter((file) => !existsSync(path.resolve(file)));
if (missingShell.length) { console.error(`Build invalido: shell do service worker com referencias ausentes: ${missingShell.join(", ")}`); process.exit(1); }
if (missing.length) { console.error(`Build inválido: referências ausentes: ${missing.join(", ")}`); process.exit(1); }
console.log(`Build estático válido: ${references.length} referências locais verificadas.`);
