import { Platform } from 'react-native';
if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = 'id';
// Router must be registered last so platform setup runs before the app mounts.
import 'expo-router/entry';
