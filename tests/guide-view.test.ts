import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combinedProgress, guideFindings } from '../src/guideView.ts';
import { sampleSnapshot } from '../src/sample.ts';
import { sampleGuide } from '../src/sampleGuide.ts';
import { analyzeCharacter } from '../src/analysis.ts';
import { sampleRecommendation } from '../src/sample.ts';
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
