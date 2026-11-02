import type { AccountSnapshot, Recommendation } from './model.ts';

export const sampleSnapshot: AccountSnapshot = {
  schemaVersion: 1,
  source: { method: 'sample', observedAt: '2026-11-03T00:00:00Z', gameVersion: 'fixture-v1', reference: '합성 테스트 데이터' },
  completeness: 'partial',
  characters: [{ id: 'character-1', definitionId: 'example-resonator', level: { value: 60, confirmed: true },
    weaponId: 'weapon-1', skills: { basic: { value: 6, confirmed: true }, skill: { value: null, confirmed: false } }, echoIds: ['echo-1'] }],
  weapons: [{ id: 'weapon-1', definitionId: 'example-weapon', level: { value: 70, confirmed: true } }],
  echoes: [{ id: 'echo-1', definitionId: 'example-echo', setId: 'example-set', cost: 4,
    level: { value: 0, confirmed: true }, mainStats: [], subStats: [] }],
};
/** These targets are synthetic examples and carry no game advice. */
export const sampleRecommendation: Recommendation = {
  id: 'example-growth-v1', characterDefinitionId: 'example-resonator', gameVersion: 'fixture-v1',
  evidence: 'example', reference: '단위 테스트용 예시이며 실제 권장 육성 기준이 아니다.',
  characterLevel: 70, weaponLevel: 70, skills: { basic: 6, skill: 6, liberation: 6 },
};
