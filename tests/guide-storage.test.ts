import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeStore, importSnapshot, loadSnapshot, listSnapshots, saveGuide, listGuides, selectGuide, loadSelectedGuide } from '../src/storage.ts';
import type { Database } from '../src/storage.ts';
import { validateGuide } from '../src/guide.ts';
import { sampleSnapshot } from '../src/sample.ts';

const g = { id: 'g1', characterDefinitionId: 'c1', name: '테스트', origin: 'sample' as const, sets: [{ setId: 'a', pieces: 2 }], characterStats: [{ key: 'attack', unit: 'flat' as const, min: 100 }] };
function adapter(db: DatabaseSync): Database { return {
  execAsync: async sql => { db.exec(sql); },
  runAsync: async (sql, ...params) => db.prepare(sql).run(...params),
  getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
  getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as T[],
}; }
test('guides save independently and selections persist after restart', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'guide-')); const path = join(folder, 'test.db'); let db = new DatabaseSync(path);
  try {
    await initializeStore(adapter(db), sampleSnapshot);
    const changed = structuredClone(sampleSnapshot); changed.characters[0]!.level.value = 88;
    await importSnapshot(adapter(db), changed);
    assert.equal(await saveGuide(adapter(db), g), 'saved');
    assert.equal(await saveGuide(adapter(db), g), 'duplicate');
    await assert.rejects(saveGuide(adapter(db), { ...g, name: '다른 내용' }));
    await saveGuide(adapter(db), { ...g, id: 'g2' });
    await saveGuide(adapter(db), { ...g, id: 'g3', characterDefinitionId: 'c2' });
    await selectGuide(adapter(db), 'c1', 'g2'); await selectGuide(adapter(db), 'c2', 'g3');
    await assert.rejects(selectGuide(adapter(db), 'c1', 'g3'));
    db.close(); db = new DatabaseSync(path); await initializeStore(adapter(db), sampleSnapshot);
    assert.equal((await listGuides(adapter(db), 'c1')).length, 2);
    assert.equal((await loadSelectedGuide(adapter(db), 'c1'))?.id, 'g2');
    assert.equal((await loadSelectedGuide(adapter(db), 'c2'))?.id, 'g3');
    assert.equal(await loadSelectedGuide(adapter(db), 'none'), null);
    assert.deepEqual(await loadSnapshot(adapter(db)), changed);
    assert.equal((await listSnapshots(adapter(db))).filter(e => e.active)[0]!.data.characters[0]!.level.value, 88);
  } finally { db.close(); rmSync(folder, { recursive: true }); }
});
test('reject duplicate and contradictory guide rules', () => {
  assert.throws(() => validateGuide({ ...g, sets: [{ setId: 'a', pieces: 2 }, { setId: 'a', pieces: 5 }] }));
  assert.throws(() => validateGuide({ ...g, sets: [{ setId: 'a', pieces: 3 }, { setId: 'b', pieces: 3 }] }));
  assert.throws(() => validateGuide({ ...g, mainStatsByCost: [{ cost: 4, allowed: ['a'] }, { cost: 4, allowed: ['b'] }] }));
  assert.throws(() => validateGuide({ ...g, characterStats: [{ key: 'attack', unit: 'flat', min: 5 }, { key: 'attack', unit: 'percent', max: 10 }] }));
  assert.throws(() => validateGuide({ ...g, skillPriority: ['skill', 'skill'] }));
});
test('version 2 migration preserves active snapshot and migration failure rolls back', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE snapshots (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL); CREATE TABLE snapshot_archive (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL); CREATE TABLE snapshot_selection (id INTEGER PRIMARY KEY CHECK(id = 1), snapshot_id INTEGER NOT NULL); PRAGMA user_version = 2;');
    const payload = JSON.stringify(sampleSnapshot); db.prepare('INSERT INTO snapshots VALUES (1, ?)').run(payload); db.prepare('INSERT INTO snapshot_archive VALUES (7, ?, ?)').run(payload, 'test'); db.exec('INSERT INTO snapshot_selection VALUES (1, 7)');
    const failing = adapter(db); const exec = failing.execAsync;
    failing.execAsync = async sql => { if (sql.startsWith('CREATE TABLE guides')) { db.exec('CREATE TABLE guides (id TEXT PRIMARY KEY)'); throw new Error('injected'); } await exec(sql); };
    await assert.rejects(initializeStore(failing, sampleSnapshot));
    assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 2);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='guides'").get(), undefined);
    assert.deepEqual(await loadSnapshot(adapter(db)), sampleSnapshot);
    await initializeStore(adapter(db), sampleSnapshot);
    assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 3);
    assert.equal((db.prepare('SELECT snapshot_id FROM snapshot_selection').get() as { snapshot_id: number }).snapshot_id, 7);
    assert.deepEqual(await loadSnapshot(adapter(db)), sampleSnapshot);
  } finally { db.close(); }
});
test('save and selection failures roll back prior selection and guides', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initializeStore(adapter(db), sampleSnapshot); await saveGuide(adapter(db), g); await saveGuide(adapter(db), { ...g, id: 'g2' }); await selectGuide(adapter(db), 'c1', 'g1');
    db.exec("CREATE TRIGGER fail_select BEFORE UPDATE ON guide_selection BEGIN SELECT RAISE(ABORT, 'injected'); END;");
    await assert.rejects(selectGuide(adapter(db), 'c1', 'g2'));
    assert.equal((await loadSelectedGuide(adapter(db), 'c1'))?.id, 'g1');
    db.exec("CREATE TRIGGER fail_save BEFORE INSERT ON guides BEGIN SELECT RAISE(ABORT, 'injected'); END;");
    await assert.rejects(saveGuide(adapter(db), { ...g, id: 'g4' }));
    assert.equal((await listGuides(adapter(db), 'c1')).length, 2);
  } finally { db.close(); }
});
