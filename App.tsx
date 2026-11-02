import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { analyzeCharacter } from './src/analysis';
import type { AccountSnapshot, Observation, SkillId } from './src/model';
import { sampleRecommendation, sampleSnapshot } from './src/sample';
import { initializeStore, loadSnapshot } from './src/storage';

const skillNames: Record<SkillId, string> = { basic: '일반 공격', skill: '공명 스킬', liberation: '공명 해방', forte: '공명 회로', intro: '변주 스킬' };
const value = (item?: Observation) => item?.confirmed && item.value !== null ? String(item.value) : '미확인';
type Page = { name: 'list' } | { name: 'detail' | 'analysis'; id: string };
function Screens() {
  const db = useSQLiteContext();
  const [data, setData] = useState<AccountSnapshot>();
  const [error, setError] = useState(false);
  const [page, setPage] = useState<Page>({ name: 'list' });
  const reload = () => { setError(false); loadSnapshot(db).then(setData).catch(() => setError(true)); };
  useEffect(reload, [db]);
  const back = () => setPage(page.name === 'analysis' ? { name: 'detail', id: page.id } : { name: 'list' });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page.name === 'list') return false;
      back(); return true;
    });
    return () => sub.remove();
  }, [page]);
  if (error) return <View style={styles.card}><Text>저장 데이터를 읽지 못했습니다. 원본 데이터는 보존됩니다.</Text><Button title="다시 불러오기" onPress={reload} /></View>;
  if (!data) return <ActivityIndicator accessibilityLabel="저장 데이터 불러오는 중" />;
  const selected = page.name === 'list' ? undefined : data.characters.find(c => c.id === page.id);
  const result = selected?.definitionId === sampleRecommendation.characterDefinitionId ? analyzeCharacter(data, selected, sampleRecommendation) : undefined;
  const summary = (id: string) => {
    const c = data.characters.find(c => c.id === id)!;
    if (c.definitionId !== sampleRecommendation.characterDefinitionId) return '비교 기준 없음';
    const s = analyzeCharacter(data, c, sampleRecommendation).summary;
    return `충족 ${s.met} · 부족 ${s.deficit} · 미확인 ${s.unknown}`;
  };
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.brand}>명조 육성 관리</Text>
    <View style={styles.notice}><Text>샘플 모드 · 합성 계정 데이터</Text><Text>목표값은 테스트용 예시이며 공식 권장 기준이 아닙니다.</Text></View>
    {page.name !== 'list' && <Button title="뒤로" onPress={back} />}
    <Text style={styles.heading}>{page.name === 'list' ? '보유 캐릭터' : page.name === 'detail' ? '캐릭터 상세' : '육성 분석'}</Text>
    {page.name === 'list' ? <>
      {data.characters.length === 0 && <Text>보유 캐릭터가 없습니다.</Text>}
      {data.characters.map(c => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${c.definitionId} 상세 보기`} key={c.id} style={styles.card} onPress={() => setPage({ name: 'detail', id: c.id })}>
        <Text style={styles.title}>{c.definitionId === 'example-resonator' ? '샘플 공명자' : c.definitionId}</Text><Text>레벨 {value(c.level)}</Text><Text>{summary(c.id)}</Text><Text style={styles.link}>상세 보기 →</Text>
      </TouchableOpacity>)}
      <Text>데이터 출처: {data.source.reference}</Text><Text>관찰 시각: {data.source.observedAt}</Text>
    </> : !selected ? <Text>캐릭터를 찾을 수 없습니다.</Text> : page.name === 'detail' ? <>
      <View style={styles.card}><Text style={styles.title}>{selected.definitionId}</Text><Text>캐릭터 레벨: {value(selected.level)}</Text><Text>{summary(selected.id)}</Text></View>
      <View style={styles.card}><Text style={styles.title}>장착 무기</Text><Text>{selected.weaponId === null ? '미장착' : data.weapons.find(w => w.id === selected.weaponId)?.definitionId ?? '미확인'}</Text><Text>레벨: {value(data.weapons.find(w => w.id === selected.weaponId)?.level)}</Text></View>
      <View style={styles.card}><Text style={styles.title}>스킬 육성</Text>{(Object.keys(skillNames) as SkillId[]).map(key => <Text key={key}>{skillNames[key]}: {value(selected.skills[key])}</Text>)}</View>
      <Button title="육성 분석 보기" onPress={() => setPage({ name: 'analysis', id: selected.id })} />
    </> : !result ? <Text>이 캐릭터의 비교 기준이 없습니다.</Text> : <>
      <Text>테스트 기준: {result.recommendationId}</Text>
      {result.findings.map(f => <View style={styles.card} key={f.ruleId}>
        <Text style={styles.title}>{f.ruleId === 'character.level' ? '캐릭터 레벨' : f.ruleId === 'weapon.level' ? '무기 레벨' : skillNames[f.ruleId.replace('skill.', '') as SkillId]}</Text>
        <Text>현재 {f.current ?? '미확인'} / 예시 목표 {f.target}</Text><Text style={f.status === 'deficit' ? styles.deficit : undefined}>{f.status === 'met' ? '충족' : f.status === 'deficit' ? '부족' : '미확인'} · {f.reason}</Text>
      </View>)}
    </>}
  </ScrollView>;
}
export default function App() {
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <SafeAreaProvider><SafeAreaView style={styles.root}>
    {error ? <View style={styles.card}><Text>로컬 저장소를 열지 못했습니다. 앱 데이터를 삭제하지 말고 다시 시도하세요.</Text><Button title="다시 시도" onPress={() => { setError(false); setAttempt(attempt + 1); }} /></View> :
      <SQLiteProvider key={attempt} databaseName="growth.db" onInit={db => initializeStore(db, sampleSnapshot)} onError={() => setError(true)}><Screens /></SQLiteProvider>}
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6fa' }, container: { padding: 20, gap: 16 }, brand: { color: '#314f75', fontSize: 16, fontWeight: '700' },
  heading: { fontSize: 28, fontWeight: '700', color: '#172a43' }, title: { fontSize: 19, fontWeight: '600', marginBottom: 8 },
  card: { padding: 20, borderRadius: 16, backgroundColor: 'white', gap: 7 }, notice: { padding: 16, backgroundColor: '#fff0cc', borderRadius: 12, gap: 5 },
  link: { color: '#245797', marginTop: 8 }, deficit: { color: '#a62e24' },
});
