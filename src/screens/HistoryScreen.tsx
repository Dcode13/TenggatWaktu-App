import { useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { usePomodoroApp } from '../data/AppProvider';
import { getStatistics, formatDuration, localDayKey } from '../data/statistics';
import { Button, Field, Page, SmallButton, ui } from '../components/ui';
import { colors } from '../theme';

export default function HistoryScreen() {
  const { data, now } = usePomodoroApp();
  const stats = useMemo(() => getStatistics(data.history, now), [data.history, now]);
  const [filter, setFilter] = useState<'all' | 'today' | 'focus'>('all');
  const [query, setQuery] = useState(''); const [limit, setLimit] = useState(30);
  const records = useMemo(() => data.history.filter(item =>
    (filter !== 'today' || localDayKey(item.endedAt) === localDayKey(now)) &&
    (filter !== 'focus' || (item.stage === 'focus' && item.outcome === 'completed')) &&
    (!query.trim() || (item.taskTitle ?? 'Tanpa tugas').toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')))
  ).sort((a, b) => b.endedAt - a.endedAt), [data.history, filter, query, now]);
  const max = Math.max(1, ...stats.week.map(day => day.count));
  return <Page title="Riwayat & statistik" subtitle="Lihat waktu yang sudah kamu berikan untuk hal penting.">
    <View style={styles.grid}>
      <View style={[ui.card, styles.stat]}><Text style={styles.value}>{stats.todayCount}</Text><Text style={ui.body}>Sesi hari ini</Text></View>
      <View style={[ui.card, styles.stat]}><Text style={styles.value}>{stats.streak}</Text><Text style={ui.body}>Hari beruntun</Text></View>
    </View>
    <View style={ui.card}><View style={ui.between}><Text style={ui.sectionTitle}>7 hari terakhir</Text><Text style={ui.badge}>Sesi fokus</Text></View>
      <View style={styles.chart} accessible accessibilityLabel={stats.week.map(day => `${day.label}: ${day.count} sesi`).join('. ')}>
        {stats.week.map(day => <View key={day.key} style={styles.column}><Text style={styles.count}>{day.count}</Text><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(3, day.count / max * 100)}%`, backgroundColor: day.count ? colors.accent : '#334237' }]} /></View><Text style={styles.day}>{day.label}</Text></View>)}
      </View>
      <Text style={ui.body}>{formatDuration(stats.totalMs)} fokus · {stats.totalCount} sesi selesai seluruh waktu</Text>
      <Text style={styles.note}>Statistik menghitung sesi fokus yang selesai. Tanggal mengikuti waktu lokal perangkat.</Text>
    </View>
    <Text style={ui.sectionTitle}>Catatan sesi</Text>
    <Field label="Cari riwayat tugas" placeholder="Cari nama tugas" value={query} onChangeText={value => { setQuery(value); setLimit(30); }} />
    <View style={styles.filters}>{(['all', 'today', 'focus'] as const).map(value => <View key={value} style={filter === value ? styles.activeFilter : undefined}><SmallButton title={value === 'all' ? 'Semua' : value === 'today' ? 'Hari ini' : 'Fokus selesai'} onPress={() => { setFilter(value); setLimit(30); }} /></View>)}</View>
    {!records.length && <View style={ui.empty}><Feather name="sunrise" size={36} color={colors.outline} /><Text style={ui.sectionTitle}>Mulai dari satu sesi</Text><Text style={[ui.body, { textAlign: 'center' }]}>{query || filter !== 'all' ? 'Belum ada catatan yang cocok dengan filter ini.' : 'Sesi yang selesai akan tercatat otomatis di sini.'}</Text></View>}
    {records.slice(0, limit).map(item => <View key={item.id} style={styles.record}>
      <View style={ui.between}><Text style={[ui.label, { flex: 1 }]}>{item.stage === 'focus' ? 'Fokus' : item.stage === 'shortBreak' ? 'Istirahat pendek' : 'Istirahat panjang'}</Text><Text style={item.outcome === 'completed' ? ui.badge : styles.note}>{item.outcome === 'completed' ? 'Selesai' : item.outcome === 'cancelled' ? 'Diulang' : 'Dilewati'}</Text></View>
      <Text style={ui.body}>{item.taskTitle ?? (item.stage === 'focus' ? 'Tanpa tugas' : 'Waktu untuk beristirahat')}</Text>
      <Text style={styles.note}>{new Date(item.endedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {formatDuration(item.durationMs)}</Text>
    </View>)}
    {records.length > limit && <Button title={`Tampilkan lebih banyak (${records.length - limit})`} onPress={() => setLimit(limit + 30)} secondary />}
  </Page>;
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12 }, stat: { flex: 1, padding: 16 }, value: { color: colors.textPrimary, fontSize: 34, fontWeight: '500' },
  chart: { flexDirection: 'row', height: 162, gap: 8 }, column: { flex: 1, alignItems: 'center', gap: 8 },
  count: { color: colors.textPrimary, fontSize: 12 }, barTrack: { flex: 1, width: '100%', maxWidth: 32, justifyContent: 'flex-end' }, bar: { borderRadius: 5, width: '100%', minHeight: 3 },
  day: { color: colors.textMuted, fontSize: 11 }, note: { color: colors.textMuted, fontSize: 12, lineHeight: 19 },
  record: { borderBottomWidth: 1, borderBottomColor: '#2B372E', paddingVertical: 16, gap: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, activeFilter: { backgroundColor: '#223328', borderRadius: 10 },
});
