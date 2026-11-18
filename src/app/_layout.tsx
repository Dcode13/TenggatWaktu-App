import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { AppProvider } from '../data/AppProvider';
import { colors } from '../theme';

export default function RootLayout() {
  return <SafeAreaProvider><AppProvider>
    <StatusBar style="light" /><NavigationBar style="light" />
    <AppTabs />
  </AppProvider></SafeAreaProvider>;
}

function AppTabs() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background },
      tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: { backgroundColor: colors.background, borderTopColor: '#2B372E', height: 64 + insets.bottom + Math.max(0, fontScale - 1) * 16, paddingTop: 6, paddingBottom: insets.bottom + 6 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Timer', tabBarAccessibilityLabel: 'Timer', tabBarIcon: ({ focused, size }) => <Feather name="clock" color={focused ? colors.accent : colors.textMuted} size={size} /> }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tugas', tabBarAccessibilityLabel: 'Tugas', tabBarIcon: ({ focused, size }) => <Feather name="check-square" color={focused ? colors.accent : colors.textMuted} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Riwayat', tabBarAccessibilityLabel: 'Riwayat', tabBarIcon: ({ focused, size }) => <Feather name="bar-chart-2" color={focused ? colors.accent : colors.textMuted} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Pengaturan', tabBarAccessibilityLabel: 'Pengaturan', tabBarIcon: ({ focused, size }) => <Feather name="sliders" color={focused ? colors.accent : colors.textMuted} size={size} /> }} />
    </Tabs>;
}
