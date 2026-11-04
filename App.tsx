import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { analyzeCharacter } from './src/analysis';
import type { AccountSnapshot, CharacterBuild, Observation, SkillId } from './src/model';
import { sampleRecommendation, sampleSnapshot } from './src/sample';
import { initializeStore, loadSnapshot } from './src/storage';
import { DataManager } from './src/DataManager';

const color = { bg: '#0B0B0F', card: '#1B1B24', surface: '#252530', line: '#353544', text: '#F5F5F7', muted: '#A5A5B5', purple: '#A77BFF', green: '#52D99A', red: '#FF8585', yellow: '#F4CD69' };
const skills: Record<SkillId, string> = { basic: '일반 공격', skill: '공명 스킬', liberation: '공명 해방', forte: '공명 회로', intro: '변주 스킬' };
const display = (v?: Observation) => v?.confirmed && v.value !== null ? String(v.value) : '미확인';
const characterName = (c: CharacterBuild) => c.definitionId === 'example-resonator' ? '샘플 공명자' : c.definitionId;
type Page = { name: 'list' } | { name: 'manage' } | { name: 'detail' | 'analysis'; id: string };
type Result = ReturnType<typeof analyzeCharacter>;
function Button({ title, onPress, secondary = false }: { title: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[s.button, secondary && s.secondary]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text></Pressable>;
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
  return <ScrollView contentContainerStyle={s.container}>
    {page.name === 'list' ? <View><Text style={s.brand}>명조 육성 관리</Text><Text style={s.caption}>WUTHERING WAVES  ·  GROWTH TRACKER</Text></View> : <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={back} style={s.back}><Text style={s.backText}>‹</Text><Text style={s.heading}>{page.name === 'detail' ? '캐릭터 상세' : '육성 분석'}</Text></Pressable>}
    <View style={s.notice}><Text style={s.noticeIcon}>ⓘ</Text><View style={s.flex}><Text style={s.noticeTitle}>{data.source.method === 'sample' ? '샘플 데이터로 실행 중' : '사용자 데이터 사용 중'}</Text><Text style={s.muted}>육성 목표는 테스트용 예시이며 공식 권장 기준이 아닙니다.</Text></View></View>
    {page.name === 'list' ? <>
      <Button title="데이터 관리 · JSON 가져오기" onPress={() => setPage({ name: 'manage' })} />
      <Text style={s.heading}>보유 캐릭터 <Text style={s.count}>({data.characters.length})</Text></Text>
      {data.characters.length === 0 && <Text style={s.muted}>보유 캐릭터가 없습니다.</Text>}
      {data.characters.map(c => <Pressable accessibilityRole="button" accessibilityLabel={`${characterName(c)} 상세 보기`} key={c.id} style={s.card} onPress={() => setPage({ name: 'detail', id: c.id })}>
        <View style={s.row}><Portrait /><View style={s.flex}><Text style={s.title}>{characterName(c)}</Text><Text style={s.muted}>Lv. {display(c.level)}</Text><Text style={s.link}>상세 보기  ›</Text></View></View><Progress result={analysis(c)} />
      </Pressable>)}
      <Text style={s.caption}>데이터 출처: {data.source.reference}{'\n'}관찰 시각: {data.source.observedAt}</Text>
    </> : !selected ? <Text style={s.body}>캐릭터를 찾을 수 없습니다.</Text> : page.name === 'detail' ? <>
      <View style={[s.card, s.row]}><Portrait /><View style={s.flex}><Text style={s.title}>{characterName(selected)}</Text><Text style={s.muted}>캐릭터 레벨  {display(selected.level)}</Text></View></View>
      <Text style={s.heading}>장착 무기</Text><View style={s.card}><Text style={s.title}>{selected.weaponId === null ? '미장착' : data.weapons.find(w => w.id === selected.weaponId)?.definitionId ?? '미확인'}</Text><Text style={s.muted}>레벨  {display(data.weapons.find(w => w.id === selected.weaponId)?.level)}</Text></View>
      <Text style={s.heading}>스킬 레벨</Text><View style={s.card}>{(Object.keys(skills) as SkillId[]).map(key => <View style={s.detailRow} key={key}><Text style={s.body}>{skills[key]}</Text><Text style={s.value}>{display(selected.skills[key])}</Text></View>)}</View>
      <Text style={s.heading}>육성 상태 요약</Text><View style={s.card}><Progress result={result} /></View>
      <Button title="육성 분석 보기  ›" onPress={() => setPage({ name: 'analysis', id: selected.id })} />
    </> : <>
      <View style={[s.card, s.row]}><Portrait /><View style={s.flex}><Text style={s.title}>{characterName(selected)}</Text><Text style={s.muted}>Lv. {display(selected.level)}</Text></View></View>
      {!result ? <Text style={s.muted}>이 캐릭터의 비교 기준이 없습니다.</Text> : <>
        <Text style={s.heading}>분석 결과</Text><View style={s.card}><Text style={s.body}>테스트 기준으로 비교한 결과입니다.</Text><Progress result={result} /></View>
        <Text style={s.heading}>항목별 상세</Text><View style={s.card}>{result.findings.map(f => <View style={s.finding} key={f.ruleId}>
          <View style={s.between}><Text style={[s.body, s.flex]}>{f.ruleId === 'character.level' ? '캐릭터 레벨' : f.ruleId === 'weapon.level' ? '무기 레벨' : skills[f.ruleId.replace('skill.', '') as SkillId] ?? f.ruleId}</Text><Text style={[s.status, { color: f.status === 'met' ? color.green : f.status === 'deficit' ? color.red : color.yellow }]}>{f.status === 'met' ? '충족' : f.status === 'deficit' ? '부족' : '미확인'}</Text></View>
          <Text style={s.muted}>현재 {f.current ?? '미확인'} / 예시 목표 {f.target}</Text><Text style={s.caption}>{f.reason}</Text>
        </View>)}</View>
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
