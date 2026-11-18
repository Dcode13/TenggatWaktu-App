import {
  createInitialState, DEFAULT_DURATIONS, parseStoredState, pause, reconcile, reset,
  startOrResume, type Durations, type Stage, type TimerState,
} from '../timer/model';

export type Settings = {
  focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number;
  dailyGoal: number; notificationsEnabled: boolean; soundEnabled: boolean; vibrationEnabled: boolean;
};
export type Task = { id: string; title: string; targetSessions: number; createdAt: number; completedAt: number | null };
export type SessionRecord = {
  id: string; stage: Stage; outcome: 'completed' | 'cancelled' | 'skipped';
  startedAt: number; endedAt: number; durationMs: number; taskId: string | null; taskTitle: string | null;
};
export type ActiveSession = { id: string; startedAt: number; durationMs: number; taskId: string | null; taskTitle: string | null };
export type AppData = {
  version: 2; settings: Settings; timer: TimerState; timerDurations: Durations;
  activeSession: ActiveSession | null; selectedTaskId: string | null; tasks: Task[]; history: SessionRecord[];
};
export type Backup = { format: 'pomodoro-pribadi'; version: 1; exportedAt: number; settings: Settings; tasks: Task[]; history: SessionRecord[] };
export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, dailyGoal: 8,
  notificationsEnabled: false, soundEnabled: true, vibrationEnabled: true,
};
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export function getDurations(settings: Settings, quick = false): Durations {
  return quick ? { focus: 10000, shortBreak: 10000, longBreak: 10000 } : {
    focus: settings.focusMinutes * 60000,
    shortBreak: settings.shortBreakMinutes * 60000,
    longBreak: settings.longBreakMinutes * 60000,
  };
}
export function createAppData(quick = false): AppData {
  const settings = { ...DEFAULT_SETTINGS };
  const timerDurations = getDurations(settings, quick);
  return { version: 2, settings, timer: createInitialState(timerDurations), timerDurations, activeSession: null, selectedTaskId: null, tasks: [], history: [] };
}
export function createId(prefix: string, now = Date.now()): string {
  return `${prefix}-${now.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
function record(data: AppData, outcome: SessionRecord['outcome'], endedAt: number): SessionRecord[] {
  const active = data.activeSession;
  if (!active || data.history.some(item => item.id === active.id)) return data.history;
  const remaining = data.timer.status === 'running' ? Math.max(0, data.timer.endAt! - endedAt) : data.timer.remainingMs;
  return [{ ...active, stage: data.timer.stage, outcome, endedAt,
    durationMs: outcome === 'completed' ? active.durationMs : Math.max(0, Math.min(active.durationMs, active.durationMs - remaining)),
  }, ...data.history];
}
/** Timer transition and its history entry are committed together in one persisted record. */
export function reconcileApp(data: AppData, now: number, quick = false): AppData {
  const durations = getDurations(data.settings, quick);
  const timer = reconcile(data.timer, now, durations);
  if (timer === data.timer) return data;
  return { ...data, timer, timerDurations: durations,
    history: record(data, 'completed', data.timer.endAt!), activeSession: null };
}
export function timerAction(data: AppData, action: 'start' | 'pause' | 'reset' | 'skip', now: number, quick = false, id = createId('session', now)): AppData {
  const current = reconcileApp(data, now, quick);
  if (current !== data) return current;
  if (action === 'start') {
    if (data.timer.status === 'running') return data;
    const task = data.timer.stage === 'focus' ? data.tasks.find(item => item.id === data.selectedTaskId && item.completedAt === null) : undefined;
    const activeSession = data.activeSession ?? { id, startedAt: now, durationMs: data.timer.remainingMs, taskId: task?.id ?? null, taskTitle: task?.title ?? null };
    return { ...data, timer: startOrResume(data.timer, now, data.timerDurations), activeSession };
  }
  if (action === 'pause') {
    const timer = pause(data.timer, now, data.timerDurations);
    return timer === data.timer ? data : { ...data, timer };
  }
  const timerDurations = getDurations(data.settings, quick);
  if (action === 'skip') {
    if (data.timer.stage === 'focus') return data;
    return { ...data, timerDurations, activeSession: null, history: record(data, 'skipped', now),
      timer: { ...createInitialState(timerDurations), completedFocus: data.timer.stage === 'longBreak' ? 0 : data.timer.completedFocus } };
  }
  return { ...data, timerDurations, timer: reset(data.timer, now, timerDurations), activeSession: null, history: record(data, 'cancelled', now) };
}
export function updateSettings(data: AppData, settings: Settings, quick = false): AppData {
  validateSettings(settings);
  if (data.timer.status !== 'ready') return { ...data, settings };
  const timerDurations = getDurations(settings, quick);
  return { ...data, settings, timerDurations, timer: { ...data.timer, remainingMs: timerDurations[data.timer.stage] } };
}
export function saveTask(data: AppData, title: string, targetSessions: number, now: number, id = createId('task', now)): AppData {
  const old = data.tasks.find(item => item.id === id);
  const task = { id, title: title.trim(), targetSessions, createdAt: old?.createdAt ?? now, completedAt: old?.completedAt ?? null };
  validateTask(task);
  if (data.tasks.length >= 1000 && !old) throw new Error('Maksimal 1.000 tugas. Hapus tugas yang tidak diperlukan.');
  return { ...data, tasks: old ? data.tasks.map(item => item.id === id ? task : item) : [task, ...data.tasks] };
}
export function toggleTask(data: AppData, id: string, now: number): AppData {
  const task = data.tasks.find(item => item.id === id);
  if (!task) return data;
  return { ...data, selectedTaskId: data.selectedTaskId === id ? null : data.selectedTaskId,
    tasks: data.tasks.map(item => item.id === id ? { ...item, completedAt: item.completedAt === null ? now : null } : item) };
}
export function deleteTask(data: AppData, id: string): AppData {
  return { ...data, selectedTaskId: data.selectedTaskId === id ? null : data.selectedTaskId, tasks: data.tasks.filter(item => item.id !== id) };
}
export function taskCompletedSessions(data: AppData, id: string): number {
  return data.history.filter(item => item.taskId === id && item.stage === 'focus' && item.outcome === 'completed').length;
}
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format data tidak valid.');
}
function number(value: unknown, min: number, max: number, integer = true): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error('Nilai angka dalam data tidak valid.');
}
function text(value: unknown, max: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Teks dalam data tidak valid.');
}
function nullableText(value: unknown, max: number) { if (value !== null) text(value, max); }
const MAX_DATE = 8_640_000_000_000_000;
export function validateSettings(value: unknown): asserts value is Settings {
  object(value);
  number(value.focusMinutes, 1, 120); number(value.shortBreakMinutes, 1, 60); number(value.longBreakMinutes, 1, 120); number(value.dailyGoal, 1, 24);
  for (const key of ['notificationsEnabled', 'soundEnabled', 'vibrationEnabled']) if (typeof value[key] !== 'boolean') throw new Error('Pengaturan tidak valid.');
}
function validateTask(value: unknown): asserts value is Task {
  object(value); text(value.id, 120); text(value.title, 120); number(value.targetSessions, 1, 24); number(value.createdAt, 0, MAX_DATE);
  if (value.completedAt !== null) number(value.completedAt, value.createdAt, MAX_DATE);
}
function validateHistory(value: unknown): asserts value is SessionRecord {
  object(value); text(value.id, 120);
  if (!['focus', 'shortBreak', 'longBreak'].includes(String(value.stage)) || !['completed', 'cancelled', 'skipped'].includes(String(value.outcome))) throw new Error('Riwayat sesi tidak valid.');
  number(value.startedAt, 0, MAX_DATE); number(value.endedAt, value.startedAt, MAX_DATE);
  number(value.durationMs, value.outcome === 'completed' ? 1 : 0, 120 * 60000);
  nullableText(value.taskId, 120); nullableText(value.taskTitle, 120);
}
function validateLists(tasks: unknown, history: unknown): asserts tasks is Task[] {
  if (!Array.isArray(tasks) || tasks.length > 1000 || !Array.isArray(history)) throw new Error('Jumlah atau format data tidak valid. Maksimal 1.000 tugas.');
  const ids = new Set<string>();
  for (const task of tasks) { validateTask(task); if (ids.has(task.id)) throw new Error('ID tugas duplikat.'); ids.add(task.id); }
  ids.clear();
  for (const session of history) { validateHistory(session); if (ids.has(session.id)) throw new Error('ID sesi duplikat.'); ids.add(session.id); }
}
export function parseAppData(raw: string): AppData {
  const value: unknown = JSON.parse(raw);
  object(value);
  if (value.version !== 2) throw new Error('Versi data belum didukung.');
  validateSettings(value.settings); validateLists(value.tasks, value.history);
  object(value.timerDurations);
  for (const stage of ['focus', 'shortBreak', 'longBreak']) number(value.timerDurations[stage], 1000, 120 * 60000);
  const durations = value.timerDurations as Durations;
  object(value.timer);
  const timer = parseStoredState(JSON.stringify(value.timer), durations);
  // The v1 parser has a safe fallback; v2 must instead preserve damaged data for recovery.
  for (const key of Object.keys(timer) as (keyof TimerState)[]) if (timer[key] !== value.timer[key]) throw new Error('Sesi tersimpan tidak valid. Data asli tetap disimpan.');
  nullableText(value.selectedTaskId, 120);
  if (value.activeSession !== null) {
    object(value.activeSession); text(value.activeSession.id, 120); number(value.activeSession.startedAt, 0, MAX_DATE);
    number(value.activeSession.durationMs, 1, durations[timer.stage]); nullableText(value.activeSession.taskId, 120); nullableText(value.activeSession.taskTitle, 120);
    if (timer.status === 'ready' || timer.remainingMs > value.activeSession.durationMs) throw new Error('Sesi aktif tidak konsisten.');
  } else if (timer.status !== 'ready') throw new Error('Metadata sesi aktif tidak ditemukan.');
  return { version: 2, settings: value.settings, timer, timerDurations: durations, activeSession: value.activeSession as ActiveSession | null,
    selectedTaskId: value.selectedTaskId as string | null, tasks: value.tasks, history: value.history as SessionRecord[] };
}
export function migrateLegacy(raw: string | null, now: number, quick = false): AppData {
  const data = createAppData(quick);
  if (raw === null) return data;
  const timer = parseStoredState(raw, quick ? getDurations(data.settings, true) : DEFAULT_DURATIONS);
  const durationMs = data.timerDurations[timer.stage];
  const startedAt = Math.max(0, timer.endAt !== null ? timer.endAt - durationMs : now - (durationMs - timer.remainingMs));
  return { ...data, timer, activeSession: timer.status === 'ready' ? null : {
    id: `legacy-${timer.stage}-${timer.endAt ?? timer.remainingMs}-${timer.completedFocus}`,
    startedAt, durationMs, taskId: null, taskTitle: null,
  } };
}
export function createBackup(data: AppData, now: number): Backup {
  return { format: 'pomodoro-pribadi', version: 1, exportedAt: now, settings: data.settings, tasks: data.tasks, history: data.history };
}
export function parseBackup(raw: string): Backup {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('Ukuran cadangan maksimal 5 MB.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('File bukan JSON yang valid.'); }
  object(value);
  if (value.format !== 'pomodoro-pribadi' || value.version !== 1) throw new Error('Pilih cadangan TenggatWaktu versi 1.');
  number(value.exportedAt, 0, MAX_DATE); validateSettings(value.settings); validateLists(value.tasks, value.history);
  return { format: 'pomodoro-pribadi', version: 1, exportedAt: value.exportedAt, settings: value.settings, tasks: value.tasks, history: value.history as SessionRecord[] };
}
export function mergeBackup(data: AppData, backup: Backup, restoreSettings: boolean, quick = false): AppData {
  const tasks = new Map(data.tasks.map(item => [item.id, item]));
  const history = new Map(data.history.map(item => [item.id, item]));
  for (const item of backup.tasks) if (!tasks.has(item.id)) tasks.set(item.id, item);
  for (const item of backup.history) if (!history.has(item.id) && item.id !== data.activeSession?.id) history.set(item.id, item);
  if (tasks.size > 1000) throw new Error('Gabungan data melebihi batas 1.000 tugas.');
  const merged = { ...data, tasks: [...tasks.values()].sort((a, b) => b.createdAt - a.createdAt), history: [...history.values()].sort((a, b) => b.endedAt - a.endedAt) };
  // Permissions stay device-local. Importing a file never grants notification permission.
  return restoreSettings ? updateSettings(merged, { ...backup.settings, notificationsEnabled: data.settings.notificationsEnabled }, quick) : merged;
}
