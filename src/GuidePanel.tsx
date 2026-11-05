import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Guide } from './guide';
import type { Database } from './storage';
import { listGuides, loadSelectedGuide, saveGuide, selectGuide } from './storage';
import { sampleGuide } from './sampleGuide';

export function GuidePanel({ db, characterId, onSelected, onReady }: { db: Database; characterId: string; onSelected: (guide: Guide | null) => void; onReady: (ready: boolean) => void }) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selected, setSelected] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const [items, current] = await Promise.all([listGuides(db, characterId), loadSelectedGuide(db, characterId)]);
    setGuides(items); setSelected(current); onSelected(current);
  }, [db, characterId, onSelected]);
  useEffect(() => { let alive = true; setLoading(true); setError(''); onReady(false); onSelected(null);
    Promise.all([listGuides(db, characterId), loadSelectedGuide(db, characterId)]).then(([items, current]) => {
      if (alive) { setGuides(items); setSelected(current); onSelected(current); }
    }).catch(() => { if (alive) setError('가이드 목록을 불러오지 못했습니다.'); }).finally(() => { if (alive) { setLoading(false); onReady(true); } });
    return () => { alive = false; };
  }, [db, characterId, onSelected, onReady]);
  const choose = async (guide: Guide) => { setBusy(true); onReady(false); setError(''); try { await selectGuide(db, characterId, guide.id); setSelected(guide); onSelected(guide); } catch { setError('가이드 선택을 저장하지 못했습니다. 이전 선택을 유지합니다.'); } finally { setBusy(false); onReady(true); } };
  const addSample = async () => { setBusy(true); onReady(false); setError(''); try { await saveGuide(db, sampleGuide); await refresh(); } catch { setError('테스트 가이드를 등록하지 못했습니다.'); } finally { setBusy(false); onReady(true); } };
  const none = (items?: string[]) => items?.length ? items.join(' · ') : '기준 없음';
  const range = (min?: number, max?: number) => min === undefined && max === undefined ? '수치 기준 없음' : `${min ?? '제한 없음'} ~ ${max ?? '제한 없음'}`;
  const origin = (guide: Guide) => ({sample:'테스트용', developer:'개발사 제공', 'official-community':'공식 서비스 이용자 기여', community:'이용자 기여'}[guide.origin]);
  return <View style={s.card}>
    <Text style={s.title}>육성 가이드 선택</Text>
    {loading ? <ActivityIndicator color="#A77BFF" /> : <>
      {!!error && <Text accessibilityLiveRegion="polite" style={s.warning}>{error}</Text>}
      {!!error && <Pressable accessibilityRole="button" style={s.option} onPress={() => { setLoading(true); refresh().then(() => setError('')).catch(() => setError('가이드 목록을 불러오지 못했습니다.')).finally(() => setLoading(false)); }}><Text style={s.link}>다시 불러오기</Text></Pressable>}
      {!guides.length && <Text style={s.text}>등록된 가이드가 없습니다. 기본 육성 분석은 그대로 이용할 수 있습니다.</Text>}
      {guides.map(g => <Pressable key={g.id} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: selected?.id === g.id, disabled: busy }} style={s.option} onPress={() => choose(g)}>
        <Text style={s.title}>{selected?.id === g.id ? '● ' : '○ '}{g.name}</Text><Text style={s.text}>작성자: {g.author ?? '미확인'} · 출처: {origin(g)}</Text><Text style={s.text}>게임 버전: {g.gameVersion ?? '미확인'}</Text>
      </Pressable>)}
      {characterId === sampleGuide.characterDefinitionId && !guides.some(g => g.id === sampleGuide.id) && <Pressable disabled={busy} accessibilityRole="button" style={s.option} onPress={addSample}><Text style={s.link}>테스트용 가이드 등록</Text><Text style={s.text}>합성 데이터이며 공식 추천이 아닙니다.</Text></Pressable>}
      {selected && <View style={s.details}>
        <Text style={s.title}>선택 가이드 상세 · {selected.name}</Text>
        <Text style={s.text}>작성자: {selected.author ?? '미확인'} · 출처 유형: {origin(selected)}</Text>
        <Text style={s.text}>출처: {selected.reference ?? '미확인'} · 게임 버전: {selected.gameVersion ?? '미확인'}</Text>
        <Text style={s.text}>원본: {selected.url ?? '미확인'} · 역할: {selected.role ?? '미확인'}</Text>
        <Text style={s.text}>추천 무기: {none(selected.weapons)}</Text>
        <Text style={s.text}>추천 세트: {none(selected.sets?.map(r => `${r.setId} ${r.pieces}개`))}</Text>
        <Text style={s.text}>코스트별 주옵션: {none(selected.mainStatsByCost?.map(r => `${r.cost}C ${r.allowed.join('/')}`))}</Text>
        <Text style={s.text}>추천 부옵션: {none(selected.subStats?.map(r => `${r.key} (${r.unit}, ${range(r.min, r.max)}${r.priority ? `, 우선순위 ${r.priority}` : ''})`))}</Text>
        <Text style={s.text}>캐릭터 스탯: {none(selected.characterStats?.map(r => `${r.key} (${r.unit}, ${range(r.min, r.max)})`))}</Text>
        <Text style={s.text}>스킬 우선순위: {none(selected.skillPriority)}</Text>
        {!!selected.description && <Text style={s.text}>{selected.description}</Text>}{!!selected.cautions && <Text style={s.warning}>{selected.cautions}</Text>}
      </View>}
    </>}
  </View>;
}
const s = StyleSheet.create({ card: { backgroundColor:'#1B1B24', borderColor:'#353544', borderWidth:1, borderRadius:15, padding:16, gap:12 }, title:{color:'#F5F5F7',fontSize:16,fontWeight:'700'}, text:{color:'#C0C0CF',fontSize:14,lineHeight:22}, warning:{color:'#F4CD69',fontSize:14,lineHeight:22}, link:{color:'#A77BFF',fontWeight:'700'}, option:{borderColor:'#494555',borderWidth:1,borderRadius:12,padding:14,gap:5,minHeight:48}, details:{gap:8,borderTopWidth:1,borderTopColor:'#353544',paddingTop:14} });
