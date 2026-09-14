// Verifica a sintaxe de todo o JavaScript do projeto (frontend, módulos, servidor e rotas).
import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const roots = ["app.js", "service-worker.js", "modules", "server"];
const files = [];
function walk(target) {
  const stats = statSync(target);
  if (stats.isFile()) { if (target.endsWith(".js") || target.endsWith(".mjs")) files.push(target); return; }
  for (const entry of readdirSync(target)) walk(path.join(target, entry));
}
roots.forEach(walk);

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) failed += 1;
}
console.log(`${files.length - failed}/${files.length} arquivos com sintaxe válida`);
process.exit(failed ? 1 : 0);
