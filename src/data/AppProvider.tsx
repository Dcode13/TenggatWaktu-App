import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Vibration, Platform } from 'react-native';
import { remainingSeconds } from '../timer/model';
import { IS_TEST_MODE } from '../timer/config';
import { createTimerStorage } from '../timer/storage';
import deviceStorage from './deviceStorage';
import {
  createAppData, parseAppData, migrateLegacy, reconcileApp, timerAction, updateSettings,
  saveTask, toggleTask, deleteTask, mergeBackup, type AppData, type Settings, type Backup,
} from './model';
import { syncNotification } from '../services/notifications';

export const APP_STORAGE_KEY = IS_TEST_MODE ? '@pomodoro/test-data-v2' : '@pomodoro/data-v2';
const LEGACY_KEY = IS_TEST_MODE ? '@pomodoro/test-session-v1' : '@pomodoro/session-v1';
const storage = createTimerStorage<AppData>(deviceStorage, APP_STORAGE_KEY);
function useAppController() {
  const [data, setData] = useState(() => createAppData(IS_TEST_MODE));
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const current = useRef(data);
  const mounted = useRef(false);
  const hydrated = useRef(false);
  const generation = useRef(0);
  const pending = useRef(0);
  const revision = useRef(0);
  const persist = useCallback(async (next: AppData) => {
    const rev = ++revision.current;
    pending.current++;
    setSaving(true);
    try {
      await storage.save(next);
      if (mounted.current && rev === revision.current) setError(null);
      return true;
    } catch {
      if (mounted.current && rev === revision.current) setError('Perubahan belum tersimpan. Coba lagi.');
      return false;
    } finally {
      pending.current--;
      if (mounted.current) setSaving(pending.current > 0);
    }
  }, []);
  const commit = useCallback((next: AppData) => {
    if (next === current.current) return Promise.resolve(true);
    current.current = next;
    setData(next);
    return persist(next);
  }, [persist]);
  const hydrate = useCallback(async () => {
    const gen = ++generation.current;
    try {
      const raw = await storage.load();
      const legacy = raw === null ? await AsyncStorage.getItem(LEGACY_KEY) : null;
      if (!mounted.current || gen !== generation.current) return;
      const restored = raw === null ? migrateLegacy(legacy, Date.now(), IS_TEST_MODE) : parseAppData(raw);
      const next = reconcileApp(restored, Date.now(), IS_TEST_MODE);
      current.current = next;
      hydrated.current = true;
      setData(next);
      setNow(Date.now());
      setLoading(false);
      const saved = await persist(next);
      // Remove the old record only after the replacement is safely written.
      if (saved && legacy !== null) await AsyncStorage.removeItem(LEGACY_KEY).catch(() => undefined);
    } catch {
      if (mounted.current && gen === generation.current) {
        setLoading(false);
        setError('Sesi belum dapat dimuat. Coba lagi.');
      }
    }
  }, [persist]);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return hydrate(); });
    return () => { cancelled = true; mounted.current = false; hydrated.current = false; };
  }, [hydrate]);
  const refresh = useCallback(() => {
    if (!hydrated.current || !mounted.current) return;
    const time = Date.now();
    setNow(previous => remainingSeconds(current.current.timer, previous) !== remainingSeconds(current.current.timer, time) || new Date(previous).toDateString() !== new Date(time).toDateString() ? time : previous);
    const next = reconcileApp(current.current, time, IS_TEST_MODE);
    if (next !== current.current) {
      if (next.settings.vibrationEnabled && !next.settings.notificationsEnabled && Platform.OS !== 'web' && AppState.currentState === 'active') Vibration.vibrate(250);
      void commit(next);
    }
  }, [commit]);
  useEffect(() => {
    if (isLoading) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const active = () => { refresh(); stop(); timer = setInterval(refresh, current.current.timer.status === 'running' ? 250 : 30_000); };
    const subscription = AppState.addEventListener('change', status => status === 'active' ? active() : stop());
    if (AppState.currentState === 'active' || AppState.currentState === null) active();
    return () => { stop(); subscription.remove(); };
  }, [isLoading, data.timer.status, refresh]);
  useEffect(() => {
    if (isLoading || !hydrated.current) return;
    let disposed = false;
    void syncNotification(data.timer, data.settings).then(() => {
      if (!disposed) setNotificationError(null);
    }).catch(() => {
      if (!disposed) setNotificationError('Pengingat belum dapat dijadwalkan. Periksa izin notifikasi di pengaturan HP.');
    });
    return () => { disposed = true; };
  }, [isLoading, data.timer, data.settings]);
  const mutate = useCallback(async (update: (value: AppData) => AppData) => {
    if (!hydrated.current || pending.current > 0 || error) return false;
    const next = update(current.current);
    setNow(Date.now());
    return commit(next);
  }, [commit, error]);
  const retry = useCallback(async () => {
    if (pending.current) return;
    if (!hydrated.current) { setLoading(true); setError(null); await hydrate(); }
    else {
      const next = reconcileApp(current.current, Date.now(), IS_TEST_MODE);
      current.current = next; setData(next); setNow(Date.now());
      await persist(next);
    }
  }, [hydrate, persist]);
  const run = (action: 'start' | 'pause' | 'reset' | 'skip') => mutate(value => timerAction(value, action, Date.now(), IS_TEST_MODE));
  return {
    data, now, seconds: remainingSeconds(data.timer, now), isLoading, isSaving, error, notificationError,
    disabled: isLoading || isSaving || error !== null,
    start: () => run('start'), pause: () => run('pause'), reset: () => run('reset'), skip: () => run('skip'), retry,
    saveSettings: (settings: Settings) => mutate(value => updateSettings(value, settings, IS_TEST_MODE)),
    saveTask: (title: string, target: number, id?: string) => mutate(value => saveTask(value, title, target, Date.now(), id)),
    toggleTask: (id: string) => mutate(value => toggleTask(value, id, Date.now())),
    deleteTask: (id: string) => mutate(value => deleteTask(value, id)),
    selectTask: (id: string | null) => mutate(value => ({ ...value, selectedTaskId: id })),
    importBackup: async (backup: Backup, settings: boolean) => {
      if (hydrated.current) return mutate(value => mergeBackup(value, backup, settings, IS_TEST_MODE));
      if (pending.current) return false;
      const next = mergeBackup(createAppData(IS_TEST_MODE), backup, settings, IS_TEST_MODE);
      hydrated.current = true; setLoading(false); return commit(next);
    },
    clearHistory: () => mutate(value => ({ ...value, history: [] })),
    clearAll: async () => {
      if (pending.current) return false;
      hydrated.current = true; setLoading(false);
      const saved = await commit(createAppData(IS_TEST_MODE));
      if (saved) await AsyncStorage.removeItem(LEGACY_KEY);
      return saved;
    },
  };
}
const Context = createContext<ReturnType<typeof useAppController> | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const controller = useAppController();
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function usePomodoroApp() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider is required.');
  return value;
}
