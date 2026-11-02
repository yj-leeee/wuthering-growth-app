import type { AccountSnapshot, Recommendation } from './model.ts';

type Shape = (value: unknown, path: string) => void;
const fail = (path: string): never => { throw new Error(`유효하지 않은 데이터: ${path}`); };
const text: Shape = (v, p) => { if (typeof v !== 'string' || !v.trim()) fail(p); };
const bool: Shape = (v, p) => { if (typeof v !== 'boolean') fail(p); };
const number = (min: number, max = Number.MAX_SAFE_INTEGER, integer = true): Shape => (v, p) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v))) fail(p);
};
const choice = (...values: unknown[]): Shape => (v, p) => { if (!values.includes(v)) fail(p); };
const optional = (shape: Shape): Shape => (v, p) => { if (v !== undefined) shape(v, p); };
const nullable = (shape: Shape): Shape => (v, p) => { if (v !== null) shape(v, p); };
const array = (shape: Shape): Shape => (v, p) => {
  if (!Array.isArray(v)) fail(p);
  (v as unknown[]).forEach((item, i) => shape(item, `${p}[${i}]`));
};
const object = (fields: Record<string, Shape>): Shape => (v, p) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(p);
  const data = v as Record<string, unknown>;
  for (const key of Object.keys(data)) if (!Object.hasOwn(fields, key)) fail(`${p}.${key}`);
  for (const [key, shape] of Object.entries(fields)) shape(data[key], `${p}.${key}`);
};
const observation = (min: number, integer = true): Shape => object({ value: nullable(number(min, Number.MAX_SAFE_INTEGER, integer)), confirmed: bool,
  confidence: optional(number(0, 1, false)), corrected: optional(bool) });
const skills = (shape: Shape): Shape => object(Object.fromEntries(
  ['basic', 'skill', 'liberation', 'forte', 'intro'].map(key => [key, optional(shape)])));
const stat = object({ key: text, value: observation(0, false), unit: choice('flat', 'percent') });
const timestamp: Shape = (v, p) => {
  text(v, p);
  if (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v as string) || !Number.isFinite(Date.parse(v as string))) fail(p);
};
const snapshotShape = object({
  schemaVersion: choice(1),
  source: object({ method: choice('sample', 'manual', 'json', 'ocr', 'official-api'), observedAt: timestamp, gameVersion: text, reference: text }),
  completeness: choice('partial', 'complete'),
  characters: array(object({ id: text, definitionId: text, level: observation(1), skills: skills(observation(1)),
    weaponId: optional(nullable(text)), echoIds: optional(array(text)) })),
  weapons: array(object({ id: text, definitionId: text, level: observation(1) })),
  echoes: array(object({ id: text, definitionId: text, setId: nullable(text), cost: choice(1, 3, 4),
    level: observation(0), mainStats: array(stat), subStats: array(stat) })),
});

/** Strict validation rejects unexpected fields rather than retaining arbitrary private data. */
export function validateSnapshot(value: unknown): AccountSnapshot {
  snapshotShape(value, 'snapshot');
  const data = value as AccountSnapshot;
  for (const group of [data.characters, data.weapons, data.echoes]) {
    if (new Set(group.map(item => item.id)).size !== group.length) fail('duplicate id');
  }
  const weapons = new Set(data.weapons.map(item => item.id));
  const echoes = new Set(data.echoes.map(item => item.id));
  const equippedWeapons = new Set<string>();
  const equippedEchoes = new Set<string>();
  for (const character of data.characters) {
    if (character.weaponId != null) {
      if (!weapons.has(character.weaponId) || equippedWeapons.has(character.weaponId)) fail('weapon reference');
      equippedWeapons.add(character.weaponId);
    }
    if ((character.echoIds?.length ?? 0) > 5) fail('echo slots');
    for (const id of character.echoIds ?? []) {
      if (!echoes.has(id) || equippedEchoes.has(id)) fail('echo reference');
      equippedEchoes.add(id);
    }
  }
  return data;
}

export function parseSnapshot(json: string): AccountSnapshot { return validateSnapshot(JSON.parse(json)); }

export function validateRecommendation(value: unknown): Recommendation {
  object({ id: text, characterDefinitionId: text, gameVersion: text, evidence: choice('example', 'verified'),
    reference: text, characterLevel: number(1), weaponLevel: number(1), skills: skills(number(1)) })(value, 'recommendation');
  return value as Recommendation;
}
