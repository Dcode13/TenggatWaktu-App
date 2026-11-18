import type { TimerState } from './model';

export const TIMER_STORAGE_KEY = '@pomodoro/session-v1';
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Serialize writes so older saves can never overwrite a newer session. */
export function createTimerStorage<T = TimerState>(adapter: StorageAdapter, key = TIMER_STORAGE_KEY) {
  let queue: Promise<void> = Promise.resolve();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }
  return {
    load(): Promise<string | null> { return enqueue(() => adapter.getItem(key)); },
    save(state: T): Promise<void> {
      const serialized = JSON.stringify(state);
      return enqueue(() => adapter.setItem(key, serialized));
    },
  };
}
