import { Platform } from 'react-native';
import { createBackup, MAX_BACKUP_BYTES, parseBackup, type AppData, type Backup } from '../data/model';

export async function exportBackup(data: AppData): Promise<void> {
  const now = Date.now();
  const content = JSON.stringify(createBackup(data, now));
  // Every exported file must also be accepted by this version's importer.
  parseBackup(content);
  const filename = `tenggatwaktu-cadangan-${new Date(now).toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Menu berbagi tidak tersedia di perangkat ini.');
  const file = new File(Paths.cache, filename);
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Simpan cadangan TenggatWaktu', UTI: 'public.json' });
}
export async function pickBackup(): Promise<Backup | null> {
  const { getDocumentAsync } = await import('expo-document-picker');
  const result = await getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web') {
    try {
      if (asset.size && asset.size > MAX_BACKUP_BYTES) throw new Error('Ukuran cadangan maksimal 5 MB.');
      if (!asset.file) throw new Error('File tidak dapat dibaca.');
      return parseBackup(await asset.file.text());
    } finally { URL.revokeObjectURL(asset.uri); }
  }
  const { File } = await import('expo-file-system');
  const file = new File(asset.uri);
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Ukuran cadangan maksimal 5 MB.');
    return parseBackup(await file.text());
  } finally { try { file.delete(); } catch { /* The OS can clean temporary picker files later. */ } }
}
