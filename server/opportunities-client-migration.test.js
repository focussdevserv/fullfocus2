import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { listMigrationFiles } from "./migrate.js";

const migrationUrl = new URL("./migrations/147_opportunities_client.sql", import.meta.url);

test("migration cliente-first adiciona vínculo opcional e índice tenant-aware", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /alter table opportunities\s+add column if not exists client_id bigint references clients\(id\) on delete set null/i);
  assert.match(sql, /create index if not exists opportunities_org_client_idx\s+on opportunities\(organization_id, client_id\)/i);
  const files = await listMigrationFiles(new URL("./migrations", import.meta.url));
  assert.ok(files.includes("147_opportunities_client.sql"));
});

test("CRUD de oportunidades aceita client_id e reutiliza validação isolada por organização", async () => {
  const source = await readFile(new URL("./index.js", import.meta.url), "utf8");
  assert.match(source, /opportunities: \{ fields: \[[^\]]*"client_id"/);
  assert.match(source, /client_id: "clients"/);
  assert.match(source, /select 1 from \$\{table\} where id=\$1 and organization_id=\$2/);
});
