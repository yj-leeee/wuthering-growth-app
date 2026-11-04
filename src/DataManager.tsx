import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { AccountSnapshot } from './model';
import { parseSnapshot } from './validation';
import { findDuplicate, importSnapshot, listSnapshots, selectSnapshot } from './storage';
import type { Database, SnapshotEntry } from './storage';

type Preview = { name: string; size: number; data: AccountSnapshot; duplicate: number | null };
export function DataManager({ db, onBack, onChanged }: { db: Database; onBack: () => void; onChanged: (data: AccountSnapshot) => void }) {
  const [entries, setEntries] = useState<SnapshotEntry[]>([]);
  const [preview, setPreview] = useState<Preview>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => setEntries(await listSnapshots(db));
  useEffect(() => { refresh().catch(() => setMessage('저장된 데이터 목록을 읽지 못했습니다.')); }, [db]);
  const pick = async () => {
    setMessage(''); setPreview(undefined); setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error('선택한 파일을 찾지 못했습니다.');
      const file = new File(asset.uri);
      try {
        const size = file.size;
        if (!Number.isFinite(size) || size <= 0 || size > 1024 * 1024) throw new Error('파일 크기는 1MB 이하여야 합니다.');
        const data = parseSnapshot(await file.text());
        setPreview({ name: asset.name, size, data, duplicate: await findDuplicate(db, data) });
      } finally { try { file.delete(); } catch { /* best effort cache cleanup */ } }
    } catch (error) { setMessage(error instanceof SyntaxError ? 'JSON 문법을 확인해 주세요.' : error instanceof Error ? error.message : '파일을 읽지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const choose = async (id: number) => {
    setBusy(true); setMessage('');
    try { await selectSnapshot(db, id); const list = await listSnapshots(db); setEntries(list); const active = list.find(x => x.active); if (active) onChanged(active.data); setMessage('선택한 스냅샷을 활성화했습니다.'); }
    catch { setMessage('선택을 저장하지 못했습니다. 데이터 목록을 다시 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!preview) return;
    setBusy(true); setMessage('');
    try {
      const result = await importSnapshot(db, preview.data);
      if (result.duplicate) { setPreview({ ...preview, duplicate: result.id }); setMessage('이미 저장된 스냅샷입니다. 기존 항목을 선택할 수 있습니다.'); }
      else { onChanged(preview.data); setPreview(undefined); setMessage('새 스냅샷을 저장하고 활성화했습니다.'); await refresh(); }
    } catch { setMessage('저장 또는 목록 갱신에 실패했습니다. 데이터 관리 화면을 다시 열어 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  const button = (label: string, action: () => void) => <Pressable disabled={busy} accessibilityRole="button" style={[s.button, busy && { opacity: 0.5 }]} onPress={action}><Text style={s.buttonText}>{label}</Text></Pressable>;
  return <ScrollView contentContainerStyle={s.container}>
    {button('‹  돌아가기', onBack)}<Text style={s.heading}>데이터 관리</Text>
    <Text style={s.text}>스냅샷은 서로 합치지 않고 따로 보관합니다. 선택한 스냅샷을 기준으로 화면이 표시됩니다.</Text>
    {button('JSON 파일 선택', pick)}{!!message && <Text accessibilityLiveRegion="polite" style={s.notice}>{message}</Text>}{busy && <ActivityIndicator color="#A77BFF" />}
    {preview && <View style={s.card}><Text style={s.title}>가져오기 미리보기</Text><Text style={s.text}>파일: {preview.name} ({preview.size} bytes)</Text><Text style={s.text}>출처: {preview.data.source.reference}</Text><Text style={s.text}>게임 버전: {preview.data.source.gameVersion}</Text><Text style={s.text}>관찰 시각: {preview.data.source.observedAt}</Text><Text style={s.text}>캐릭터 {preview.data.characters.length} · 무기 {preview.data.weapons.length} · 에코 {preview.data.echoes.length}</Text>
      {preview.data.characters.map(c => <Text style={s.text} key={c.id}>• {c.definitionId} · Lv. {c.level.confirmed && c.level.value !== null ? c.level.value : '미확인'}</Text>)}
      <Text style={s.notice}>{preview.duplicate === null ? '새 스냅샷으로 저장하고 활성화합니다. 기존 데이터는 유지됩니다.' : '동일한 스냅샷이 이미 저장되어 있습니다.'}</Text>
      {preview.duplicate === null ? button('저장 및 활성화', save) : button('기존 스냅샷 선택', () => choose(preview.duplicate!))}
    </View>}
    <Text style={s.heading}>저장된 스냅샷</Text>
    {entries.map(entry => <View style={s.card} key={entry.id}><Text style={s.title}>{entry.active ? '● 사용 중' : '○ 저장됨'} · {entry.data.source.reference}</Text><Text style={s.text}>게임 버전: {entry.data.source.gameVersion}</Text><Text style={s.text}>관찰: {entry.data.source.observedAt}</Text><Text style={s.text}>저장: {entry.createdAt}</Text><Text style={s.text}>캐릭터 {entry.data.characters.length}명</Text>{!entry.active && button('이 스냅샷 선택', () => choose(entry.id))}</View>)}
  </ScrollView>;
}
const s = StyleSheet.create({ container: { padding: 20, paddingBottom: 40, gap: 14 }, heading: { color: '#F5F5F7', fontSize: 22, fontWeight: '700' }, title: { color: '#F5F5F7', fontSize: 17, fontWeight: '700' }, text: { color: '#C2C2CF', fontSize: 14, lineHeight: 22 }, notice: { color: '#F4CD69', fontSize: 14, lineHeight: 22 }, card: { backgroundColor: '#1B1B24', borderColor: '#353544', borderWidth: 1, borderRadius: 15, padding: 16, gap: 8 }, button: { backgroundColor: '#A77BFF', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12 }, buttonText: { color: '#1B1030', fontSize: 15, fontWeight: '700' } });
