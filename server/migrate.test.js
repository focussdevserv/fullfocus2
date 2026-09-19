import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { listMigrationFiles, runMigrations } from "./migrate.js";

function fakePool(applied = []) {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push([sql, params]);
      if (/select name from schema_migrations/.test(sql)) return { rows: applied.map((name) => ({ name })) };
      if (/pg_advisory_unlock/.test(sql)) return { rows: [{ unlocked: true }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  return {
    queries,
    async connect() { return client; },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function lockedPool(migrationSql, { pauseFirstMigration = false, failFirstMigration = false } = {}) {
  const applied = new Set();
  const queries = [];
  const releases = [];
  const firstMigrationStarted = deferred();
  const continueFirstMigration = deferred();
  const secondLockWaiting = deferred();
  const lockWaiters = [];
  let lockOwner;
  let nextClientId = 0;
  let migrationRuns = 0;

  return {
    queries,
    releases,
    firstMigrationStarted,
    continueFirstMigration,
    secondLockWaiting,
    get lockOwner() { return lockOwner; },
    get migrationRuns() { return migrationRuns; },
    async connect() {
      const clientId = ++nextClientId;
      let pendingMigration;
      return {
        async query(sql, params) {
          queries.push([sql, params, clientId]);
          if (/pg_advisory_lock/.test(sql)) {
            if (lockOwner === undefined) lockOwner = clientId;
            else {
              secondLockWaiting.resolve();
              await new Promise((resolve) => lockWaiters.push({ clientId, resolve }));
            }
            return { rows: [{}], rowCount: 1 };
          }
          if (/pg_advisory_unlock/.test(sql)) {
            assert.equal(lockOwner, clientId);
            const next = lockWaiters.shift();
            if (next) {
              lockOwner = next.clientId;
              next.resolve();
            } else lockOwner = undefined;
            return { rows: [{ unlocked: true }], rowCount: 1 };
          }
          if (/select name from schema_migrations/.test(sql)) {
            return { rows: [...applied].map((name) => ({ name })), rowCount: applied.size };
          }
          if (sql === migrationSql) {
            migrationRuns += 1;
            if (migrationRuns === 1) {
              firstMigrationStarted.resolve();
              if (failFirstMigration) throw new Error("falha simulada");
              if (pauseFirstMigration) await continueFirstMigration.promise;
            }
          }
          if (/insert into schema_migrations/.test(sql)) pendingMigration = params[0];
          if (sql === "commit" && pendingMigration) {
            applied.add(pendingMigration);
            pendingMigration = undefined;
          }
          if (sql === "rollback") pendingMigration = undefined;
          return { rows: [], rowCount: 0 };
        },
        release(destroy = false) { releases.push([clientId, destroy]); },
      };
    },
  };
}

async function migrationFixture(sql = "select migration_body;") {
  const dir = await mkdtemp(path.join(tmpdir(), "focus-mig-"));
  await writeFile(path.join(dir, "001_a.sql"), sql);
  const schemaDir = await mkdtemp(path.join(tmpdir(), "focus-schema-"));
  const schemaFile = path.join(schemaDir, "schema.sql");
  await writeFile(schemaFile, "select baseline;");
  return { dir, schemaFile, sql };
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
  assert.ok(sqls.indexOf("select pg_advisory_lock($1, $2)") < sqls.indexOf("select 0;"));
  assert.ok(sqls.indexOf("select pg_advisory_unlock($1, $2) as unlocked") > sqls.indexOf("commit"));
});

test("serializa runners concorrentes e reconsulta migrations depois de obter o lock", async () => {
  const fixture = await migrationFixture();
  const pool = lockedPool(fixture.sql, { pauseFirstMigration: true });
  const options = { schemaFile: fixture.schemaFile, directory: fixture.dir, logger: { info() {} } };

  const firstRun = runMigrations(pool, options);
  await pool.firstMigrationStarted.promise;
  const secondRun = runMigrations(pool, options);
  await pool.secondLockWaiting.promise;
  assert.equal(pool.migrationRuns, 1, "o segundo runner aguarda sem executar a migration");

  pool.continueFirstMigration.resolve();
  assert.deepEqual(await Promise.all([firstRun, secondRun]), [["001_a.sql"], []]);
  assert.equal(pool.migrationRuns, 1, "a migration e aplicada uma unica vez");
  assert.deepEqual(pool.releases, [[1, false], [2, false]]);
});

test("libera o advisory lock quando uma migration falha", async () => {
  const fixture = await migrationFixture();
  const pool = lockedPool(fixture.sql, { failFirstMigration: true });
  const options = { schemaFile: fixture.schemaFile, directory: fixture.dir, logger: { info() {} } };

  await assert.rejects(runMigrations(pool, options), /\[migrate\] falha em 001_a\.sql: falha simulada/);
  assert.equal(pool.lockOwner, undefined, "o lock foi liberado depois do rollback");
  assert.deepEqual(pool.releases, [[1, false]]);

  assert.deepEqual(await runMigrations(pool, options), ["001_a.sql"]);
  assert.equal(pool.lockOwner, undefined);
  assert.deepEqual(pool.releases, [[1, false], [2, false]]);
});
