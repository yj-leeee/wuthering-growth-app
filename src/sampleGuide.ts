import type { Guide } from './guide.ts';
/** Synthetic targets for the synthetic character only; not game guidance. */
export const sampleGuide: Guide = {
  id: 'codex-synthetic-guide-v1', characterDefinitionId: 'example-resonator', name: '테스트용 에코 가이드', origin: 'sample',
  author: '합성 예시', reference: '테스트 전용 · 공식 기준 아님', gameVersion: 'fixture-v1', role: '테스트',
  sets: [{ setId: 'example-set', pieces: 2 }], mainStatsByCost: [{ cost: 4, allowed: ['example-crit'] }],
  subStats: [{ key: 'example-crit', unit: 'percent', min: 5, priority: 1 }],
  characterStats: [{ key: 'example-attack', unit: 'flat', min: 1000 }], skillPriority: ['skill', 'basic'],
};
