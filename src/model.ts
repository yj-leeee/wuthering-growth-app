/** Version 1 is a project-owned fixture contract, not an official export format. */
export type SkillId = 'basic' | 'skill' | 'liberation' | 'forte' | 'intro';
export type Source = {
  method: 'sample' | 'manual' | 'json' | 'ocr' | 'official-api';
  observedAt: string;
  gameVersion: string;
  reference: string;
};
export type Observation = {
  value: number | null;
  confirmed: boolean;
  confidence?: number;
  corrected?: boolean;
};
export type Stat = { key: string; value: Observation; unit: 'flat' | 'percent' };
export type WeaponInstance = {
  id: string;
  definitionId: string;
  level: Observation;
};
export type EchoInstance = {
  id: string;
  definitionId: string;
  setId: string | null;
  cost: 1 | 3 | 4;
  level: Observation;
  mainStats: Stat[];
  subStats: Stat[];
};
export type CharacterBuild = {
  id: string;
  definitionId: string;
  level: Observation;
  skills: Partial<Record<SkillId, Observation>>;
  /** undefined: unknown; null: confirmed unequipped. */
  weaponId?: string | null;
  echoIds?: string[];
};
export type AccountSnapshot = {
  schemaVersion: 1;
  source: Source;
  completeness: 'partial' | 'complete';
  characters: CharacterBuild[];
  weapons: WeaponInstance[];
  echoes: EchoInstance[];
};
export type Recommendation = {
  id: string;
  characterDefinitionId: string;
  gameVersion: string;
  evidence: 'example' | 'verified';
  reference: string;
  characterLevel: number;
  weaponLevel: number;
  skills: Partial<Record<SkillId, number>>;
};
export type Finding = {
  ruleId: string;
  status: 'met' | 'deficit' | 'unknown';
  current: number | null;
  target: number;
  reason: string;
};
