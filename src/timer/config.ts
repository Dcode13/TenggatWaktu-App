import { DEFAULT_DURATIONS, type Durations } from './model';

// Release/export builds always use the user's settings, never the 10-second test duration.
export const IS_TEST_MODE = __DEV__ && process.env.EXPO_PUBLIC_TIMER_TEST_MODE === 'true';
export const DURATIONS: Durations =
  IS_TEST_MODE
    ? { focus: 10_000, shortBreak: 10_000, longBreak: 10_000 }
    : DEFAULT_DURATIONS;
