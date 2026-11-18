import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { usePomodoroApp } from '../data/AppProvider';

export function Button({ title, onPress, secondary = false, disabled = false, danger = false }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; danger?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, secondary && ui.secondaryButton, danger && ui.dangerButton, pressed && { backgroundColor: danger ? '#603F3C' : secondary ? colors.outlinePressed : colors.accentPressed }, disabled && { opacity: 0.4 }]}>
    <Text style={[ui.buttonText, secondary && { color: colors.textPrimary }, danger && { color: colors.textPrimary }]}>{title}</Text>
  </Pressable>;
}
export function SmallButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={({ pressed }) => [ui.smallButton, pressed && { backgroundColor: colors.outlinePressed }, disabled && { opacity: 0.4 }]}><Text style={ui.link}>{title}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={ui.field}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.outline} selectionColor={colors.accent} {...props} style={[ui.input, props.style]} /></View>;
}
export function Message({ children }: { children: ReactNode }) {
  return <Text accessibilityLiveRegion="polite" style={ui.message}>{children}</Text>;
}
export function SaveStatus() {
  const { error, isLoading, isSaving, retry, notificationError } = usePomodoroApp();
  if (error) return <View style={ui.errorBox}><Text accessibilityRole="alert" style={ui.body}>{error}</Text><SmallButton title="Coba lagi" onPress={() => void retry()} disabled={isLoading || isSaving} /></View>;
  if (notificationError) return <Text style={ui.message}>{notificationError}</Text>;
  return null;
}
export function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={ui.pageScroll} keyboardShouldPersistTaps="handled">
      <View style={ui.page}>
        <Text style={ui.eyebrow}>TENGGATWAKTU</Text>
        <Text accessibilityRole="header" style={ui.title}>{title}</Text>
        <Text style={ui.subtitle}>{subtitle}</Text>
        <SaveStatus />
        {children}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
export function ConfirmDialog({ visible, title, description, onCancel, onConfirm, destructive = false, confirmLabel = 'Lanjutkan', children }: {
  visible: boolean; title: string; description: string; onCancel: () => void; onConfirm: () => Promise<boolean> | boolean;
  destructive?: boolean; confirmLabel?: string; children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setBusy(true); setError(null);
    try { if (await onConfirm()) onCancel(); else setError('Perubahan belum tersimpan. Tutup dialog dan coba lagi.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Aksi gagal. Coba lagi.'); }
    finally { setBusy(false); }
  }
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={ui.modalBackdrop}><View accessibilityViewIsModal style={ui.modal}>
      <ScrollView><Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text><Text style={[ui.body, { marginTop: 12, marginBottom: 20 }]}>{description}</Text>{children}{error && <Message>{error}</Message>}
        <View style={ui.stack}><Button title={busy ? 'Menyimpan…' : confirmLabel} onPress={() => void confirm()} disabled={busy} danger={destructive} /><Button title="Batal" onPress={onCancel} disabled={busy} secondary /></View>
      </ScrollView>
    </View></View>
  </Modal>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pageScroll: { flexGrow: 1, alignItems: 'center' },
  page: { padding: 24, paddingTop: 28, gap: 16, width: '100%', maxWidth: 640 },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 30, fontWeight: '600', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginTop: -6, marginBottom: 8 },
  sectionTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '600' },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  label: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  card: { backgroundColor: '#18201A', borderWidth: 1, borderColor: '#2B372E', borderRadius: 16, padding: 20, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stack: { gap: 12 },
  button: { backgroundColor: colors.accent, borderColor: colors.accent, borderWidth: 1, borderRadius: 14, minHeight: 52, paddingHorizontal: 20, paddingVertical: 15, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: colors.outline },
  dangerButton: { backgroundColor: '#452F2D', borderColor: '#885B55' },
  smallButton: { minHeight: 48, minWidth: 48, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 10, alignItems: 'center' },
  link: { color: colors.accent, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  field: { gap: 8, flexShrink: 1 },
  input: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.outline, color: colors.textPrimary, fontSize: 16, padding: 12, backgroundColor: colors.background },
  message: { color: colors.accent, fontSize: 14, lineHeight: 22, paddingVertical: 8 },
  errorBox: { borderWidth: 1, borderColor: colors.outline, borderRadius: 14, padding: 16 },
  modalBackdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: '#18201A', borderRadius: 20, borderWidth: 1, borderColor: colors.outline, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90%' },
  empty: { paddingVertical: 36, alignItems: 'center', gap: 12 },
  badge: { color: colors.accent, fontSize: 12, backgroundColor: '#223328', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: 'hidden' },
});
