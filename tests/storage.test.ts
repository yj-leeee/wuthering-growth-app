import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeStore, loadSnapshot, saveSnapshot } from '../src/storage.ts';
import type { Database } from '../src/storage.ts';
import { sampleSnapshot } from '../src/sample.ts';
function adapter(db: DatabaseSync): Database {
  return {
    execAsync: async sql => { db.exec(sql); },
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
    db.exec('PRAGMA user_version = 2');
    await assert.rejects(initializeStore(adapter(db), sampleSnapshot));
    assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 2);
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
