import type { AccountSnapshot } from './model.ts';
import { parseSnapshot, validateSnapshot } from './validation.ts';

/** Small SQL port: Expo on Android; a real SQLite adapter in tests. */
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
}
export async function initializeStore(db: Database, sample: AccountSnapshot) {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;
    if (version > 1) throw new Error('더 새로운 앱에서 만든 저장소다. 앱 업데이트가 필요하다.');
    if (version === 0) {
      await db.execAsync('CREATE TABLE snapshots (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL); PRAGMA user_version = 1;');
    }
    const payload = JSON.stringify(validateSnapshot(sample));
    await db.runAsync('INSERT OR IGNORE INTO snapshots (id, payload) VALUES (1, ?)', payload);
    await db.execAsync('COMMIT');
  } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}
export async function loadSnapshot(db: Database): Promise<AccountSnapshot> {
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM snapshots WHERE id = 1');
  if (!row) throw new Error('저장된 스냅샷이 없다.');
  return parseSnapshot(row.payload);
}
export async function saveSnapshot(db: Database, data: AccountSnapshot) {
  const payload = JSON.stringify(validateSnapshot(data));
  await db.runAsync('INSERT INTO snapshots (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload', payload);
}
