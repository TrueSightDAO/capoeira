import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 30000;

// Headless-browser proof that the index.html language toggle actually works:
//  - toggle is injected into the header nav
//  - clicking PT swaps every data-i18n string to Portuguese and sets <html lang>
//  - the choice is persisted to localStorage under `capoeira_lang`
//  - reloading restores the chosen language
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
describe('index.html i18n toggle (headless browser)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    if (!process.env.VITEST_INTEGRATION) return;
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    page = await browser.newPage();
  }, TIMEOUT);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  const fileUrl = 'file://' + resolve(__dirname, '..', 'index.html');

  it('injects a language toggle and switches EN -> PT', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });

    // Toggle was injected into the header nav.
    const hasToggle = await page.$('#lang-toggle');
    expect(hasToggle).not.toBeNull();

    // Default language is English.
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    const enHeading = await page.$eval('[data-i18n="index.hero.heading"]', () => null).catch(() => null);
    const heroEn = await page.$eval('h1', (el) => el.textContent);
    expect(heroEn).toContain('Capoeira Practice');

    // Switch to Portuguese.
    await page.evaluate(() => (window as any).setLang('pt'));

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');
    const heroPt = await page.$eval('h1', (el) => el.textContent);
    expect(heroPt).toContain('Pr\u00e1tica de Capoeira');

    // A nav link and the footer/caption also translate.
    const navHome = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHome).toBe('In\u00edcio');

    const downloadBtn = await page.$eval('[data-i18n="index.qr.download"]', (el) => el.textContent);
    expect(downloadBtn).toContain('Baixar para imprimir');

    // Preference persisted.
    const stored = await page.evaluate(() => localStorage.getItem('capoeira_lang'));
    expect(stored).toBe('pt');
  }, TIMEOUT);

  it('restores the stored language on reload', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });
    // Simulate a prior choice without relying on state from the previous test.
    await page.evaluate(() => localStorage.setItem('capoeira_lang', 'pt'));
    await page.reload({ waitUntil: 'load', timeout: 20000 });

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');
    const hero = await page.$eval('h1', (el) => el.textContent);
    expect(hero).toContain('Pr\u00e1tica de Capoeira');
  }, TIMEOUT);
});
