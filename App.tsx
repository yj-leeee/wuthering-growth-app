import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { analyzeCharacter } from './src/analysis';
import type { AccountSnapshot, CharacterBuild, Observation, SkillId } from './src/model';
import { sampleRecommendation, sampleSnapshot } from './src/sample';
import { initializeStore, loadSnapshot } from './src/storage';
import { DataManager } from './src/DataManager';
import { GuidePanel } from './src/GuidePanel';
import type { Guide } from './src/guide';
import { combinedProgress, guideFindings } from './src/guideView';

const color = { bg: '#0B0B0F', card: '#1B1B24', surface: '#252530', line: '#353544', text: '#F5F5F7', muted: '#A5A5B5', purple: '#A77BFF', green: '#52D99A', red: '#FF8585', yellow: '#F4CD69' };
const skills: Record<SkillId, string> = { basic: '일반 공격', skill: '공명 스킬', liberation: '공명 해방', forte: '공명 회로', intro: '변주 스킬' };
const display = (v?: Observation) => v?.confirmed && v.value !== null ? String(v.value) : '미확인';
const characterName = (c: CharacterBuild) => c.definitionId === 'example-resonator' ? '샘플 공명자' : c.definitionId;
type Page = { name: 'list' } | { name: 'manage' } | { name: 'detail' | 'analysis'; id: string };
type Result = ReturnType<typeof analyzeCharacter>;
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && {opacity: 0.5}]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text></Pressable>;
}
function Progress({ result }: { result?: Result }) {
  if (!result) return <Text style={s.muted}>비교 기준 없음</Text>;
  const { met, deficit, unknown } = result.summary;
  const known = met + deficit;
  const percent = known ? Math.round(met / known * 100) : null;
  return <View style={s.progressWrap}>
    <View style={s.between}><Text style={s.muted}>확인된 목표 달성률</Text><Text style={s.value}>{percent === null ? '미확인' : `${percent}%`}</Text></View>
    <View accessibilityRole="progressbar" accessibilityLabel={percent === null ? '확인된 목표 없음' : `확인된 목표 달성률 ${percent}%`} style={s.track}>{percent !== null && <View style={[s.fill, { width: `${percent}%` }]} />}</View>
    <Text style={s.caption}>충족 {met} · 부족 {deficit} · 미확인 {unknown}  |  미확인 항목은 계산에서 제외</Text>
  </View>;
}
function Portrait() { return <View style={s.portrait}><Text style={s.portraitText}>✦</Text></View>; }
function Screens() {
  const db = useSQLiteContext();
  const [data, setData] = useState<AccountSnapshot>();
  const [error, setError] = useState(false);
  const [page, setPage] = useState<Page>({ name: 'list' });
  const [guide, setGuide] = useState<Guide | null>(null);
  const [guideReady, setGuideReady] = useState(false);
  const onGuideSelected = useCallback((selected: Guide | null) => setGuide(selected), []);
  const onGuideReady = useCallback((ready: boolean) => setGuideReady(ready), []);
  const reload = () => { setError(false); loadSnapshot(db).then(setData).catch(() => setError(true)); };
  useEffect(reload, [db]);
  const back = () => setPage(page.name === 'analysis' ? { name: 'detail', id: page.id } : { name: 'list' });
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (page.name === 'list') return false; back(); return true; }); return () => sub.remove(); }, [page]);
  if (error) return <View style={s.center}><Text style={s.body}>저장 데이터를 읽지 못했습니다. 원본 데이터는 보존됩니다.</Text><Button title="다시 불러오기" onPress={reload} /></View>;
  if (!data) return <View style={s.center}><ActivityIndicator color={color.purple} accessibilityLabel="저장 데이터 불러오는 중" /></View>;
  if (page.name === 'manage') return <DataManager db={db} onBack={() => setPage({ name: 'list' })} onChanged={setData} />;
  const selected = page.name === 'list' ? undefined : data.characters.find(c => c.id === page.id);
  const analysis = (c: CharacterBuild) => c.definitionId === sampleRecommendation.characterDefinitionId ? analyzeCharacter(data, c, sampleRecommendation) : undefined;
  const result = selected ? analysis(selected) : undefined;
  const activeGuide = selected && guide?.characterDefinitionId === selected.definitionId ? guide : null;
  const extra = selected ? guideFindings(data, selected, activeGuide) : [];
  const total = combinedProgress(result?.findings ?? [], extra);
  return <ScrollView contentContainerStyle={s.container}>
    {page.name === 'list' ? <View><Text style={s.brand}>명조 육성 관리</Text><Text style={s.caption}>WUTHERING WAVES  ·  GROWTH TRACKER</Text></View> : <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={back} style={s.back}><Text style={s.backText}>‹</Text><Text style={s.heading}>{page.name === 'detail' ? '캐릭터 상세' : '육성 분석'}</Text></Pressable>}
    <View style={s.notice}><Text style={s.noticeIcon}>ⓘ</Text><View style={s.flex}><Text style={s.noticeTitle}>{data.source.method === 'sample' ? '샘플 데이터로 실행 중' : '사용자 데이터 사용 중'}</Text><Text style={s.muted}>테스트 가이드와 기본 예시 목표는 공식 권장 기준이 아닙니다.</Text></View></View>
    {page.name === 'list' ? <>
      <Button title="데이터 관리 · JSON 가져오기" onPress={() => setPage({ name: 'manage' })} />
      <Text style={s.heading}>보유 캐릭터 <Text style={s.count}>({data.characters.length})</Text></Text>
      {data.characters.length === 0 && <Text style={s.muted}>보유 캐릭터가 없습니다.</Text>}
      {data.characters.map(c => <Pressable accessibilityRole="button" accessibilityLabel={`${characterName(c)} 상세 보기`} key={c.id} style={s.card} onPress={() => { setGuide(null); setGuideReady(false); setPage({ name: 'detail', id: c.id }); }}>
        <View style={s.row}><Portrait /><View style={s.flex}><Text style={s.title}>{characterName(c)}</Text><Text style={s.muted}>Lv. {display(c.level)}</Text><Text style={s.link}>상세 보기  ›</Text></View></View><Progress result={analysis(c)} />
      </Pressable>)}
      <Text style={s.caption}>데이터 출처: {data.source.reference}{'\n'}관찰 시각: {data.source.observedAt}</Text>
    </> : !selected ? <Text style={s.body}>캐릭터를 찾을 수 없습니다.</Text> : page.name === 'detail' ? <>
      <View style={[s.card, s.row]}><Portrait /><View style={s.flex}><Text style={s.title}>{characterName(selected)}</Text><Text style={s.muted}>캐릭터 레벨  {display(selected.level)}</Text></View></View>
      <Text style={s.heading}>장착 무기</Text><View style={s.card}><Text style={s.title}>{selected.weaponId === null ? '미장착' : data.weapons.find(w => w.id === selected.weaponId)?.definitionId ?? '미확인'}</Text><Text style={s.muted}>레벨  {display(data.weapons.find(w => w.id === selected.weaponId)?.level)}</Text></View>
      <Text style={s.heading}>스킬 레벨</Text><View style={s.card}>{(Object.keys(skills) as SkillId[]).map(key => <View style={s.detailRow} key={key}><Text style={s.body}>{skills[key]}</Text><Text style={s.value}>{display(selected.skills[key])}</Text></View>)}</View>
      <Text style={s.heading}>육성 상태 요약</Text><View style={s.card}><Progress result={result} /></View>
      <GuidePanel db={db} characterId={selected.definitionId} onSelected={onGuideSelected} onReady={onGuideReady} />
      <Button title={guideReady ? '육성 분석 보기  ›' : '가이드 확인 중…'} disabled={!guideReady} onPress={() => setPage({ name: 'analysis', id: selected.id })} />
    </> : <>
      <View style={[s.card, s.row]}><Portrait /><View style={s.flex}><Text style={s.title}>{characterName(selected)}</Text><Text style={s.muted}>Lv. {display(selected.level)}</Text></View></View>
      {!result && !activeGuide ? <Text style={s.muted}>이 캐릭터의 비교 기준이 없습니다.</Text> : <>
        <Text style={s.heading}>분석 결과</Text>{result && <View style={s.card}><Text style={s.body}>기본 육성은 테스트 기준으로 비교합니다.</Text><Progress result={result} /></View>}
        <Text style={s.heading}>전체 확인 항목</Text><View style={s.card}><Text style={s.body}>기본 레벨 비교와 선택 가이드의 에코·스탯 비교를 합산합니다.</Text><Text style={s.value}>{total.percent === null ? '미확인' : `${total.percent}%`}</Text><Text style={s.muted}>충족 {total.met} · 부족 {total.deficit} · 미확인 {total.unknown} · 기준 없음 {total.noCriterion}</Text><Text style={s.caption}>미확인과 기준 없음은 분모에서 제외합니다. 서로 다른 영역의 항목을 각각 한 번 계산합니다.</Text></View>
        <Text style={s.heading}>부족 항목 요약</Text><View style={s.card}>{total.deficit === 0 ? <Text style={s.muted}>확인된 부족 항목이 없습니다. 미확인 항목은 별도 확인이 필요합니다.</Text> : <>{result?.findings.filter(f => f.status === 'deficit').map(f => <Text style={s.body} key={`basic-${f.ruleId}`}>• 기본 육성: {f.ruleId}</Text>)}{extra.filter(f => f.status === 'deficit').map((f, i) => <Text style={s.body} key={`guide-${i}`}>• {f.label}{f.priority !== undefined ? ` · 가이드 우선순위 ${f.priority}` : ''}</Text>)}</>}</View>
        {result && <><Text style={s.heading}>기본 육성 상세 · 테스트 기준</Text><View style={s.card}>{result.findings.map(f => <View style={s.finding} key={f.ruleId}>
          <View style={s.between}><Text style={[s.body, s.flex]}>{f.ruleId === 'character.level' ? '캐릭터 레벨' : f.ruleId === 'weapon.level' ? '무기 레벨' : skills[f.ruleId.replace('skill.', '') as SkillId] ?? f.ruleId}</Text><Text style={[s.status, { color: f.status === 'met' ? color.green : f.status === 'deficit' ? color.red : color.yellow }]}>{f.status === 'met' ? '충족' : f.status === 'deficit' ? '부족' : '미확인'}</Text></View>
          <Text style={s.muted}>현재 {f.current ?? '미확인'} / 예시 목표 {f.target}</Text><Text style={s.caption}>{f.reason}</Text>
        </View>)}</View></>}
        {activeGuide && <><Text style={s.heading}>에코 · 스탯 분석 · {activeGuide.name}</Text><View style={s.card}><Text style={s.caption}>출처 유형: {activeGuide.origin === 'sample' ? '합성 테스트' : activeGuide.origin === 'official-community' ? '공식 서비스 이용자 기여' : activeGuide.origin === 'developer' ? '개발사 제공' : '이용자 기여'}</Text>{extra.map((f, i) => <View style={s.finding} key={`${i}-${f.label}`}><View style={s.between}><Text style={[s.body, s.flex]}>{f.label}</Text><Text style={[s.status, {color: f.status === 'met' ? color.green : f.status === 'deficit' ? color.red : color.yellow}]}>{f.status === 'met' ? '충족' : f.status === 'deficit' ? '부족' : f.status === 'unknown' ? '미확인' : '기준 없음'}</Text></View><Text style={s.muted}>{f.detail}</Text>{f.priority !== undefined && <Text style={s.caption}>가이드 명시 우선순위: {f.priority}</Text>}</View>)}{!extra.length && <Text style={s.muted}>비교할 에코·스탯 기준이 없습니다.</Text>}</View></>}
      </>}
    </>}
  </ScrollView>;
}
export default function App() {
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0);
  return <SafeAreaProvider><SafeAreaView style={s.root}><StatusBar barStyle="light-content" />
    {error ? <View style={s.center}><Text style={s.body}>로컬 저장소를 열지 못했습니다. 앱 데이터를 삭제하지 말고 다시 시도하세요.</Text><Button title="다시 시도" onPress={() => { setError(false); setAttempt(attempt + 1); }} /></View> : <SQLiteProvider key={attempt} databaseName="growth.db" onInit={db => initializeStore(db, sampleSnapshot)} onError={() => setError(true)}><Screens /></SQLiteProvider>}
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg }, container: { padding: 20, paddingBottom: 40, gap: 16 }, center: { flex: 1, justifyContent: 'center', padding: 24, gap: 18 },
  brand: { fontSize: 25, fontWeight: '700', color: color.text }, heading: { color: color.text, fontSize: 20, fontWeight: '700', marginTop: 8 }, count: { color: color.purple },
  title: { color: color.text, fontSize: 18, fontWeight: '700' }, body: { color: color.text, fontSize: 15, lineHeight: 23 }, muted: { color: color.muted, fontSize: 14, lineHeight: 21 }, caption: { color: color.muted, fontSize: 12, lineHeight: 19 }, value: { color: color.text, fontSize: 15, fontWeight: '700' }, link: { color: color.purple, fontSize: 13, marginTop: 7 },
  card: { backgroundColor: color.card, borderColor: color.line, borderWidth: 1, borderRadius: 15, padding: 16, gap: 12 }, notice: { flexDirection: 'row', gap: 12, backgroundColor: color.surface, borderColor: color.line, borderWidth: 1, borderRadius: 14, padding: 16 }, noticeIcon: { color: color.purple, fontSize: 21 }, noticeTitle: { color: color.text, fontWeight: '700', marginBottom: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 15 }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, flex: { flex: 1 }, portrait: { height: 72, width: 72, borderRadius: 12, borderWidth: 1, borderColor: '#645182', backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }, portraitText: { color: color.purple, fontSize: 30 },
  progressWrap: { gap: 8, marginTop: 5 }, track: { height: 9, borderRadius: 8, backgroundColor: '#353543', overflow: 'hidden' }, fill: { height: '100%', borderRadius: 8, backgroundColor: color.purple }, detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 38, gap: 12 }, finding: { paddingVertical: 10, gap: 5, borderBottomWidth: 1, borderBottomColor: color.line }, status: { fontSize: 14, fontWeight: '700' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 14 }, backText: { color: color.text, fontSize: 36 }, button: { minHeight: 52, borderRadius: 13, backgroundColor: color.purple, alignItems: 'center', justifyContent: 'center', padding: 12 }, buttonText: { color: '#1B1030', fontWeight: '700', fontSize: 16 }, secondary: { backgroundColor: color.surface }, secondaryText: { color: color.text },
});
