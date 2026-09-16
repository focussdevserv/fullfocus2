// Garante que cada item navegável do menu possui um renderizador registrado.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const html = readFileSync("index.html", "utf8");
const menuMarkup = html.match(/<aside[\s\S]*?id="app-sidebar"[\s\S]*?<\/aside>/)?.[0] || html;
const menuRoutes = new Set([...menuMarkup.matchAll(/href="(#[^"?#]+)"/g)].map((match) => match[1].slice(1)).filter(Boolean));
const sources = readdirSync("modules").filter((file) => file.endsWith(".js")).map((file) => readFileSync(path.join("modules", file), "utf8"));
const registered = new Set();
const registration = /registerRoutes\(\s*\{([\s\S]*?)\}\s*(?:,|\))/g;
for (const source of sources) {
  for (const match of source.matchAll(registration)) {
    for (const key of match[1].matchAll(/(?:^|,)\s*(?:"([^"]+)"|([A-Za-z0-9-]+))\s*:/g)) registered.add(key[1] || key[2]);
  }
  const generic = source.match(/const genericStructureKeys\s*=\s*\[([\s\S]*?)\]/);
  for (const key of generic?.[1].matchAll(/"([^"]+)"/g) || []) registered.add(key[1]);
}

const missing = [...menuRoutes].filter((route) => !registered.has(route));
if (missing.length) {
  console.error(`Rotas do menu sem renderizador: ${missing.map((route) => `#${route}`).join(", ")}`);
  process.exit(1);
}
console.log(`Rotas do menu válidas: ${menuRoutes.size} destinos verificados.`);
