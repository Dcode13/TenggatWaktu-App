import { test, expect, type Page } from '@playwright/test';

const KEY = '@pomodoro/data-v2';
const LEGACY_KEY = '@pomodoro/session-v1';
const startButton = (page: Page) => page.getByRole('button', { name: 'Mulai', exact: true });
async function open(page: Page) {
  await page.goto('/');
  await expect(startButton(page)).toBeEnabled();
}
async function start(page: Page) {
  await startButton(page).click();
  await expect(page.getByRole('button', { name: 'Jeda', exact: true })).toBeEnabled();
}
async function changeVisibility(page: Page, value: 'hidden' | 'visible') {
  await page.evaluate(visibility => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibility });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}

test.beforeEach(async ({ page }) => {
  const date = new Date('2026-11-17T12:00:00Z');
  await page.clock.setFixedTime(date);
});

test('start, pause for ten seconds, reload, resume, and reset', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await expect(page.getByText('0 dari 4 sesi fokus selesai', { exact: true })).toBeVisible();
  await start(page);
  await advanceClock(page, 1000);
  await expect(page.getByRole('timer')).toHaveText('24:59');
  await page.getByRole('button', { name: 'Jeda', exact: true }).click();
  await expect(page.getByText('Dijeda', { exact: true })).toBeVisible();
  await advanceClock(page, 10_000);
  await expect(page.getByRole('timer')).toHaveText('24:59');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Lanjutkan', exact: true })).toBeEnabled();
  await expect(page.getByRole('timer')).toHaveText('24:59');
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await advanceClock(page, 1000);
  await expect(page.getByRole('timer')).toHaveText('24:58');
  await page.getByRole('button', { name: 'Jeda', exact: true }).click();
  await page.getByRole('button', { name: 'Ulangi sesi', exact: true }).click();
  await expect(startButton(page)).toBeEnabled();
  await expect(page.getByRole('timer')).toHaveText('25:00');
});

test('background return accounts for one minute without interval ticks', async ({ page }) => {
  await open(page);
  await start(page);
  await changeVisibility(page, 'hidden');
  await advanceClock(page, 60_000);
  await changeVisibility(page, 'visible');
  await expect(page.getByRole('timer')).toHaveText('24:00');
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', '24 menit 0 detik');
});

test('expired deadline restored after closing completes only one stage, even on repeated reload', async ({ page }) => {
  await open(page);
  await start(page);
  await changeVisibility(page, 'hidden');
  await advanceClock(page, 3_600_000);
  await page.reload();
  await expect(startButton(page)).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Istirahat pendek' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('05:00');
  await expect(page.getByText('Fokus selesai', { exact: true })).toBeVisible();
  await expect(page.getByText('1 dari 4 sesi fokus selesai', { exact: true })).toBeVisible();
  await page.reload();
  await expect(startButton(page)).toBeEnabled();
  await expect(page.getByRole('timer')).toHaveText('05:00');
  await expect(page.getByText('1 dari 4 sesi fokus selesai', { exact: true })).toBeVisible();
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
  expect(persisted.timer.status).toBe('ready');
  expect(persisted.timer.completedFocus).toBe(1);
});

test('full cycle and resetting second focus preserve expected progress', async ({ page }) => {
  await open(page);
  for (let count = 1; count <= 4; count += 1) {
    if (count === 2) {
      await start(page);
      await advanceClock(page, 10_000);
      await page.getByRole('button', { name: 'Jeda', exact: true }).click();
      await page.getByRole('button', { name: 'Ulangi sesi', exact: true }).click();
      await expect(startButton(page)).toBeEnabled();
      await expect(page.getByRole('timer')).toHaveText('25:00');
      await expect(page.getByText('1 dari 4 sesi fokus selesai', { exact: true })).toBeVisible();
    }
    await start(page);
    await advanceClock(page, 25 * 60 * 1000);
    await expect(startButton(page)).toBeEnabled();
    await expect(page.getByText(`${count} dari 4 sesi fokus selesai`, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading')).toHaveText(count === 4 ? 'Istirahat panjang' : 'Istirahat pendek');
    await expect(page.getByRole('timer')).toHaveText(count === 4 ? '15:00' : '05:00');
    await start(page);
    await advanceClock(page, (count === 4 ? 15 : 5) * 60 * 1000);
    await expect(startButton(page)).toBeEnabled();
    await expect(page.getByRole('heading')).toHaveText('Fokus');
  }
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await expect(page.getByText('0 dari 4 sesi fokus selesai', { exact: true })).toBeVisible();
});

test('storage read failure keeps controls disabled and retry recovers', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    let fail = true;
    Storage.prototype.getItem = function (key) {
      if (key === '@pomodoro/data-v2' && fail) { fail = false; throw new Error('Test read failure'); }
      return original.call(this, key);
    };
  });
  await page.goto('/');
  await expect(page.getByText('Sesi belum dapat dimuat. Coba lagi.')).toBeVisible();
  await expect(startButton(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(startButton(page)).toBeEnabled();
  await expect(page.getByRole('timer')).toHaveText('25:00');
});

test('storage write failure retries the latest running snapshot', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === '@pomodoro/data-v2' && fail) { fail = false; throw new Error('Test write failure'); }
      return original.call(this, key, value);
    };
  });
  await startButton(page).click();
  await expect(page.getByText('Perubahan belum tersimpan. Coba lagi.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jeda', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jeda', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jeda', exact: true })).toBeEnabled();
});

test('narrow short screen can scroll to controls with enlarged text and long stage title', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 });
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ version: 1, stage: 'longBreak', status: 'ready', completedFocus: 4, endAt: null, remainingMs: 900000, completionMessage: 'Fokus selesai' }));
  }, LEGACY_KEY);
  await open(page);
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[dir="auto"]').forEach(element => {
      element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 2}px`;
    });
  });
  await expect(page.getByRole('heading')).toHaveText('Istirahat panjang');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await startButton(page).scrollIntoViewIfNeeded();
  await expect(startButton(page)).toBeInViewport();
  await start(page);
});

async function advanceClock(page: Page, milliseconds: number) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(now + milliseconds);
}
