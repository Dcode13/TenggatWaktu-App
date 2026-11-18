import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { usePomodoroApp } from '../data/AppProvider';
import { taskCompletedSessions, type Task } from '../data/model';
import { Button, ConfirmDialog, Field, Message, Page, SmallButton, ui } from '../components/ui';
import { colors } from '../theme';

export default function TasksScreen() {
  const app = usePomodoroApp();
  const [title, setTitle] = useState(''); const [target, setTarget] = useState('1');
  const [editing, setEditing] = useState<string | undefined>();
  const [showDone, setShowDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const tasks = app.data.tasks.filter(task => showDone ? task.completedAt !== null : task.completedAt === null);
  async function save() {
    setMessage(null);
    try {
      if (await app.saveTask(title, Number(target), editing)) { setTitle(''); setTarget('1'); setEditing(undefined); setMessage(editing ? 'Tugas diperbarui.' : 'Tugas ditambahkan.'); }
    } catch { setMessage('Isi judul tugas (maksimal 120 karakter) dan target 1–24 sesi.'); }
  }
  function edit(task: Task) { setEditing(task.id); setTitle(task.title); setTarget(String(task.targetSessions)); setMessage(null); }
  return <Page title="Tugas" subtitle="Pilih satu hal yang ingin kamu selesaikan.">
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>{editing ? 'Edit tugas' : 'Rencana berikutnya'}</Text>
      <Field label="Nama tugas" placeholder="Misalnya, membaca satu bab" value={title} onChangeText={setTitle} maxLength={120} />
      <Field label="Target sesi fokus" value={target} onChangeText={setTarget} keyboardType="number-pad" maxLength={2} />
      <Button title={editing ? 'Simpan tugas' : 'Tambah tugas'} onPress={() => void save()} disabled={app.disabled || !title.trim()} />
      {editing && <SmallButton title="Batal edit" onPress={() => { setEditing(undefined); setTitle(''); setTarget('1'); }} />}
      {message && <Message>{message}</Message>}
    </View>
    <View style={ui.between}><SmallButton title={`Aktif (${app.data.tasks.filter(t => t.completedAt === null).length})`} onPress={() => setShowDone(false)} /><SmallButton title={`Selesai (${app.data.tasks.filter(t => t.completedAt !== null).length})`} onPress={() => setShowDone(true)} /></View>
    {app.data.selectedTaskId && <SmallButton title="Fokus tanpa tugas" onPress={() => void app.selectTask(null)} disabled={app.disabled} />}
    {!tasks.length && <View style={ui.empty}><Feather name={showDone ? 'check-circle' : 'list'} size={32} color={colors.outline} /><Text style={ui.sectionTitle}>{showDone ? 'Belum ada tugas selesai' : 'Ruang untuk hal penting'}</Text><Text style={[ui.body, { textAlign: 'center' }]}>{showDone ? 'Tugas yang kamu tandai selesai akan muncul di sini.' : 'Tambahkan tugas pertama, lalu mulai satu sesi fokus.'}</Text></View>}
    {tasks.map(task => <View key={task.id} style={[ui.card, app.data.selectedTaskId === task.id && styles.selected]}>
      <View style={ui.between}><Text style={[ui.sectionTitle, { flex: 1 }]}>{task.title}</Text>{app.data.selectedTaskId === task.id && <Text style={ui.badge}>Dipilih</Text>}</View>
      <Text style={ui.body}>{taskCompletedSessions(app.data, task.id)} dari {task.targetSessions} sesi fokus selesai</Text>
      {task.completedAt === null && <Button title={app.data.activeSession ? `Pilih untuk sesi berikutnya: ${task.title}` : `Fokus pada: ${task.title}`} onPress={() => { void app.selectTask(task.id).then(saved => { if (saved) router.navigate('/'); }); }} disabled={app.disabled} secondary />}
      <View style={styles.actions}><SmallButton title={task.completedAt === null ? 'Tandai selesai' : 'Aktifkan lagi'} onPress={() => void app.toggleTask(task.id)} disabled={app.disabled} /><SmallButton title={`Edit ${task.title}`} onPress={() => edit(task)} disabled={app.disabled} /><SmallButton title={`Hapus ${task.title}`} onPress={() => setDeleting(task)} disabled={app.disabled} /></View>
    </View>)}
    <ConfirmDialog visible={deleting !== null} title="Hapus tugas?" description={`“${deleting?.title ?? ''}” akan dihapus dari daftar. Riwayat fokus yang terkait tetap disimpan.`} onCancel={() => setDeleting(null)} onConfirm={() => deleting ? app.deleteTask(deleting.id) : false} confirmLabel="Hapus tugas" destructive />
  </Page>;
}
const styles = StyleSheet.create({ selected: { borderColor: colors.accent }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' } });
