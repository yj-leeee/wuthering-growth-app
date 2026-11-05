import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGuide, validateGuide } from '../src/guide.ts';
import { validateSnapshot } from '../src/validation.ts';
import { sampleSnapshot } from '../src/sample.ts';

const guide = validateGuide({ id: 'test', characterDefinitionId: 'example-resonator', name: '합성 예시', origin: 'sample', gameVersion: 'fixture-v1', sets: [{ setId: 'example-set', pieces: 2 }], mainStatsByCost: [{ cost: 4, allowed: ['crit'] }], subStats: [{ key: 'crit', unit: 'percent' }], characterStats: [{ key: 'attack', unit: 'flat', min: 100, max: 200 }] });
test('old snapshots remain valid and incomplete information remains unknown', () => {
  const data = validateSnapshot(structuredClone(sampleSnapshot));
  const findings = analyzeGuide(data, data.characters[0]!, guide);
  assert.equal(findings.find(f => f.label.startsWith('세트'))?.status, 'unknown');
  assert.equal(findings.find(f => f.label.endsWith('주옵션'))?.status, 'unknown');
  assert.equal(findings.find(f => f.label === 'attack')?.status, 'unknown');
});
test('missing echo list stays unknown even if completeness flag is set', () => {
  const data = structuredClone(sampleSnapshot);
  delete data.characters[0]!.echoIds;
  data.characters[0]!.echoesComplete = true;
  assert.equal(analyzeGuide(data, data.characters[0]!, guide).find(f => f.label.startsWith('세트'))?.status, 'unknown');
});
test('confirmed incomplete set, main option and stat boundaries', () => {
  const data = structuredClone(sampleSnapshot);
  data.characters[0]!.echoesComplete = true;
  data.characters[0]!.stats = [{ key: 'attack', unit: 'flat', value: { value: 100, confirmed: true } }];
  data.echoes[0]!.mainStatsComplete = true;
  data.echoes[0]!.mainStats = [{ key: 'crit', unit: 'percent', value: { value: 20, confirmed: true } }];
  const f = analyzeGuide(validateSnapshot(data), data.characters[0]!, guide);
  assert.equal(f.find(x => x.label.startsWith('세트'))?.status, 'deficit');
  assert.equal(f.find(x => x.label.endsWith('주옵션'))?.status, 'met');
  assert.equal(f.find(x => x.label === 'attack')?.status, 'met');
});
test('substat without numeric threshold is not treated as completed', () => {
  const data = structuredClone(sampleSnapshot);
  data.echoes[0]!.subStats = [{ key: 'crit', unit: 'percent', value: { value: 7, confirmed: true } }];
  assert.equal(analyzeGuide(data, data.characters[0]!, guide).find(f => f.label === 'echo-1 · crit')?.status, 'no_criterion');
});
test('unit mismatch and game version mismatch remain unknown', () => {
  const data = structuredClone(sampleSnapshot);
  data.characters[0]!.stats = [{ key: 'attack', unit: 'percent', value: { value: 150, confirmed: true } }];
  assert.equal(analyzeGuide(data, data.characters[0]!, guide).find(f => f.label === 'attack')?.status, 'unknown');
  data.source.gameVersion = 'other';
  assert.equal(analyzeGuide(data, data.characters[0]!, guide)[0]!.status, 'unknown');
});
test('reject invalid guide bounds and unknown fields', () => {
  assert.throws(() => validateGuide({ ...guide, characterStats: [{ key: 'attack', unit: 'flat', min: 200, max: 100 }] }));
  assert.throws(() => validateGuide({ ...guide, unknown: true }));
});
