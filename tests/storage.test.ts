import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeStore, loadSnapshot, saveSnapshot, importSnapshot, listSnapshots, selectSnapshot, normalizeSnapshot } from '../src/storage.ts';
import type { Database } from '../src/storage.ts';
import { sampleSnapshot } from '../src/sample.ts';
function adapter(db: DatabaseSync): Database {
  return {
    execAsync: async sql => { db.exec(sql); },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as T[],
    runAsync: async (sql, ...params) => db.prepare(sql).run(...params),
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
  };
}
test('SQLite persists edits across close/reopen and does not duplicate seed', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'growth-'));
  const path = join(folder, 'test.db');
  let db = new DatabaseSync(path);
  try {
    await initializeStore(adapter(db), sampleSnapshot);
    const edited = structuredClone(sampleSnapshot); edited.characters[0]!.level.value = 80;
    await saveSnapshot(adapter(db), edited);
    db.close(); db = new DatabaseSync(path);
    await initializeStore(adapter(db), sampleSnapshot);
    assert.deepEqual(await loadSnapshot(adapter(db)), edited);
    assert.equal((db.prepare('SELECT count(*) AS n FROM snapshots').get() as { n: number }).n, 1);
  } finally { db.close(); rmSync(folder, { recursive: true }); }
});
test('future database version is refused without deleting data', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA user_version = 4');
    await assert.rejects(initializeStore(adapter(db), sampleSnapshot));
    assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 4);
  } finally { db.close(); }
});
test('invalid save leaves previous data intact; corrupt load fails', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initializeStore(adapter(db), sampleSnapshot);
    const invalid = structuredClone(sampleSnapshot); invalid.characters[0]!.level.value = -1;
    await assert.rejects(saveSnapshot(adapter(db), invalid));
    assert.deepEqual(await loadSnapshot(adapter(db)), sampleSnapshot);
    db.exec("UPDATE snapshots SET payload = '{}'");
    await assert.rejects(loadSnapshot(adapter(db)));
  } finally { db.close(); }
});
test('version 1 migrates existing data and retains its active choice', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE snapshots (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL); PRAGMA user_version = 1;');
    const original = structuredClone(sampleSnapshot); original.characters[0]!.level.value = 42;
    db.prepare('INSERT INTO snapshots VALUES (1, ?)').run(JSON.stringify(original));
    await initializeStore(adapter(db), sampleSnapshot);
    assert.deepEqual(await loadSnapshot(adapter(db)), original);
    const entries = await listSnapshots(adapter(db));
    assert.equal(entries.length, 1); assert.equal(entries[0]!.active, true);
    assert.deepEqual(entries[0]!.data, original);
    assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 3);
  } finally { db.close(); }
});
test('normalized duplicates do not create or activate a new snapshot', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initializeStore(adapter(db), sampleSnapshot);
    const changed = structuredClone(sampleSnapshot); changed.characters[0]!.level.value = 71;
    const added = await importSnapshot(adapter(db), changed);
    assert.equal(added.duplicate, false);
    const reordered = JSON.parse(JSON.stringify(sampleSnapshot, Object.keys(sampleSnapshot).reverse()));
    assert.throws(() => normalizeSnapshot(reordered));
    const duplicate = await importSnapshot(adapter(db), JSON.parse(JSON.stringify(sampleSnapshot)));
    assert.equal(duplicate.duplicate, true);
    assert.equal((await listSnapshots(adapter(db))).length, 2);
    assert.deepEqual(await loadSnapshot(adapter(db)), changed);
    await selectSnapshot(adapter(db), duplicate.id);
    assert.deepEqual(await loadSnapshot(adapter(db)), sampleSnapshot);
    const sorted = JSON.parse(normalizeSnapshot(sampleSnapshot));
    assert.equal(normalizeSnapshot(sorted), normalizeSnapshot(sampleSnapshot));
  } finally { db.close(); }
});
test('import and selection failure rolls back payload and archive', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initializeStore(adapter(db), sampleSnapshot);
    db.exec("CREATE TRIGGER deny_change BEFORE UPDATE ON snapshots BEGIN SELECT RAISE(ABORT, 'injected'); END;");
    const changed = structuredClone(sampleSnapshot); changed.characters[0]!.level.value = 72;
    await assert.rejects(importSnapshot(adapter(db), changed));
    assert.deepEqual(await loadSnapshot(adapter(db)), sampleSnapshot);
    assert.equal((await listSnapshots(adapter(db))).length, 1);
    await assert.rejects(selectSnapshot(adapter(db), 99999));
    assert.deepEqual(await loadSnapshot(adapter(db)), sampleSnapshot);
  } finally { db.close(); }
});
test('selection failure leaves previous active snapshot intact', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initializeStore(adapter(db), sampleSnapshot);
    const changed = structuredClone(sampleSnapshot); changed.characters[0]!.level.value = 73;
    await importSnapshot(adapter(db), changed);
    const old = (await listSnapshots(adapter(db))).find(entry => !entry.active)!;
    db.exec("CREATE TRIGGER deny_choice BEFORE UPDATE ON snapshot_selection BEGIN SELECT RAISE(ABORT, 'injected'); END;");
    await assert.rejects(selectSnapshot(adapter(db), old.id));
    assert.deepEqual(await loadSnapshot(adapter(db)), changed);
    assert.equal((await listSnapshots(adapter(db))).filter(entry => entry.active)[0]!.data.characters[0]!.level.value, 73);
  } finally { db.close(); }
});
