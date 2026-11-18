import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppData, timerAction, reconcileApp, updateSettings, parseAppData, migrateLegacy, saveTask, deleteTask, createBackup, parseBackup, mergeBackup } from './model';
import { createInitialState, startOrResume } from '../timer/model';
const T = 1_800_000_000_000, M = 60_000;
const running = () => timerAction(createAppData(), 'start', T, false, 'session-a');
const complete = () => reconcileApp(running(), T + 25 * M);

test('deadline completion and history persist atomically and are idempotent on reopen', () => {
  let data = reconcileApp(parseAppData(JSON.stringify(running())), T + 60 * M);
  assert.equal(data.timer.stage, 'shortBreak'); assert.equal(data.timer.status, 'ready');
  assert.equal(data.history.length, 1); assert.equal(data.history[0].endedAt, T + 25 * M);
  assert.equal(data.history[0].durationMs, 25 * M); assert.equal(data.activeSession, null);
  data = reconcileApp(parseAppData(JSON.stringify(data)), T + 120 * M);
  assert.equal(data.history.length, 1); assert.equal(data.timer.completedFocus, 1);
});
test('actions discovering an elapsed session never start or reset its successor', () => {
  for (const action of ['start', 'pause', 'reset', 'skip'] as const) {
    const data = timerAction(running(), action, T + 60 * M);
    assert.equal(data.timer.stage, 'shortBreak'); assert.equal(data.timer.status, 'ready'); assert.equal(data.history.length, 1);
  }
});
test('pause and resume preserve session identity and exclude paused time', () => {
  let data = timerAction(running(), 'pause', T + 10 * M);
  data = parseAppData(JSON.stringify(data));
  data = timerAction(data, 'start', T + 40 * M);
  assert.equal(data.activeSession?.id, 'session-a');
  assert.equal(data.timer.endAt, T + 55 * M);
  data = reconcileApp(data, T + 55 * M);
  assert.equal(data.history[0].durationMs, 25 * M); assert.equal(data.history[0].startedAt, T);
});
test('reset records partial work without focus credit; a new start gets a new identity', () => {
  let data = timerAction(running(), 'pause', T + 10 * M);
  data = timerAction(data, 'reset', T + 40 * M);
  assert.equal(data.history[0].outcome, 'cancelled'); assert.equal(data.history[0].durationMs, 10 * M); assert.equal(data.timer.completedFocus, 0);
  data = timerAction(data, 'start', T + 41 * M, false, 'session-b');
  assert.equal(data.activeSession?.id, 'session-b');
  assert.equal(timerAction(createAppData(), 'reset', T).history.length, 0);
});
test('skipping a break readies focus without crediting that break', () => {
  let data = timerAction(complete(), 'start', T + 26 * M, false, 'break-a');
  data = timerAction(data, 'skip', T + 27 * M);
  assert.equal(data.timer.stage, 'focus'); assert.equal(data.timer.completedFocus, 1); assert.equal(data.history[0].outcome, 'skipped');
  assert.equal(data.history[0].durationMs, M);
});
test('settings change preserves an active duration, then applies to the next session', () => {
  let data = running(); data = updateSettings(data, { ...data.settings, focusMinutes: 40, shortBreakMinutes: 8 });
  assert.equal(data.timer.endAt, T + 25 * M); assert.equal(data.timerDurations.focus, 25 * M);
  data = parseAppData(JSON.stringify(data));
  data = reconcileApp(data, T + 25 * M);
  assert.equal(data.timer.remainingMs, 8 * M); assert.equal(data.history[0].durationMs, 25 * M);
  data = timerAction(data, 'skip', T + 26 * M);
  assert.equal(data.timer.remainingMs, 40 * M);
});
test('legacy migration produces stable identity and keeps progress through reload', () => {
  const legacy = JSON.stringify(startOrResume(createInitialState(), T));
  const a = reconcileApp(migrateLegacy(legacy, T + 60 * M), T + 60 * M);
  const b = reconcileApp(migrateLegacy(legacy, T + 120 * M), T + 120 * M);
  assert.equal(a.history[0].id, b.history[0].id); assert.equal(a.history[0].endedAt, T + 25 * M);
  assert.equal(parseAppData(JSON.stringify(a)).timer.completedFocus, 1);
});
test('history captures the task title at start, even when task is renamed or deleted', () => {
  let data = saveTask(createAppData(), 'Baca satu bab', 2, T, 'task-a'); data.selectedTaskId = 'task-a';
  data = timerAction(data, 'start', T, false, 'session-a');
  data = saveTask(data, 'Judul baru', 3, T + M, 'task-a');
  data = deleteTask(data, 'task-a');
  data = reconcileApp(data, T + 25 * M);
  assert.equal(data.history[0].taskTitle, 'Baca satu bab'); assert.equal(data.history[0].taskId, 'task-a');
});
test('backup merges are idempotent and preserve the local timer and notification setting', () => {
  const source = saveTask(complete(), 'Tugas cadangan', 1, T, 'task-a');
  source.settings.focusMinutes = 45; source.settings.notificationsEnabled = true;
  const backup = parseBackup(JSON.stringify(createBackup(source, T + 26 * M)));
  const local = timerAction(createAppData(), 'start', T + 30 * M, false, 'local-session');
  const once = mergeBackup(local, backup, true); const twice = mergeBackup(once, backup, true);
  assert.deepEqual(once.history, twice.history); assert.equal(twice.tasks.length, 1); assert.equal(twice.history.length, 1);
  assert.deepEqual(twice.timer, local.timer); assert.equal(twice.settings.focusMinutes, 45); assert.equal(twice.settings.notificationsEnabled, false);
  assert.equal(twice.timerDurations.focus, 25 * M);
});
test('a conflicting imported live session ID cannot suppress real completion', () => {
  const backup = createBackup(complete(), T + 26 * M);
  const data = mergeBackup(running(), backup, false);
  assert.equal(data.history.length, 0);
  assert.equal(reconcileApp(data, T + 25 * M).history.length, 1);
});
test('local task wins an ID collision during backup merge', () => {
  const data = saveTask(createAppData(), 'Versi lokal', 2, T, 'task-a');
  const source = saveTask(createAppData(), 'Versi lama', 1, T, 'task-a');
  assert.equal(mergeBackup(data, createBackup(source, T), false).tasks[0].title, 'Versi lokal');
});
test('malformed backups fail validation without changing any data', () => {
  const source = createBackup(complete(), T + 26 * M);
  const invalid = ['', '{', 'null', '[]', '{}', JSON.stringify({ ...source, version: 99 }),
    JSON.stringify({ ...source, settings: { ...source.settings, focusMinutes: 0 } }),
    JSON.stringify({ ...source, settings: { ...source.settings, dailyGoal: 2.5 } }),
    JSON.stringify({ ...source, history: [source.history[0], source.history[0]] }),
    JSON.stringify({ ...source, history: [{ ...source.history[0], outcome: 'invalid' }] }),
    JSON.stringify({ ...source, history: [{ ...source.history[0], endedAt: T - 1 }] }),
    JSON.stringify({ ...source, tasks: [{ id: 'x', title: '', targetSessions: 1, createdAt: T, completedAt: null }] }),
  ];
  const before = JSON.stringify(source);
  for (const raw of invalid) assert.throws(() => parseBackup(raw));
  assert.equal(JSON.stringify(source), before);
});
test('corrupt app data is rejected rather than silently overwriting personal history', () => {
  const data = running();
  assert.throws(() => parseAppData(JSON.stringify({ ...data, timer: { ...data.timer, status: 'broken' } })));
  assert.throws(() => parseAppData(JSON.stringify({ ...data, activeSession: null })));
  assert.deepEqual(parseAppData(JSON.stringify(data)), data);
});
