import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DURATIONS, createInitialState, formatTime, parseStoredState,
  pause, reconcile, remainingSeconds, reset, startOrResume, timerAccessibilityLabel,
  type Durations, type TimerState,
} from './model';

const durations: Durations = { focus: 10_000, shortBreak: 2_000, longBreak: 4_000 };
function finishStage(state: TimerState, now: number): TimerState {
  const running = startOrResume(state, now, durations);
  assert.equal(running.status, 'running');
  return reconcile(running, running.endAt!, durations);
}

test('first launch is ready for 25 minutes; start counts down after one second', () => {
  const initial = createInitialState();
  assert.deepEqual(DEFAULT_DURATIONS, { focus: 1_500_000, shortBreak: 300_000, longBreak: 900_000 });
  assert.equal(initial.status, 'ready');
  assert.equal(initial.completedFocus, 0);
  assert.equal(formatTime(remainingSeconds(initial, 0)), '25:00');
  const running = startOrResume(initial, 1_000);
  assert.equal(formatTime(remainingSeconds(running, 2_000)), '24:59');
  assert.strictEqual(reconcile(initial, 999_999_999), initial);
});

test('remaining time uses absolute deadline and rounds partial seconds upward', () => {
  const running = startOrResume(createInitialState(durations), 1_000, durations);
  assert.equal(running.endAt, 11_000);
  assert.equal(remainingSeconds(running, 1_999), 10);
  assert.equal(remainingSeconds(running, 2_000), 9);
  assert.equal(remainingSeconds(running, 10_999), 1);
  assert.equal(remainingSeconds(running, 11_000), 0);
  assert.equal(remainingSeconds(running, 50_000), 0);
  assert.strictEqual(startOrResume(running, 2_000, durations), running);
});

test('pause freezes precise remainder for 10 seconds and resumes from the same remainder', () => {
  const running = startOrResume(createInitialState(durations), 0, durations);
  const paused = pause(running, 3_250, durations);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.endAt, null);
  assert.equal(paused.remainingMs, 6_750);
  assert.equal(remainingSeconds(paused, 3_250), 7);
  assert.equal(remainingSeconds(paused, 13_250), 7);
  const resumed = startOrResume(paused, 13_250, durations);
  assert.equal(resumed.endAt, 20_000);
  assert.equal(reconcile(resumed, 20_000, durations).stage, 'shortBreak');
});

test('reset paused second focus returns to 25:00 and keeps one completed focus', () => {
  let state = startOrResume(createInitialState(), 0);
  state = reconcile(state, 1_500_000);
  state = startOrResume(state, 1_500_000);
  state = reconcile(state, 1_800_000);
  state = startOrResume(state, 1_800_000);
  state = pause(state, 1_810_000);
  state = reset(state, 1_820_000);
  assert.equal(state.stage, 'focus');
  assert.equal(state.status, 'ready');
  assert.equal(state.completedFocus, 1);
  assert.equal(formatTime(remainingSeconds(state, 1_820_000)), '25:00');
});

test('one minute away is reflected without interval ticks', () => {
  const running = startOrResume(createInitialState(), 1_000);
  const restored = parseStoredState(JSON.stringify(running));
  assert.equal(formatTime(remainingSeconds(restored, 61_000)), '24:00');
});

test('one hour away finishes only the active stage, and reopening never adds duplicate credit', () => {
  const running = startOrResume(createInitialState(), 0);
  const restored = parseStoredState(JSON.stringify(running));
  const completed = reconcile(restored, 3_600_000);
  assert.equal(completed.stage, 'shortBreak');
  assert.equal(completed.status, 'ready');
  assert.equal(completed.completedFocus, 1);
  assert.equal(formatTime(remainingSeconds(completed, 3_600_000)), '05:00');
  const reopened = parseStoredState(JSON.stringify(completed));
  assert.strictEqual(reconcile(reopened, 7_200_000), reopened);
  assert.equal(reopened.completedFocus, 1);
});

test('four focus sessions alternate with breaks; long break keeps 4/4 until its end', () => {
  let state = createInitialState(durations);
  let now = 0;
  for (let count = 1; count <= 4; count += 1) {
    state = finishStage(state, now);
    now += 20_000;
    assert.equal(state.completedFocus, count);
    assert.equal(state.stage, count === 4 ? 'longBreak' : 'shortBreak');
    assert.equal(state.status, 'ready');
    assert.equal(state.completionMessage, 'Fokus selesai');
    if (count < 4) {
      state = finishStage(state, now);
      now += 20_000;
      assert.equal(state.stage, 'focus');
      assert.equal(state.completedFocus, count);
    }
  }
  state = pause(startOrResume(state, now, durations), now + 1_000, durations);
  assert.equal(state.completedFocus, 4);
  state = reset(state, now + 2_000, durations);
  assert.equal(state.completedFocus, 4);
  assert.equal(state.remainingMs, durations.longBreak);
  state = finishStage(state, now + 3_000);
  assert.equal(state.stage, 'focus');
  assert.equal(state.status, 'ready');
  assert.equal(state.completedFocus, 0);
  assert.equal(state.remainingMs, durations.focus);
  assert.equal(state.completionMessage, 'Istirahat selesai');
});

test('paused time survives a restart and never completes in the background', () => {
  const paused = pause(startOrResume(createInitialState(durations), 0, durations), 3_250, durations);
  const restored = parseStoredState(JSON.stringify(paused), durations);
  assert.deepEqual(restored, paused);
  assert.strictEqual(reconcile(restored, 999_999, durations), restored);
  assert.equal(remainingSeconds(restored, 999_999), 7);
});

test('actions at an elapsed deadline complete once and never start the next stage', () => {
  for (const action of [startOrResume, pause, reset]) {
    const running = startOrResume(createInitialState(durations), 1_000, durations);
    const completed = action(running, 11_000, durations);
    assert.equal(completed.stage, 'shortBreak', action.name);
    assert.equal(completed.status, 'ready', action.name);
    assert.equal(completed.completedFocus, 1, action.name);
    assert.strictEqual(reconcile(completed, 99_000, durations), completed);
  }
});

test('invalid or inconsistent persisted data falls back safely', () => {
  const initial = createInitialState(durations);
  const invalid = [
    { version: 2 }, { stage: 'other' }, { status: 'finished' },
    { completedFocus: -1 }, { completedFocus: 1.5 }, { completedFocus: 4 },
    { remainingMs: 0 }, { remainingMs: -1 }, { remainingMs: 5000 },
    { remainingMs: 20000 }, { remainingMs: '10000' }, { endAt: 20000 },
    { status: 'running', endAt: null }, { status: 'running', endAt: -1 },
    { status: 'running', endAt: Number.MAX_SAFE_INTEGER + 1 },
    { completionMessage: 'Fokus selesai' },
    { status: 'paused', completionMessage: 'Istirahat selesai' },
    { stage: 'shortBreak', remainingMs: durations.shortBreak },
    { stage: 'longBreak', completedFocus: 3, remainingMs: durations.longBreak },
  ];
  for (const raw of [null, '', '{', 'null', '[]', '42', '{}', ...invalid.map(patch => JSON.stringify({ ...initial, ...patch }))]) {
    assert.deepEqual(parseStoredState(raw, durations), initial, String(raw));
  }
});

test('visual and spoken labels include boundary values without negative time', () => {
  assert.equal(formatTime(1_500), '25:00');
  assert.equal(formatTime(61), '01:01');
  assert.equal(formatTime(9), '00:09');
  assert.equal(formatTime(-1), '00:00');
  assert.equal(formatTime(Number.NaN), '00:00');
  assert.equal(timerAccessibilityLabel(1448), '24 menit 8 detik');
});
