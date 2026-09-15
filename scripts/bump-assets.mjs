// Incrementa o ?v= dos arquivos estáticos alterados em relação a um commit (padrão: HEAD),
// em index.html e no service worker, e sobe a versão do cache do shell.
// Uso: node scripts/bump-assets.mjs [commit]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const base = process.argv[2] || "HEAD";
const changed = execFileSync("git", ["diff", "--name-only", base, "--", "index.html", "app.js", "ui.js", "styles.css", "ui.css", "design.css", "portal-actions.js", "modules"], { encoding: "utf8" })
  .split(/\r?\n/).map((line) => line.trim()).filter((file) => file && file !== "index.html" && /\.(js|css)$/.test(file));
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "modules", "app.js", "ui.js", "styles.css", "ui.css", "design.css"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const files = [...new Set([...changed, ...untracked])];
if (!files.length) { console.log("Nenhum arquivo estático alterado."); process.exit(0); }

let html = readFileSync("index.html", "utf8"), sw = readFileSync("service-worker.js", "utf8");
const bumped = [];
for (const file of files) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(["'/])(${escaped})\\?v=(\\d+)`, "g");
  let version = null;
  const replace = (text) => text.replace(pattern, (_, prefix, name, current) => { version = version ?? Number(current) + 1; return `${prefix}${name}?v=${version}`; });
  html = replace(html); sw = replace(sw);
  if (version !== null) bumped.push(`${file} → v${version}`);
}
sw = sw.replace(/focusdev-shell-v(\d+)/, (_, n) => `focusdev-shell-v${Number(n) + 1}`);
writeFileSync("index.html", html); writeFileSync("service-worker.js", sw);
console.log(bumped.length ? `Versões incrementadas:\n  ${bumped.join("\n  ")}` : "Arquivos alterados sem ?v= no shell:", bumped.length ? "" : files.join(", "));
console.log("Cache do service worker:", sw.match(/focusdev-shell-v\d+/)[0]);
