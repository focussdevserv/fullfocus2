import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { listMigrationFiles, runMigrations } from "./migrate.js";

function fakePool(applied = []) {
  const queries = [];
  const client = { query: async (sql, params) => { queries.push([sql, params]); return { rows: [], rowCount: 0 }; }, release() {} };
  return {
    queries,
    async query(sql, params) {
      queries.push([sql, params]);
      if (/select name from schema_migrations/.test(sql)) return { rows: applied.map((name) => ({ name })) };
      return { rows: [], rowCount: 0 };
    },
    async connect() { return client; },
  };
}

test("lista arquivos .sql em ordem de nome e ignora diretório inexistente", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "focus-mig-"));
  await writeFile(path.join(dir, "002_b.sql"), "select 2;");
  await writeFile(path.join(dir, "001_a.sql"), "select 1;");
  await writeFile(path.join(dir, "notes.txt"), "x");
  assert.deepEqual(await listMigrationFiles(dir), ["001_a.sql", "002_b.sql"]);
  assert.deepEqual(await listMigrationFiles(path.join(dir, "nao-existe")), []);
});

test("aplica apenas migrations pendentes, dentro de transação, e registra o nome", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "focus-mig-"));
  await writeFile(path.join(dir, "001_a.sql"), "select 1;");
  await writeFile(path.join(dir, "002_b.sql"), "select 2;");
  const schemaDir = await mkdtemp(path.join(tmpdir(), "focus-schema-"));
  const schema = path.join(schemaDir, "schema.sql");
  await writeFile(schema, "select 0;");
  const pool = fakePool(["001_a.sql"]);
  const applied = await runMigrations(pool, { schemaFile: schema, directory: dir, logger: { info() {} } });
  assert.deepEqual(applied, ["002_b.sql"]);
  const sqls = pool.queries.map(([sql]) => sql);
  assert.ok(sqls.includes("select 0;"), "baseline aplicado");
  assert.ok(!sqls.includes("select 1;"), "migration já aplicada não roda de novo");
  assert.ok(sqls.includes("select 2;"));
  const inserted = pool.queries.find(([sql]) => /insert into schema_migrations/.test(sql));
  assert.deepEqual(inserted[1], ["002_b.sql"]);
  assert.ok(sqls.indexOf("begin") < sqls.indexOf("select 2;") && sqls.indexOf("select 2;") < sqls.indexOf("commit"));
});
