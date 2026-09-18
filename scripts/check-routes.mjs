// Garante que cada item navegavel do menu possui renderizador e grupo de carregamento.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const html = readFileSync("index.html", "utf8");
const loader = readFileSync("module-loader.js", "utf8");
const menuMarkup = html.match(/<aside[\s\S]*?id="app-sidebar"[\s\S]*?<\/aside>/)?.[0] || html;
const menuRoutes = new Set([...menuMarkup.matchAll(/href="(#[^"?#]+)"/g)].map((match) => match[1].slice(1)).filter(Boolean));
const moduleFiles = new Set(readdirSync("modules"));
const sources = [...moduleFiles].filter((file) => file.endsWith(".js")).map((file) => readFileSync(path.join("modules", file), "utf8"));
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

const groupsBody = loader.match(/const groups = \{([\s\S]*?)\n  \};/)?.[1] || "";
const loaderRoutes = new Map();
for (const match of groupsBody.matchAll(/(?:^|,)\s*(?:"([^"]+)"|([A-Za-z0-9-]+))\s*:\s*\[([^\]]*)\]/g)) {
  const route = match[1] || match[2];
  const files = [...match[3].matchAll(/"([^"]+\.js)"/g)].map((item) => item[1]);
  loaderRoutes.set(route, files);
}
const unbundled = [...menuRoutes].filter((route) => !loaderRoutes.has(route));
if (unbundled.length) {
  console.error(`Rotas do menu sem grupo de carregamento: ${unbundled.map((route) => `#${route}`).join(", ")}`);
  process.exit(1);
}
const missingModules = [...loaderRoutes.entries()]
  .flatMap(([route, files]) => files.filter((file) => !moduleFiles.has(file)).map((file) => `${route} -> ${file}`));
if (missingModules.length) {
  console.error(`Arquivos de modulo ausentes: ${missingModules.join(", ")}`);
  process.exit(1);
}

console.log(`Rotas do menu validas: ${menuRoutes.size} destinos, ${loaderRoutes.size} grupos e modulos verificados.`);
