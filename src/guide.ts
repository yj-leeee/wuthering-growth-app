import type { AccountSnapshot, CharacterBuild, Stat, SkillId } from './model.ts';

export type Unit = 'flat' | 'percent';
export type StatTarget = { key: string; unit: Unit; min?: number; max?: number; priority?: number };
export type Guide = {
  id: string; characterDefinitionId: string; name: string;
  origin: 'developer' | 'official-community' | 'community' | 'sample';
  author?: string; reference?: string; url?: string; gameVersion?: string;
  createdAt?: string; updatedAt?: string; checkedAt?: string; role?: string;
  description?: string; cautions?: string;
  weapons?: string[]; skillPriority?: SkillId[];
  sets?: { setId: string; pieces: number }[];
  mainStatsByCost?: { cost: 1 | 3 | 4; allowed: string[] }[];
  subStats?: StatTarget[]; characterStats?: StatTarget[];
};
export type GuideFinding = { label: string; status: 'met' | 'deficit' | 'unknown' | 'no_criterion'; detail: string; priority?: number };

export function validateGuide(value: unknown): Guide {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('가이드가 객체여야 합니다.');
  const x = value as Record<string, unknown>;
  const allowed = ['id','characterDefinitionId','name','origin','author','reference','url','gameVersion','createdAt','updatedAt','checkedAt','role','description','cautions','weapons','skillPriority','sets','mainStatsByCost','subStats','characterStats'];
  if (Object.keys(x).some(k => !allowed.includes(k))) throw new Error('알 수 없는 가이드 항목입니다.');
  for (const key of ['id','characterDefinitionId','name']) if (typeof x[key] !== 'string' || !(x[key] as string).trim()) throw new Error(`${key} 확인 필요`);
  if (!['developer','official-community','community','sample'].includes(x.origin as string)) throw new Error('가이드 출처 유형 확인 필요');
  for (const key of ['author','reference','url','gameVersion','createdAt','updatedAt','checkedAt','role','description','cautions']) if (x[key] !== undefined && (typeof x[key] !== 'string' || !(x[key] as string).trim())) throw new Error(`${key} 확인 필요`);
  for (const key of ['weapons','skillPriority']) if (x[key] !== undefined && (!Array.isArray(x[key]) || !(x[key] as unknown[]).every(v => typeof v === 'string' && v.length > 0))) throw new Error(`${key} 확인 필요`);
  if (Array.isArray(x.skillPriority) && x.skillPriority.some(v => !['basic','skill','liberation','forte','intro'].includes(v))) throw new Error('스킬 항목 확인 필요');
  const objects = (key: string, check: (v: Record<string, unknown>) => boolean) => {
    if (x[key] !== undefined && (!Array.isArray(x[key]) || !(x[key] as unknown[]).every(v => !!v && typeof v === 'object' && !Array.isArray(v) && check(v as Record<string, unknown>)))) throw new Error(`${key} 확인 필요`);
  };
  const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  objects('sets', v => Object.keys(v).every(k => ['setId','pieces'].includes(k)) && typeof v.setId === 'string' && !!v.setId && Number.isSafeInteger(v.pieces) && (v.pieces as number) > 0 && (v.pieces as number) <= 5);
  objects('mainStatsByCost', v => Object.keys(v).every(k => ['cost','allowed'].includes(k)) && [1,3,4].includes(v.cost as number) && Array.isArray(v.allowed) && v.allowed.length > 0 && v.allowed.every(k => typeof k === 'string' && !!k));
  for (const key of ['subStats','characterStats']) objects(key, v => Object.keys(v).every(k => ['key','unit','min','max','priority'].includes(k)) && typeof v.key === 'string' && !!v.key && ['flat','percent'].includes(v.unit as string) && (v.min === undefined || number(v.min)) && (v.max === undefined || number(v.max)) && (v.priority === undefined || (Number.isSafeInteger(v.priority) && (v.priority as number) > 0)) && (v.min === undefined || v.max === undefined || (v.min as number) <= (v.max as number)));
  const guide = value as Guide;
  const unique = (values: (string | number)[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`${label} 중복 또는 상충`);
  };
  unique((guide.sets ?? []).map(v => v.setId), '세트');
  if ((guide.sets ?? []).reduce((sum, v) => sum + v.pieces, 0) > 5) throw new Error('세트 조건의 합이 5개를 초과합니다.');
  unique((guide.mainStatsByCost ?? []).map(v => v.cost), '코스트별 주옵션');
  for (const rule of guide.mainStatsByCost ?? []) unique(rule.allowed, '추천 주옵션');
  for (const [label, rules] of [['부옵션', guide.subStats], ['캐릭터 스탯', guide.characterStats]] as const) unique((rules ?? []).map(v => v.key), label);
  unique(guide.weapons ?? [], '무기');
  unique(guide.skillPriority ?? [], '스킬');
  return value as Guide;
}

function compare(target: StatTarget, actual: Stat | undefined, missingKnown: boolean): GuideFinding {
  const label = target.key;
  if (!actual) return { label, status: missingKnown ? 'deficit' : 'unknown', detail: missingKnown ? '확인된 목록에 없음' : '값 미확인', priority: target.priority };
  if (actual.unit !== target.unit || !actual.value.confirmed || actual.value.value === null) return { label, status: 'unknown', detail: '단위 또는 값 미확인', priority: target.priority };
  const v = actual.value.value;
  if (target.min === undefined && target.max === undefined) return { label, status: 'no_criterion', detail: `추천 항목 일치 · ${v} ${target.unit} · 수치 기준 없음`, priority: target.priority };
  const ok = (target.min === undefined || v >= target.min) && (target.max === undefined || v <= target.max);
  return { label, status: ok ? 'met' : 'deficit', detail: `현재 ${v} ${target.unit} · 목표 ${target.min ?? '제한 없음'} ~ ${target.max ?? '제한 없음'}`, priority: target.priority };
}
export function analyzeGuide(snapshot: AccountSnapshot, character: CharacterBuild, guide: Guide): GuideFinding[] {
  if (character.definitionId !== guide.characterDefinitionId) throw new Error('다른 캐릭터의 가이드입니다.');
  if (guide.gameVersion && guide.gameVersion !== snapshot.source.gameVersion) return [{ label: '게임 버전', status: 'unknown', detail: '가이드와 관찰 버전이 다릅니다.' }];
  const out: GuideFinding[] = [];
  const echoes = (character.echoIds ?? []).map(id => snapshot.echoes.find(e => e.id === id)).filter(e => e !== undefined);
  for (const rule of guide.sets ?? []) {
    const count = echoes.filter(e => e.setId === rule.setId).length;
    const unknown = !character.echoesComplete || !character.echoIds || echoes.some(e => e.setId === null);
    out.push({ label: `세트 ${rule.setId}`, status: count >= rule.pieces ? 'met' : unknown ? 'unknown' : 'deficit', detail: `${count} / ${rule.pieces}개 · ${unknown ? '일부 미확인' : '목록 확인됨'}` });
  }
  for (const echo of echoes) {
    const rule = guide.mainStatsByCost?.find(r => r.cost === echo.cost);
    const matched = rule && echo.mainStats.some(st => rule.allowed.includes(st.key) && st.value.confirmed && st.value.value !== null);
    out.push({ label: `에코 ${echo.id} · COST ${echo.cost} 주옵션`, status: !rule ? 'no_criterion' : matched ? 'met' : echo.mainStatsComplete && echo.mainStats.every(st => st.value.confirmed && st.value.value !== null) ? 'deficit' : 'unknown', detail: !rule ? '추천 기준 없음' : matched ? '추천 항목 일치' : echo.mainStatsComplete ? '확인된 옵션과 추천 기준 비교' : '주옵션 미확인' });
    for (const target of guide.subStats ?? []) out.push({ ...compare(target, echo.subStats.find(st => st.key === target.key), echo.subStatsComplete === true), label: `${echo.id} · ${target.key}` });
  }
  if (!character.echoesComplete) out.push({ label: '장착 에코 목록', status: 'unknown', detail: '장착 슬롯 전체 확인 여부가 없습니다.' });
  for (const target of guide.characterStats ?? []) out.push(compare(target, character.stats?.find(st => st.key === target.key), false));
  if (!guide.sets?.length && !guide.mainStatsByCost?.length && !guide.subStats?.length && !guide.characterStats?.length) out.push({ label: '에코·스탯', status: 'no_criterion', detail: '등록된 기준이 없습니다.' });
  return out;
}
