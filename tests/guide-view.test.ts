import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combinedProgress, echoSectionNotice, guideFindings } from '../src/guideView.ts';
import { sampleSnapshot } from '../src/sample.ts';
import { sampleGuide } from '../src/sampleGuide.ts';
import { analyzeCharacter } from '../src/analysis.ts';
import { sampleRecommendation } from '../src/sample.ts';
import { readFileSync } from 'node:fs';
import { parseSnapshot } from '../src/validation.ts';
test('no guide yields no extra findings and leaves basic progress intact', () => {
  assert.deepEqual(guideFindings(sampleSnapshot, sampleSnapshot.characters[0]!, null), []);
  assert.deepEqual(combinedProgress([{ruleId:'x',status:'met',current:1,target:1,reason:''}], []), {met:1,deficit:0,unknown:0,noCriterion:0,percent:100});
});
test('sample screen model combines each basic and guide result once', () => {
  const character = sampleSnapshot.characters[0]!;
  const basic = analyzeCharacter(sampleSnapshot, character, sampleRecommendation).findings;
  const guide = guideFindings(sampleSnapshot, character, sampleGuide);
  const total = combinedProgress(basic, guide);
  assert.equal(total.met + total.deficit + total.unknown + total.noCriterion, basic.length + guide.length);
  assert.equal(total.met, 2);
  assert.ok(total.unknown > 0);
});
test('UI view uses analyzer and excludes unknown and criteria-free findings from denominator', () => {
  const findings = guideFindings(sampleSnapshot, sampleSnapshot.characters[0]!, sampleGuide);
  assert.ok(findings.length > 0);
  assert.deepEqual(combinedProgress([], [{label:'a',status:'met',detail:''},{label:'b',status:'deficit',detail:''},{label:'c',status:'unknown',detail:''},{label:'d',status:'no_criterion',detail:''}]), {met:1,deficit:1,unknown:1,noCriterion:1,percent:50});
  assert.equal(combinedProgress([], [{label:'a',status:'unknown',detail:''}]).percent, null);
});
test('screen notices explain missing guide and distinguish empty from unknown echoes', () => {
  const empty = { ...sampleSnapshot.characters[0]!, echoIds: [] };
  assert.match(echoSectionNotice(empty, null).join(' '), /가이드를 선택/);
  assert.match(echoSectionNotice(empty, null).join(' '), /미확인/);
  assert.match(echoSectionNotice({ ...empty, echoesComplete: true }, sampleGuide).join(' '), /장착된 에코가 없습니다/);
});
test('Android input examples validate and echo sample produces all four statuses for screen', () => {
  const input = parseSnapshot(readFileSync('examples/입력 예시.json', 'utf8'));
  assert.equal(input.schemaVersion, 1);
  const data = parseSnapshot(readFileSync('examples/에코 분석 예시.json', 'utf8'));
  const findings = guideFindings(data, data.characters[0]!, sampleGuide);
  assert.deepEqual(new Set(findings.map(f => f.status)), new Set(['met', 'deficit', 'unknown', 'no_criterion']));
  assert.ok(findings.some(f => f.label.includes('COST 4')));
  assert.ok(findings.some(f => f.label.includes('COST 3')));
  assert.ok(findings.some(f => f.label === 'example-attack'));
  assert.deepEqual(echoSectionNotice(data.characters[0]!, sampleGuide), []);
});
