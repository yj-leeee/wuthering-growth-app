import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCharacter } from '../src/analysis.ts';
import { parseSnapshot, validateSnapshot, validateRecommendation } from '../src/validation.ts';
import { sampleSnapshot, sampleRecommendation } from '../src/sample.ts';

const fresh = () => structuredClone(sampleSnapshot);
test('sample JSON round trip preserves data and metadata', () => {
  assert.deepEqual(parseSnapshot(JSON.stringify(sampleSnapshot)), sampleSnapshot);
  assert.deepEqual(validateRecommendation(sampleRecommendation), sampleRecommendation);
});
test('analysis distinguishes deficits, equal targets, missing and null values', () => {
  const result = analyzeCharacter(sampleSnapshot, sampleSnapshot.characters[0]!, sampleRecommendation);
  assert.deepEqual(result.findings.map(f => f.status), ['deficit', 'met', 'met', 'unknown', 'unknown']);
  assert.deepEqual(result.summary, { met: 2, deficit: 1, unknown: 2 });
  assert.equal(result.exampleOnly, true);
});
test('above target is met and input remains unchanged', () => {
  const data = fresh(); data.characters[0]!.level.value = 80;
  const before = JSON.stringify(data);
  assert.equal(analyzeCharacter(data, data.characters[0]!, sampleRecommendation).findings[0]!.status, 'met');
  assert.equal(JSON.stringify(data), before);
});
test('unconfirmed OCR value stays unknown even with high confidence', () => {
  const data = fresh(); data.characters[0]!.level = { value: 80, confirmed: false, confidence: 0.99 };
  assert.equal(analyzeCharacter(data, data.characters[0]!, sampleRecommendation).findings[0]!.status, 'unknown');
});
test('unknown weapon differs from confirmed unequipped weapon', () => {
  const data = fresh(); delete data.characters[0]!.weaponId;
  assert.equal(analyzeCharacter(data, data.characters[0]!, sampleRecommendation).findings[1]!.status, 'unknown');
  data.characters[0]!.weaponId = null;
  assert.equal(analyzeCharacter(data, data.characters[0]!, sampleRecommendation).findings[1]!.status, 'deficit');
});
test('version mismatch makes every comparison unknown', () => {
  const data = fresh(); data.source.gameVersion = 'different';
  assert.ok(analyzeCharacter(data, data.characters[0]!, sampleRecommendation).findings.every(f => f.status === 'unknown'));
});
test('wrong character recommendation rejected', () => {
  assert.throws(() => analyzeCharacter(sampleSnapshot, sampleSnapshot.characters[0]!, { ...sampleRecommendation, characterDefinitionId: 'other' }));
});
for (const invalid of [0, -1, 1.5, '60', NaN, Infinity]) {
  test(`reject invalid character level ${invalid}`, () => {
    const data = fresh(); (data.characters[0]!.level as { value: unknown }).value = invalid;
    assert.throws(() => validateSnapshot(data));
  });
}
test('zero echo level accepted', () => assert.doesNotThrow(() => validateSnapshot(fresh())));
test('reject unknown schema, malformed JSON, extra fields and invalid confidence', () => {
  assert.throws(() => parseSnapshot('{'));
  assert.throws(() => validateSnapshot({ ...fresh(), schemaVersion: 2 }));
  assert.throws(() => validateSnapshot({ ...fresh(), password: 'synthetic' }));
  const data = fresh(); data.characters[0]!.level.confidence = 1.1;
  assert.throws(() => validateSnapshot(data));
});
test('reject duplicate IDs and missing weapon/echo references', () => {
  const duplicate = fresh(); duplicate.characters.push(structuredClone(duplicate.characters[0]!));
  assert.throws(() => validateSnapshot(duplicate));
  const data = fresh(); data.weapons = [];
  assert.throws(() => validateSnapshot(data));
  const echoes = fresh(); echoes.echoes = [];
  assert.throws(() => validateSnapshot(echoes));
});
test('reject double equipment and excessive slots', () => {
  const data = fresh(); data.characters.push({ ...structuredClone(data.characters[0]!), id: 'character-2' });
  assert.throws(() => validateSnapshot(data));
  const slots = fresh(); slots.characters[0]!.echoIds = Array(6).fill('echo-1');
  assert.throws(() => validateSnapshot(slots));
});
test('empty account is valid and recommendation targets must be positive integers', () => {
  assert.doesNotThrow(() => validateSnapshot({ ...fresh(), characters: [], weapons: [], echoes: [] }));
  assert.throws(() => validateRecommendation({ ...sampleRecommendation, characterLevel: -1 }));
});
