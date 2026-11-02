import type { AccountSnapshot, CharacterBuild, Finding, Observation, Recommendation, SkillId } from './model.ts';

export function analyzeCharacter(snapshot: AccountSnapshot, character: CharacterBuild, rule: Recommendation) {
  if (character.definitionId !== rule.characterDefinitionId) throw new Error('추천 기준의 캐릭터가 다르다.');
  const compatible = snapshot.source.gameVersion === rule.gameVersion;
  const findings: Finding[] = [];
  const compare = (ruleId: string, observation: Observation | undefined, target: number) => {
    const known = compatible && observation?.confirmed === true && observation.value !== null;
    const current = known ? observation.value : null;
    findings.push({ ruleId, current, target,
      status: current === null ? 'unknown' : current >= target ? 'met' : 'deficit',
      reason: !compatible ? '게임 버전이 달라 기준 재검토가 필요하다.' : current === null ? '확인된 값이 필요하다.' : current >= target ? '목표를 충족한다.' : '목표보다 낮다.',
    });
  };
  compare('character.level', character.level, rule.characterLevel);
  const weapon = snapshot.weapons.find(item => item.id === character.weaponId);
  compare('weapon.level', character.weaponId === null ? { value: 0, confirmed: true } : weapon?.level, rule.weaponLevel);
  for (const [skill, target] of Object.entries(rule.skills)) {
    compare(`skill.${skill}`, character.skills[skill as SkillId], target);
  }
  return { characterId: character.id, recommendationId: rule.id, exampleOnly: rule.evidence === 'example', findings,
    summary: {
      met: findings.filter(f => f.status === 'met').length,
      deficit: findings.filter(f => f.status === 'deficit').length,
      unknown: findings.filter(f => f.status === 'unknown').length,
    },
  };
}
