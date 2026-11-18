export type Stage = 'focus' | 'shortBreak' | 'longBreak';
export type Status = 'ready' | 'running' | 'paused';

export type TimerState = {
  version: 1;
  stage: Stage;
  status: Status;
  completedFocus: number;
  endAt: number | null;
  remainingMs: number;
  completionMessage: 'Fokus selesai' | 'Istirahat selesai' | null;
};

export type Durations = Record<Stage, number>;
export const DEFAULT_DURATIONS: Durations = Object.freeze({
  focus: 25 * 60 * 1_000,
  shortBreak: 5 * 60 * 1_000,
  longBreak: 15 * 60 * 1_000,
});

export function createInitialState(durations: Durations = DEFAULT_DURATIONS): TimerState {
  return {
    version: 1, stage: 'focus', status: 'ready', completedFocus: 0,
    endAt: null, remainingMs: durations.focus, completionMessage: null,
  };
}

/** Resolve at most one completion. The next stage always waits for a manual start. */
export function reconcile(state: TimerState, now: number, durations: Durations = DEFAULT_DURATIONS): TimerState {
  if (state.status !== 'running' || state.endAt === null || now < state.endAt) return state;
  if (state.stage === 'focus') {
    const completedFocus = state.completedFocus + 1;
    const stage = completedFocus === 4 ? 'longBreak' : 'shortBreak';
    return {
      version: 1, stage, status: 'ready', completedFocus, endAt: null,
      remainingMs: durations[stage], completionMessage: 'Fokus selesai',
    };
  }
  return {
    version: 1, stage: 'focus', status: 'ready',
    completedFocus: state.stage === 'longBreak' ? 0 : state.completedFocus,
    endAt: null, remainingMs: durations.focus, completionMessage: 'Istirahat selesai',
  };
}

export function startOrResume(state: TimerState, now: number, durations: Durations = DEFAULT_DURATIONS): TimerState {
  const current = reconcile(state, now, durations);
  if (current !== state || current.status === 'running') return current;
  return { ...current, status: 'running', endAt: now + current.remainingMs, completionMessage: null };
}

export function pause(state: TimerState, now: number, durations: Durations = DEFAULT_DURATIONS): TimerState {
  const current = reconcile(state, now, durations);
  if (current !== state || current.status !== 'running' || current.endAt === null) return current;
  return { ...current, status: 'paused', endAt: null, remainingMs: Math.max(0, current.endAt - now) };
}

export function reset(state: TimerState, now: number, durations: Durations = DEFAULT_DURATIONS): TimerState {
  const current = reconcile(state, now, durations);
  if (current !== state) return current;
  const remainingMs = durations[current.stage];
  if (current.status === 'ready' && current.endAt === null && current.remainingMs === remainingMs && current.completionMessage === null) return current;
  return { ...current, status: 'ready', endAt: null, remainingMs, completionMessage: null };
}

export function remainingSeconds(state: TimerState, now: number): number {
  const milliseconds = state.status === 'running' && state.endAt !== null ? state.endAt - now : state.remainingMs;
  return Math.max(0, Math.ceil(milliseconds / 1_000));
}

function wholeSeconds(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
}

export function formatTime(seconds: number): string {
  const total = wholeSeconds(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function timerAccessibilityLabel(seconds: number): string {
  const total = wholeSeconds(seconds);
  return `${Math.floor(total / 60)} menit ${total % 60} detik`;
}

/** Validate local records before restoring. Clock reconciliation belongs to the caller. */
export function parseStoredState(raw: string | null, durations: Durations = DEFAULT_DURATIONS): TimerState {
  const fallback = () => createInitialState(durations);
  if (raw === null) return fallback();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return fallback(); }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fallback();
  const { version, stage, status, completedFocus, endAt, remainingMs, completionMessage } = parsed as Record<string, unknown>;
  if (version !== 1 || (stage !== 'focus' && stage !== 'shortBreak' && stage !== 'longBreak') ||
    (status !== 'ready' && status !== 'running' && status !== 'paused')) return fallback();
  if (typeof completedFocus !== 'number' || !Number.isInteger(completedFocus) || completedFocus < 0 || completedFocus > 4) return fallback();
  const validProgress = stage === 'focus' ? completedFocus <= 3 : stage === 'shortBreak' ? completedFocus >= 1 && completedFocus <= 3 : completedFocus === 4;
  if (!validProgress) return fallback();
  if (typeof remainingMs !== 'number' || !Number.isFinite(remainingMs) || remainingMs <= 0 || remainingMs > durations[stage] ||
    (status === 'ready' && remainingMs !== durations[stage])) return fallback();
  if (status === 'running') {
    if (typeof endAt !== 'number' || !Number.isSafeInteger(endAt) || endAt < 0) return fallback();
  } else if (endAt !== null) return fallback();
  if (completionMessage !== null && completionMessage !== 'Fokus selesai' && completionMessage !== 'Istirahat selesai') return fallback();
  if (completionMessage !== null && (status !== 'ready' || (stage === 'focus' ? completionMessage !== 'Istirahat selesai' : completionMessage !== 'Fokus selesai'))) return fallback();
  return { version: 1, stage, status, completedFocus, endAt: status === 'running' ? endAt as number : null, remainingMs, completionMessage };
}
