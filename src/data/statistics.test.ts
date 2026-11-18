import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatistics, localDayKey } from './statistics';
import type { SessionRecord } from './model';
function session(id: string, endedAt: number, extra: Partial<SessionRecord> = {}): SessionRecord {
  return { id, stage: 'focus', outcome: 'completed', startedAt: endedAt - 1500000, endedAt, durationMs: 1500000, taskId: null, taskTitle: null, ...extra };
}
const date = (day: number, hour = 12) => new Date(2026, 10, day, hour).getTime();
test('statistics follow local completion date and ignore future, interrupted and break sessions', () => {
  const history = [session('a', date(18, 0)), session('b', date(17, 23)), session('c', date(18), { outcome: 'cancelled' }), session('d', date(18), { stage: 'shortBreak' }), session('e', date(19))];
  const stats = getStatistics(history, date(18));
  assert.equal(stats.todayCount, 1); assert.equal(stats.totalCount, 2); assert.equal(stats.totalMs, 3000000);
  assert.equal(stats.streak, 2); assert.equal(stats.week.length, 7); assert.equal(stats.week[6].key, localDayKey(date(18)));
});
test('streak remains alive before today has a completion and breaks on a gap', () => {
  const history = [session('a', date(16)), session('b', date(17))];
  assert.equal(getStatistics(history, date(18)).streak, 2);
  assert.equal(getStatistics(history, date(19)).streak, 0);
});
test('duplicate IDs never inflate statistics and week keys use calendar dates', () => {
  const row = session('a', date(18));
  const stats = getStatistics([row, row], date(18));
  assert.equal(stats.totalCount, 1);
  assert.deepEqual(stats.week.map(day => day.key), [12, 13, 14, 15, 16, 17, 18].map(day => localDayKey(date(day))));
});
