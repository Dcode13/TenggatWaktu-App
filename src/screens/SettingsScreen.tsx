import { useState } from 'react';
import { Linking, Platform, Switch, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { usePomodoroApp } from '../data/AppProvider';
import { DEFAULT_SETTINGS, type Backup, type Settings } from '../data/model';
import { Button, ConfirmDialog, Field, Message, Page, SmallButton, ui } from '../components/ui';
import { exportBackup, pickBackup } from '../services/backup';
import { requestReminderPermission } from '../services/notifications';
import { colors } from '../theme';

function Toggle({ label, value, onValueChange, disabled = false }: { label: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }) {
  return <View style={ui.between}><Text style={[ui.label, { flex: 1 }]}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.outline, true: colors.accent }} thumbColor={value ? colors.onAccent : colors.textPrimary} /></View>;
}
function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: (message: string) => void }) {
  const app = usePomodoroApp();
  const [focus, setFocus] = useState(String(settings.focusMinutes));
  const [short, setShort] = useState(String(settings.shortBreakMinutes));
  const [long, setLong] = useState(String(settings.longBreakMinutes));
  const [goal, setGoal] = useState(String(settings.dailyGoal));
  const [notifications, setNotifications] = useState(settings.notificationsEnabled);
  const [sound, setSound] = useState(settings.soundEnabled);
  const [vibration, setVibration] = useState(settings.vibrationEnabled);
  const [message, setMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  async function notificationToggle(value: boolean) {
    if (!value) { setNotifications(false); return; }
    setRequesting(true); setMessage(null);
    try {
      const granted = await requestReminderPermission({ ...settings, soundEnabled: sound, vibrationEnabled: vibration });
      setNotifications(granted);
      if (!granted) setMessage('Izin notifikasi belum diberikan. Kamu bisa mengaktifkannya lewat pengaturan HP.');
    } catch { setMessage('Izin notifikasi belum dapat diminta. Coba lagi di HP.'); }
    finally { setRequesting(false); }
  }
  async function save() {
    setMessage(null);
    try {
      const saved = await app.saveSettings({ focusMinutes: Number(focus), shortBreakMinutes: Number(short), longBreakMinutes: Number(long), dailyGoal: Number(goal), notificationsEnabled: notifications, soundEnabled: sound, vibrationEnabled: vibration });
      if (saved) onSaved('Pengaturan tersimpan di perangkat.');
    } catch { setMessage('Periksa durasi: fokus 1–120, pendek 1–60, panjang 1–120 menit; target 1–24 sesi. Gunakan bilangan bulat.'); }
  }
  return <View style={ui.card}>
    <Text style={ui.sectionTitle}>Ritme fokusmu</Text>
    <Field label="Durasi fokus (menit)" value={focus} onChangeText={setFocus} keyboardType="number-pad" maxLength={3} />
    <Field label="Istirahat pendek (menit)" value={short} onChangeText={setShort} keyboardType="number-pad" maxLength={2} />
    <Field label="Istirahat panjang (menit)" value={long} onChangeText={setLong} keyboardType="number-pad" maxLength={3} />
    <Field label="Target harian (sesi)" value={goal} onChangeText={setGoal} keyboardType="number-pad" maxLength={2} />
    <Text style={ui.body}>Istirahat panjang setelah 4 fokus. Durasi baru berlaku pada sesi berikutnya atau saat sesi diulang. Setiap tahap dimulai manual.</Text>
    <Text style={ui.sectionTitle}>Pengingat selesai</Text>
    <Toggle label="Notifikasi selesai" value={notifications} onValueChange={value => void notificationToggle(value)} disabled={Platform.OS === 'web' || requesting || app.disabled} />
    <Text style={ui.body}>{Platform.OS === 'web' ? 'Notifikasi latar belakang tersedia di aplikasi Android/iOS. Browser menampilkan tanda selesai di layar.' : 'Pengingat lokal dijadwalkan saat sesi dimulai dan dibatalkan saat dijeda. Waktunya dapat dipengaruhi pengaturan baterai HP.'}</Text>
    <Toggle label="Suara notifikasi" value={sound} onValueChange={setSound} disabled={!notifications || app.disabled} />
    <Toggle label="Getar saat selesai" value={vibration} onValueChange={setVibration} disabled={Platform.OS === 'web' || app.disabled} />
    {message && <Message>{message}</Message>}
    {message?.includes('Izin') && Platform.OS !== 'web' && <SmallButton title="Buka pengaturan HP" onPress={() => void Linking.openSettings()} />}
    <Button title="Simpan pengaturan" onPress={() => void save()} disabled={app.disabled || requesting} />
    <SmallButton title="Isi durasi bawaan" onPress={() => { setFocus('25'); setShort('5'); setLong('15'); setGoal(String(DEFAULT_SETTINGS.dailyGoal)); setMessage('Durasi bawaan diisi. Tekan Simpan pengaturan untuk menerapkan.'); }} disabled={app.disabled} />
  </View>;
}
export default function SettingsScreen() {
  const app = usePomodoroApp();
  const [message, setMessage] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [restoreSettings, setRestoreSettings] = useState(true);
  const [clear, setClear] = useState<'history' | 'all' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  async function exportFile() {
    setFileBusy(true); setMessage(null);
    try { await exportBackup(app.data); setMessage(Platform.OS === 'web' ? 'Cadangan diunduh. Simpan file JSON di tempat yang mudah ditemukan.' : 'Menu penyimpanan cadangan telah dibuka. Pilih lokasi untuk menyimpan file.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Cadangan belum dapat diekspor.'); }
    finally { setFileBusy(false); }
  }
  async function importFile() {
    setFileBusy(true); setMessage(null);
    try { const result = await pickBackup(); if (result) { setBackup(result); setRestoreSettings(true); } }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Cadangan belum dapat dibaca.'); }
    finally { setFileBusy(false); }
  }
  const taskIds = new Set(app.data.tasks.map(task => task.id));
  const historyIds = new Set(app.data.history.map(item => item.id));
  const newTasks = backup?.tasks.filter(task => !taskIds.has(task.id)).length ?? 0;
  const newSessions = backup?.history.filter(item => !historyIds.has(item.id) && item.id !== app.data.activeSession?.id).length ?? 0;
  return <Page title="Pengaturan" subtitle="Atur ritme, simpan progres, dan jaga cadanganmu.">
    {message && <Message>{message}</Message>}
    <SettingsForm key={JSON.stringify(app.data.settings)} settings={app.data.settings} onSaved={setMessage} />
    <View style={ui.card}>
      <View style={ui.row}><Feather name="hard-drive" color={colors.accent} size={22} /><Text style={ui.sectionTitle}>Data di perangkat ini</Text></View>
      <Text style={ui.body}>{app.data.tasks.length} tugas · {app.data.history.length} catatan sesi</Text>
      <Text style={ui.body}>Tersimpan otomatis tanpa akun atau koneksi internet. Cadangan berisi tugas, riwayat, dan pengaturan. Timer aktif tidak disalin ke cadangan.</Text>
      <Text style={ui.body}>Cadangan menggunakan file JSON, maksimal 5 MB per file.</Text>
      <Button title="Ekspor cadangan JSON" onPress={() => void exportFile()} secondary disabled={app.disabled || fileBusy} />
      <Button title="Impor cadangan JSON" onPress={() => void importFile()} secondary disabled={app.isLoading || app.isSaving || fileBusy} />
      {fileBusy && <Text style={ui.body}>Menyiapkan file…</Text>}
    </View>
    <View style={ui.card}><Text style={ui.sectionTitle}>Kelola data</Text><Text style={ui.body}>Ekspor cadangan sebelum menghapus data yang ingin kamu simpan.</Text>
      <SmallButton title="Hapus riwayat sesi" onPress={() => setClear('history')} disabled={app.disabled} />
      <SmallButton title="Hapus semua data" onPress={() => { setConfirmation(''); setClear('all'); }} disabled={app.isSaving || app.isLoading} />
    </View>
    <Text style={[ui.body, { textAlign: 'center', paddingVertical: 12 }]}>TenggatWaktu · versi 2.0{ '\n' }Dibuat untuk satu hal: fokus dengan tenang.</Text>
    {backup && <ConfirmDialog visible title="Impor cadangan?" description={`Cadangan ${new Date(backup.exportedAt).toLocaleDateString('id-ID')} berisi ${backup.tasks.length} tugas dan ${backup.history.length} sesi. Akan ditambahkan ${newTasks} tugas dan ${newSessions} sesi baru. Data dengan ID yang sama memakai versi lokal; timer aktif tetap dipertahankan.`} onCancel={() => setBackup(null)} confirmLabel="Gabungkan cadangan" onConfirm={async () => { const saved = await app.importBackup(backup, restoreSettings); if (saved) setMessage(`Cadangan diimpor: ${newTasks} tugas dan ${newSessions} sesi baru.`); return saved; }}>
      <View style={{ marginBottom: 20 }}><Toggle label="Pulihkan pengaturan durasi dan target" value={restoreSettings} onValueChange={setRestoreSettings} /><Text style={ui.body}>Izin notifikasi mengikuti perangkat ini. Sesi berjalan memakai durasi semula.</Text></View>
    </ConfirmDialog>}
    {clear && <ConfirmDialog visible title={clear === 'all' ? 'Hapus semua data?' : 'Hapus seluruh riwayat?'} description={clear === 'all' ? 'Timer akan dihentikan. Semua tugas, riwayat, progres, dan pengaturan pada perangkat ini akan dihapus. Ketik HAPUS untuk melanjutkan.' : 'Riwayat dan statistik akan dikosongkan. Tugas, pengaturan, dan timer aktif tetap tersedia.'} onCancel={() => setClear(null)} confirmLabel={clear === 'all' ? 'Hapus semua data' : 'Hapus riwayat'} destructive onConfirm={async () => {
      if (clear === 'all' && confirmation !== 'HAPUS') throw new Error('Ketik HAPUS untuk mengonfirmasi.');
      const saved = await (clear === 'all' ? app.clearAll() : app.clearHistory());
      if (saved) setMessage(clear === 'all' ? 'Semua data lokal telah dihapus.' : 'Riwayat telah dihapus.');
      return saved;
    }}>{clear === 'all' && <View style={{ marginBottom: 20 }}><Field label="Ketik HAPUS" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" /></View>}</ConfirmDialog>}
  </Page>;
}
