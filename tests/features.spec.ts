import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createAppData, createBackup, saveTask, timerAction, reconcileApp } from '../src/data/model';
const KEY = '@pomodoro/data-v2';
const T = Date.parse('2026-11-18T04:00:00Z');
async function tab(page: Page, name: string) { await page.getByRole('tab', { name, exact: true }).click(); }
async function initial(page: Page) { await page.goto('/'); await expect(page.getByRole('button', { name: 'Mulai', exact: true })).toBeEnabled(); }
async function storage(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY); }
async function chooseFile(page: Page, json: string) {
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Impor cadangan JSON', exact: true }).click();
  await (await choosing).setFiles({ name: 'cadangan.json', mimeType: 'application/json', buffer: Buffer.from(json) });
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(T);
});

test('task, selected focus, completed history and statistics survive reload', async ({ page }) => {
  await initial(page); await tab(page, 'Tugas');
  await page.getByRole('textbox', { name: 'Nama tugas', exact: true }).fill('Baca buku');
  await page.getByRole('textbox', { name: 'Target sesi fokus', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Tambah tugas', exact: true }).click();
  await page.getByRole('button', { name: 'Fokus pada: Baca buku', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tugas: Baca buku', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mulai', exact: true }).click();
  await advanceClock(page, 1500000);
  await expect(page.getByText('Fokus selesai', { exact: true })).toBeVisible();
  await tab(page, 'Riwayat');
  await expect(page.getByText('Baca buku', { exact: true })).toBeVisible();
  await expect(page.getByText('25 menit fokus · 1 sesi selesai seluruh waktu')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Baca buku', { exact: true })).toBeVisible();
  const data = await storage(page); expect(data.history).toHaveLength(1); expect(data.tasks).toHaveLength(1);
  await tab(page, 'Tugas');
  await page.getByRole('button', { name: 'Tandai selesai', exact: true }).click();
  await page.getByRole('button', { name: 'Selesai (1)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aktifkan lagi', exact: true })).toBeVisible();
});

test('custom durations are validated, persist, and do not shorten an active session', async ({ page }) => {
  await initial(page);
  await page.getByRole('button', { name: 'Mulai', exact: true }).click();
  await tab(page, 'Pengaturan');
  await page.getByRole('textbox', { name: 'Durasi fokus (menit)', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Simpan pengaturan', exact: true }).click();
  await expect(page.getByText(/Periksa durasi:/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Durasi fokus (menit)', exact: true }).fill('40');
  await page.getByRole('textbox', { name: 'Istirahat pendek (menit)', exact: true }).fill('8');
  await page.getByRole('button', { name: 'Simpan pengaturan', exact: true }).click();
  await tab(page, 'Timer');
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await advanceClock(page, 1500000);
  await expect(page.getByRole('timer')).toHaveText('08:00');
  await page.getByRole('button', { name: 'Lewati istirahat', exact: true }).click();
  await page.getByRole('button', { name: 'Lewati istirahat', exact: true }).last().click();
  await expect(page.getByRole('timer')).toHaveText('40:00');
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText('40:00');
});

test('JSON export and repeated import merge without duplicating history or stopping live timer', async ({ page }, testInfo) => {
  let imported = saveTask(createAppData(), 'Tugas dari cadangan', 3, T, 'task-import');
  imported = timerAction(imported, 'start', T - 1500000, false, 'history-import');
  imported = reconcileApp(imported, T);
  imported.settings.focusMinutes = 35;
  const json = JSON.stringify(createBackup(imported, T));
  await initial(page);
  await page.getByRole('button', { name: 'Mulai', exact: true }).click();
  const before = (await storage(page)).timer;
  await tab(page, 'Pengaturan');
  for (let i = 0; i < 2; i++) {
    await chooseFile(page, json);
    await expect(page.getByText('Impor cadangan?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Gabungkan cadangan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gabungkan cadangan', exact: true })).toHaveCount(0);
  }
  const data = await storage(page);
  expect(data.history).toHaveLength(1); expect(data.tasks).toHaveLength(1); expect(data.timer).toEqual(before);
  expect(data.settings.focusMinutes).toBe(35);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor cadangan JSON', exact: true }).click();
  const download = await downloading;
  const file = testInfo.outputPath('backup.json'); await download.saveAs(file);
  const exported = JSON.parse(await readFile(file, 'utf8'));
  expect(exported.format).toBe('pomodoro-pribadi'); expect(exported.history).toHaveLength(1); expect(exported.timer).toBeUndefined();
  await page.reload();
  expect((await storage(page)).history).toHaveLength(1);
});

test('invalid backup is rejected without changes and destructive operations require confirmation', async ({ page }) => {
  await initial(page); await tab(page, 'Pengaturan');
  const before = await storage(page);
  await chooseFile(page, '{"format":"wrong"}');
  await expect(page.getByText('Pilih cadangan TenggatWaktu versi 1.')).toBeVisible();
  expect(await storage(page)).toEqual(before);
  await page.getByRole('button', { name: 'Hapus semua data', exact: true }).click();
  await page.getByRole('button', { name: 'Hapus semua data', exact: true }).last().click();
  await expect(page.getByText('Ketik HAPUS untuk mengonfirmasi.')).toBeVisible();
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  expect(await storage(page)).toEqual(before);
});

test('corrupted local data can be recovered with a validated backup', async ({ page }) => {
  await page.addInitScript(key => { if (!localStorage.getItem(key)) localStorage.setItem(key, '{broken'); }, KEY);
  await page.goto('/');
  await expect(page.getByText('Sesi belum dapat dimuat. Coba lagi.')).toBeVisible();
  await tab(page, 'Pengaturan');
  const data = saveTask(createAppData(), 'Tugas dipulihkan', 1, T, 'restored');
  await chooseFile(page, JSON.stringify(createBackup(data, T)));
  await page.getByRole('button', { name: 'Gabungkan cadangan', exact: true }).click();
  await expect(page.getByText(/Cadangan diimpor:/)).toBeVisible();
  await tab(page, 'Tugas'); await expect(page.getByText('Tugas dipulihkan', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('Tugas dipulihkan', { exact: true })).toBeVisible();
});

test('task changes during an unassigned focus apply only to the next session', async ({ page }) => {
  await initial(page);
  await page.getByRole('button', { name: 'Mulai', exact: true }).click();
  await tab(page, 'Tugas');
  await page.getByRole('textbox', { name: 'Nama tugas', exact: true }).fill('Tugas berikutnya');
  await page.getByRole('button', { name: 'Tambah tugas', exact: true }).click();
  await page.getByRole('button', { name: 'Pilih untuk sesi berikutnya: Tugas berikutnya', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sesi ini tanpa tugas', exact: true })).toBeVisible();
  await advanceClock(page, 1500000);
  await expect(page.getByText('Fokus selesai', { exact: true })).toBeVisible();
  expect((await storage(page)).history[0].taskTitle).toBeNull();
  await tab(page, 'Tugas');
  await page.getByRole('button', { name: 'Edit Tugas berikutnya', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nama tugas', exact: true }).fill('Nama diperbarui');
  await page.getByRole('button', { name: 'Simpan tugas', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Nama diperbarui', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hapus Nama diperbarui', exact: true }).click();
  await page.getByRole('button', { name: 'Hapus tugas', exact: true }).click();
  await expect(page.getByText('Ruang untuk hal penting', { exact: true })).toBeVisible();
  const data = await storage(page);
  expect(data.tasks).toHaveLength(0); expect(data.history).toHaveLength(1); expect(data.selectedTaskId).toBeNull();
});

test('clearing history preserves the running timer; confirmed full deletion resets and persists everything', async ({ page }) => {
  let seed = saveTask(createAppData(), 'Tugas tersimpan', 2, T, 'keep-task');
  seed = timerAction(seed, 'start', T - 1500000, false, 'completed');
  seed = reconcileApp(seed, T);
  seed = timerAction(seed, 'start', T, false, 'active-break');
  seed.settings.dailyGoal = 12;
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: KEY, value: JSON.stringify(seed) });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jeda', exact: true })).toBeEnabled();
  await tab(page, 'Pengaturan');
  await page.getByRole('button', { name: 'Hapus riwayat sesi', exact: true }).click();
  await page.getByRole('button', { name: 'Hapus riwayat', exact: true }).click();
  await expect(page.getByText('Riwayat telah dihapus.', { exact: true })).toBeVisible();
  let data = await storage(page);
  expect(data.history).toHaveLength(0); expect(data.tasks).toHaveLength(1); expect(data.timer).toEqual(seed.timer);
  await page.getByRole('button', { name: 'Hapus semua data', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ketik HAPUS', exact: true }).fill('HAPUS');
  await page.getByRole('button', { name: 'Hapus semua data', exact: true }).last().click();
  await expect(page.getByText('Semua data lokal telah dihapus.', { exact: true })).toBeVisible();
  await page.reload();
  await tab(page, 'Timer');
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await expect(page.getByRole('button', { name: 'Mulai', exact: true })).toBeEnabled();
  data = await storage(page);
  expect(data.tasks).toHaveLength(0); expect(data.history).toHaveLength(0); expect(data.activeSession).toBeNull(); expect(data.settings.dailyGoal).toBe(8);
});

async function advanceClock(page: Page, milliseconds: number) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(now + milliseconds);
}
