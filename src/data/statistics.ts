import type { SessionRecord } from './model';
export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dayOffset(now: number, offset: number) {
  const day = new Date(now); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() + offset); return day;
}
export function getStatistics(history: SessionRecord[], now: number) {
  const days = new Map<string, { count: number; focusMs: number }>();
  const seen = new Set<string>();
  let totalCount = 0, totalMs = 0;
  for (const session of history) {
    if (session.stage !== 'focus' || session.outcome !== 'completed' || session.endedAt > now || seen.has(session.id)) continue;
    seen.add(session.id);
    const key = localDayKey(session.endedAt);
    const day = days.get(key) ?? { count: 0, focusMs: 0 };
    day.count++; day.focusMs += session.durationMs; days.set(key, day);
    totalCount++; totalMs += session.durationMs;
  }
  const today = days.get(localDayKey(now));
  let streak = 0;
  for (let offset = today ? 0 : -1; days.has(localDayKey(dayOffset(now, offset).getTime())); offset--) streak++;
  const labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = dayOffset(now, i - 6); const key = localDayKey(day.getTime());
    return { key, label: labels[day.getDay()], count: days.get(key)?.count ?? 0, focusMs: days.get(key)?.focusMs ?? 0 };
  });
  return { todayCount: today?.count ?? 0, todayMs: today?.focusMs ?? 0, totalCount, totalMs, streak, week };
}
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} menit`;
  const remainder = minutes % 60;
  return `${Math.floor(minutes / 60)} jam${remainder ? ` ${remainder} menit` : ''}`;
}
