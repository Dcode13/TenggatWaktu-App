import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createInitialState } from './model';
import { createTimerStorage, TIMER_STORAGE_KEY } from './storage';

test('rapid saves execute in order and capture original snapshots', async () => {
  const started: { key: string; value: string; release(): void }[] = [];
  const storage = createTimerStorage({
    async getItem() { return null; },
    setItem(key, value) {
      return new Promise<void>(resolve => { started.push({ key, value, release: resolve }); });
    },
  });
  const first = createInitialState();
  const firstWrite = storage.save(first);
  first.completedFocus = 99;
  const secondWrite = storage.save({ ...createInitialState(), completedFocus: 1 });
  await setImmediate();
  assert.equal(started.length, 1);
  assert.equal(started[0].key, TIMER_STORAGE_KEY);
  assert.equal(JSON.parse(started[0].value).completedFocus, 0);
  started[0].release();
  await firstWrite;
  await setImmediate();
  assert.equal(started.length, 2);
  assert.equal(JSON.parse(started[1].value).completedFocus, 1);
  started[1].release();
  await secondWrite;
});

test('a failed write does not poison the queue or lose the next snapshot', async () => {
  let attempts = 0;
  let stored: string | null = null;
  const storage = createTimerStorage({
    async getItem() { return stored; },
    async setItem(_key, value) {
      if (++attempts === 1) throw new Error('Disk temporarily unavailable');
      stored = value;
    },
  });
  const failed = storage.save(createInitialState());
  const latest = { ...createInitialState(), completedFocus: 2 };
  const succeeding = storage.save(latest);
  await assert.rejects(failed, /temporarily unavailable/);
  await succeeding;
  assert.equal(attempts, 2);
  assert.deepEqual(JSON.parse((await storage.load())!), latest);
});

test('loading waits for an earlier pending save', async () => {
  let stored: string | null = null;
  let reads = 0;
  let releaseWrite: (() => void) | undefined;
  const storage = createTimerStorage({
    async getItem() { reads += 1; return stored; },
    setItem(_key, value) {
      return new Promise<void>(resolve => { releaseWrite = () => { stored = value; resolve(); }; });
    },
  });
  const snapshot = createInitialState();
  const write = storage.save(snapshot);
  const read = storage.load();
  await setImmediate();
  assert.equal(reads, 0);
  assert.ok(releaseWrite);
  releaseWrite();
  await write;
  assert.deepEqual(JSON.parse((await read)!), snapshot);
  assert.equal(reads, 1);
});
