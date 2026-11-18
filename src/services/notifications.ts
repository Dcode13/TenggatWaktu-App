import { Platform } from 'react-native';
import type { TimerState } from '../timer/model';
import type { Settings } from '../data/model';

const IDENTIFIER = 'pomodoro-active-session';
let queue: Promise<unknown> = Promise.resolve();
let latestRequest = 0;
async function channel(settings: Pick<Settings, 'soundEnabled' | 'vibrationEnabled'>) {
  const Notifications = await import('expo-notifications');
  const id = `pomodoro-${settings.soundEnabled ? 'sound' : 'silent'}-${settings.vibrationEnabled ? 'vibrate' : 'quiet'}`;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(id, {
    name: 'Sesi TenggatWaktu', importance: Notifications.AndroidImportance.HIGH,
    sound: settings.soundEnabled ? 'default' : null,
    enableVibrate: settings.vibrationEnabled,
    vibrationPattern: settings.vibrationEnabled ? [0, 250, 150, 250] : undefined,
  });
  return id;
}
export async function requestReminderPermission(settings: Settings): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Notifications = await import('expo-notifications');
  await channel(settings);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}
/** Scheduling is serialized so a delayed start can never override a later pause. */
export function syncNotification(timer: TimerState, settings: Settings): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  const request = ++latestRequest;
  const result = queue.catch(() => undefined).then(async () => {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
    if (!settings.notificationsEnabled || timer.status !== 'running' || !timer.endAt || timer.endAt <= Date.now()) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) throw new Error('Notification permission missing');
    Notifications.setNotificationHandler({ handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldSetBadge: false, shouldPlaySound: settings.soundEnabled,
    }) });
    const channelId = await channel(settings);
    if (request !== latestRequest || timer.endAt <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIER,
      content: { title: timer.stage === 'focus' ? 'Fokus selesai' : 'Istirahat selesai',
        body: 'Buka TenggatWaktu untuk memulai sesi berikutnya.', sound: settings.soundEnabled ? 'default' : false },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(timer.endAt), channelId },
    });
  });
  queue = result;
  return result;
}
