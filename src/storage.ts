import type { AccountSnapshot } from './model.ts';
import { parseSnapshot, validateSnapshot } from './validation.ts';
import { validateGuide } from './guide.ts';
import type { Guide } from './guide.ts';

export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
}
export type SnapshotEntry = { id: number; payload: string; createdAt: string; active: boolean; data: AccountSnapshot };
/** Canonicalize object key order, while preserving arrays and all values and metadata. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function normalizeSnapshot(data: AccountSnapshot): string { return canonical(validateSnapshot(data)); }
export async function initializeStore(db: Database, sample: AccountSnapshot) {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;
    if (version > 3) throw new Error('더 새로운 앱에서 만든 저장소입니다. 앱 업데이트가 필요합니다.');
    if (version === 0) await db.execAsync('CREATE TABLE snapshots (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL)');
    const payload = JSON.stringify(validateSnapshot(sample));
    await db.runAsync('INSERT OR IGNORE INTO snapshots (id, payload) VALUES (1, ?)', payload);
    if (version < 2) {
      await db.execAsync('CREATE TABLE snapshot_archive (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL); CREATE TABLE snapshot_selection (id INTEGER PRIMARY KEY CHECK(id = 1), snapshot_id INTEGER NOT NULL REFERENCES snapshot_archive(id));');
      const existing = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM snapshots WHERE id = 1');
      if (!existing) throw new Error('기존 데이터를 찾을 수 없습니다.');
      await db.runAsync('INSERT INTO snapshot_archive (payload, created_at) VALUES (?, ?)', normalizeSnapshot(parseSnapshot(existing.payload)), new Date().toISOString());
      await db.execAsync('INSERT INTO snapshot_selection (id, snapshot_id) SELECT 1, id FROM snapshot_archive LIMIT 1; PRAGMA user_version = 2;');
    }
    if (version < 3) {
      await db.execAsync('CREATE TABLE guides (id TEXT PRIMARY KEY NOT NULL, character_id TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE guide_selection (character_id TEXT PRIMARY KEY NOT NULL, guide_id TEXT NOT NULL, FOREIGN KEY(guide_id) REFERENCES guides(id)); PRAGMA user_version = 3;');
    }
    await db.execAsync('COMMIT');
  } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}
/** IDs are immutable: a different guide with the same ID must receive a new ID. */
export async function saveGuide(db: Database, input: unknown): Promise<'saved' | 'duplicate'> {
  const guide = validateGuide(input);
  const payload = canonical(guide);
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM guides WHERE id = ?', guide.id);
    if (row && row.payload !== payload) throw new Error('같은 ID의 다른 가이드가 있습니다. 새 ID를 사용해 주세요.');
    if (!row) await db.runAsync('INSERT INTO guides (id, character_id, payload) VALUES (?, ?, ?)', guide.id, guide.characterDefinitionId, payload);
    await db.execAsync('COMMIT');
    return row ? 'duplicate' : 'saved';
  } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}
export async function listGuides(db: Database, characterId: string): Promise<Guide[]> {
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM guides WHERE character_id = ? ORDER BY id', characterId);
  return rows.map(row => validateGuide(JSON.parse(row.payload)));
}
export async function selectGuide(db: Database, characterId: string, guideId: string) {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM guides WHERE id = ? AND character_id = ?', guideId, characterId);
    if (!row || validateGuide(JSON.parse(row.payload)).characterDefinitionId !== characterId) throw new Error('해당 캐릭터의 가이드를 찾을 수 없습니다.');
    await db.runAsync('INSERT INTO guide_selection (character_id, guide_id) VALUES (?, ?) ON CONFLICT(character_id) DO UPDATE SET guide_id = excluded.guide_id', characterId, guideId);
    await db.execAsync('COMMIT');
  } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}
export async function loadSelectedGuide(db: Database, characterId: string): Promise<Guide | null> {
  const row = await db.getFirstAsync<{ payload: string }>('SELECT g.payload FROM guides g JOIN guide_selection s ON s.guide_id = g.id AND s.character_id = g.character_id WHERE s.character_id = ?', characterId);
  return row ? validateGuide(JSON.parse(row.payload)) : null;
}
export async function loadSnapshot(db: Database): Promise<AccountSnapshot> {
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM snapshots WHERE id = 1');
  if (!row) throw new Error('저장된 스냅샷이 없습니다.');
  return parseSnapshot(row.payload);
}
export async function listSnapshots(db: Database): Promise<SnapshotEntry[]> {
  const rows = await db.getAllAsync<{ id: number; payload: string; created_at: string; active: number }>('SELECT a.id, a.payload, a.created_at, (a.id = s.snapshot_id) AS active FROM snapshot_archive a CROSS JOIN snapshot_selection s WHERE s.id = 1 ORDER BY a.id DESC');
  return rows.map(row => ({ id: row.id, payload: row.payload, createdAt: row.created_at, active: !!row.active, data: parseSnapshot(row.payload) }));
}
export async function findDuplicate(db: Database, data: AccountSnapshot): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM snapshot_archive WHERE payload = ?', normalizeSnapshot(data));
  return row?.id ?? null;
}
export async function selectSnapshot(db: Database, id: number) {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM snapshot_archive WHERE id = ?', id);
    if (!row) throw new Error('선택한 스냅샷을 찾을 수 없습니다.');
    parseSnapshot(row.payload);
    await db.runAsync('UPDATE snapshots SET payload = ? WHERE id = 1', row.payload);
    await db.runAsync('UPDATE snapshot_selection SET snapshot_id = ? WHERE id = 1', id);
    await db.execAsync('COMMIT');
  } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}
export async function importSnapshot(db: Database, data: AccountSnapshot): Promise<{ id: number; duplicate: boolean }> {
  const payload = normalizeSnapshot(data);
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM snapshot_archive WHERE payload = ?', payload);
    if (existing) { await db.execAsync('COMMIT'); return { id: existing.id, duplicate: true }; }
    await db.runAsync('INSERT INTO snapshot_archive (payload, created_at) VALUES (?, ?)', payload, new Date().toISOString());
    const inserted = await db.getFirstAsync<{ id: number }>('SELECT id FROM snapshot_archive WHERE payload = ?', payload);
    if (!inserted) throw new Error('새 스냅샷을 찾을 수 없습니다.');
    await db.runAsync('UPDATE snapshots SET payload = ? WHERE id = 1', payload);
    await db.runAsync('UPDATE snapshot_selection SET snapshot_id = ? WHERE id = 1', inserted.id);
    await db.execAsync('COMMIT');
    return { id: inserted.id, duplicate: false };
  } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}
export async function saveSnapshot(db: Database, data: AccountSnapshot) {
  const result = await importSnapshot(db, data);
  if (result.duplicate) await selectSnapshot(db, result.id);
}
