import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { usePomodoroApp } from '../data/AppProvider';
import { getStatistics, formatDuration } from '../data/statistics';
import { formatTime, timerAccessibilityLabel } from '../timer/model';
import { Button, ConfirmDialog, SaveStatus, SmallButton, ui } from '../components/ui';
import { colors } from '../theme';
import { IS_TEST_MODE } from '../timer/config';

const stageLabels = { focus: 'Fokus', shortBreak: 'Istirahat pendek', longBreak: 'Istirahat panjang' };
export default function TimerScreen() {
  const { width, fontScale } = useWindowDimensions();
  const app = usePomodoroApp();
  const { data, now, seconds, isLoading, disabled, start, pause, reset, skip } = app;
  const state = data.timer;
  const [confirmSkip, setConfirmSkip] = useState(false);
  const lastStage = useRef(state.stage);
  const stats = useMemo(() => getStatistics(data.history, now), [data.history, now]);
  const running = state.status === 'running', paused = state.status === 'paused';
  const stageLabel = stageLabels[state.stage];
  const statusLabel = isLoading ? 'Memuat sesi…' : running ? 'Sedang berjalan' : paused ? 'Dijeda' : state.completionMessage ?? 'Siap';
  const task = data.activeSession ? data.activeSession.taskTitle : data.tasks.find(item => item.id === data.selectedTaskId && item.completedAt === null)?.title;
  const progressLabel = `${state.completedFocus} dari 4 sesi fokus selesai`;
  useEffect(() => {
    if (isLoading) return;
    if (lastStage.current !== state.stage) {
      if (Platform.OS !== 'web' && state.completionMessage && state.status === 'ready') AccessibilityInfo.announceForAccessibility(`${state.completionMessage}. ${stageLabel}. Siap dimulai.`);
      lastStage.current = state.stage;
    }
  }, [isLoading, stageLabel, state.completionMessage, state.stage, state.status]);
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <View style={styles.header}><View style={ui.row}><Feather name="clock" color={colors.accent} size={22} /><Text style={styles.brand}>TenggatWaktu</Text></View><Text style={styles.local}>{IS_TEST_MODE ? 'UJI · 10 DETIK' : 'PRIBADI'}</Text></View>
        <SaveStatus />
        <View style={styles.timerGroup}>
          <Text accessibilityRole="header" style={styles.stage}>{stageLabel}</Text>
          <Text accessibilityRole="timer" accessibilityLabel={isLoading ? 'Memuat waktu sesi' : timerAccessibilityLabel(seconds)} accessibilityLiveRegion="none"
            adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.5} style={[styles.timer, (width < 380 || fontScale > 1.3) && { fontSize: 64 }]}>{isLoading ? '––:––' : formatTime(seconds)}</Text>
          <View style={ui.row}>{isLoading ? <ActivityIndicator color={colors.accent} size="small" /> : <View style={[styles.dot, running && { backgroundColor: colors.accent }]} />}<Text style={ui.body} accessibilityLiveRegion={Platform.OS === 'web' ? 'polite' : 'none'}>{statusLabel}</Text></View>
          <View style={styles.progress} accessible accessibilityLabel={progressLabel}><View style={styles.segments}>{[0, 1, 2, 3].map(index => <View key={index} style={[styles.segment, index < state.completedFocus && { backgroundColor: colors.accent, borderColor: colors.accent }]} />)}</View><Text style={ui.body}>{progressLabel}</Text></View>
          <SmallButton title={task ? `Tugas: ${task}` : data.activeSession ? 'Sesi ini tanpa tugas' : 'Pilih tugas untuk sesi ini'} onPress={() => router.push('/tasks')} />
          {data.activeSession && <Text style={styles.hint}>Tugas sesi ini tetap sampai sesi berakhir.</Text>}
        </View>
        <View style={styles.controls}>
          <Button title={running ? 'Jeda' : paused ? 'Lanjutkan' : 'Mulai'} onPress={() => { void (running ? pause() : start()); }} secondary={running} disabled={disabled} />
          <View style={[styles.secondarySlot, { minHeight: Math.max(56, 24 + 20 * fontScale) }]}>
            {paused ? <SmallButton title="Ulangi sesi" onPress={() => void reset()} disabled={disabled} /> : state.stage !== 'focus' ? <SmallButton title="Lewati istirahat" onPress={() => setConfirmSkip(true)} disabled={disabled} /> : <Text style={styles.hint}>Satu sesi, satu langkah lebih dekat.</Text>}
          </View>
        </View>
        <View style={styles.daily}><View style={ui.between}><Text style={ui.label}>Fokus hari ini</Text><Text style={styles.goal}>{stats.todayCount} / {data.settings.dailyGoal} sesi</Text></View>
          <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${Math.min(100, stats.todayCount / data.settings.dailyGoal * 100)}%` }]} /></View>
          <View style={ui.between}><Text style={styles.hint}>{formatDuration(stats.todayMs)} fokus</Text><Text style={styles.hint}>{stats.todayCount >= data.settings.dailyGoal ? 'Target tercapai ✓' : 'Setiap sesi berarti.'}</Text></View>
        </View>
      </View>
    </ScrollView>
    <ConfirmDialog visible={confirmSkip} title="Lewati istirahat?" description="Sesi fokus berikutnya akan siap dimulai. Istirahat yang dilewati tidak dihitung sebagai sesi selesai." onCancel={() => setConfirmSkip(false)} onConfirm={skip} confirmLabel="Lewati istirahat" />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center' }, content: { flexGrow: 1, width: '100%', maxWidth: 480, paddingHorizontal: 24, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 22, gap: 12 },
  brand: { color: colors.textPrimary, fontSize: 16, fontWeight: '500' }, local: { color: colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  timerGroup: { flexGrow: 1, minHeight: 330, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  stage: { fontSize: 24, fontWeight: '500', color: colors.textPrimary, textAlign: 'center' },
  timer: { fontSize: 80, fontWeight: '500', fontVariant: ['tabular-nums'], color: colors.textPrimary, alignSelf: 'stretch', textAlign: 'center', letterSpacing: -2, marginTop: 8, marginBottom: 16, includeFontPadding: false },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textMuted },
  progress: { alignItems: 'center', marginTop: 28, marginBottom: 8, gap: 12 }, segments: { flexDirection: 'row', gap: 4, width: 172 }, segment: { flex: 1, height: 5, borderWidth: 1, borderColor: colors.outline, borderRadius: 3 },
  controls: { paddingTop: 12 }, secondarySlot: { justifyContent: 'center', alignItems: 'center', paddingVertical: 4 }, hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', flexShrink: 1 },
  daily: { borderTopWidth: 1, borderTopColor: '#2B372E', paddingTop: 20, gap: 12 }, goal: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  goalTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: '#2B372E' }, goalFill: { height: '100%', backgroundColor: colors.accent },
});
