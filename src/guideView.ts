import { analyzeGuide } from './guide.ts';
import type { Guide, GuideFinding } from './guide.ts';
import type { AccountSnapshot, CharacterBuild } from './model.ts';
import type { Finding } from './model.ts';

export function guideFindings(snapshot: AccountSnapshot, character: CharacterBuild, guide: Guide | null): GuideFinding[] {
  return guide ? analyzeGuide(snapshot, character, guide) : [];
}
export function echoSectionNotice(character: CharacterBuild, guide: Guide | null): string[] {
  const messages: string[] = [];
  if (!guide) messages.push('가이드를 선택하면 에코·스탯 기준을 비교할 수 있습니다.');
  if (!character.echoIds || character.echoIds.length === 0) messages.push(character.echoesComplete ? '장착된 에코가 없습니다.' : '에코 데이터가 등록되지 않았거나 미확인입니다.');
  return messages;
}
/** Basic level rules and guide equipment/stat rules are separate domains. */
export function combinedProgress(basic: Finding[], guide: GuideFinding[]) {
  const statuses = [...basic.map(f => f.status), ...guide.map(f => f.status)];
  const met = statuses.filter(s => s === 'met').length;
  const deficit = statuses.filter(s => s === 'deficit').length;
  const unknown = statuses.filter(s => s === 'unknown').length;
  const noCriterion = statuses.filter(s => s === 'no_criterion').length;
  return { met, deficit, unknown, noCriterion, percent: met + deficit ? Math.round(met * 100 / (met + deficit)) : null };
}
