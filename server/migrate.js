import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Runner de migrations versionado.
   1. Aplica server/schema.sql (baseline idempotente, legado).
   2. Aplica cada arquivo de server/migrations/*.sql em ordem de nome, uma única vez,
      registrando em schema_migrations. Cada módulo do produto cria o SEU arquivo
      (ex.: 003_inbox_conversas.sql) em vez de editar schema.sql — assim vários
      workers não disputam o mesmo arquivo. */

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_LOCK_SQL = "select pg_advisory_lock($1, $2)";
const MIGRATION_UNLOCK_SQL = "select pg_advisory_unlock($1, $2) as unlocked";
const MIGRATION_LOCK_KEYS = [0x464f4353, 0x4d494752]; // "FOCS" / "MIGR"

export async function listMigrationFiles(directory = path.join(here, "migrations")) {
  let entries = [];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return entries.filter((name) => name.endsWith(".sql")).sort((a, b) => a.localeCompare(b, "en"));
}

export async function runMigrations(pool, { schemaFile = path.join(here, "schema.sql"), directory = path.join(here, "migrations"), logger = console } = {}) {
  const schema = await readFile(schemaFile, "utf8");
  const files = await listMigrationFiles(directory);
  const client = await pool.connect();
  let locked = false;
  let destroyClient = false;
  let failure;
  let appliedFiles;
  try {
    await client.query(MIGRATION_LOCK_SQL, MIGRATION_LOCK_KEYS);
    locked = true;
    await client.query(schema);
    await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const applied = new Set((await client.query("select name from schema_migrations")).rows.map((row) => row.name));
    for (const name of files) {
      if (applied.has(name)) continue;
      const sql = await readFile(path.join(directory, name), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [name]);
        await client.query("commit");
        logger.info?.(`[migrate] aplicada ${name}`);
      } catch (error) {
        await client.query("rollback").catch(() => {});
        error.message = `[migrate] falha em ${name}: ${error.message}`;
        throw error;
      }
    }
    appliedFiles = files.filter((name) => !applied.has(name));
  } catch (error) {
    failure = error;
  } finally {
    if (locked) {
      try {
        const result = await client.query(MIGRATION_UNLOCK_SQL, MIGRATION_LOCK_KEYS);
        if (result.rows[0]?.unlocked !== true) throw new Error("[migrate] advisory lock nao foi liberado");
      } catch (error) {
        destroyClient = true;
        if (!failure) failure = error;
      }
    }
    client.release(destroyClient);
  }
  if (failure) throw failure;
  return appliedFiles;
}
