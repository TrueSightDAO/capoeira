import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 30000;

// PR2 of CAPOEIRA_I18N_PLAN: practice.html wired to the shared i18n engine.
// Mirrors test/i18n.test.ts (index.html) so the pattern is proven per page:
//  - the shared toggle is injected into this page's header nav
//  - clicking PT swaps practice.* strings AND the shared nav.* strings
//  - <html lang> flips and the choice persists under `capoeira_lang`
//  - reload restores the stored language
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
describe('practice.html i18n toggle (headless browser)', () => {
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

  const fileUrl = 'file://' + resolve(__dirname, '..', 'practice.html');

  it('injects the toggle and swaps practice.* + nav.* EN -> PT', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });

    expect(await page.$('#lang-toggle')).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

    // Page-local string in English.
    const headingEn = await page.$eval('[data-i18n="practice.gen.heading"]', (el) => el.textContent);
    expect(headingEn).toBe('Generate a Session');

    // Shared nav string in English.
    const navHomeEn = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomeEn).toBe('Home');

    await page.evaluate(() => (window as any).setLang('pt'));

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');

    // Page-local string translated.
    const headingPt = await page.$eval('[data-i18n="practice.gen.heading"]', (el) => el.textContent);
    expect(headingPt).toBe('Gerar uma Sess\u00e3o');

    const startPt = await page.$eval('[data-i18n="practice.gen.start"]', (el) => el.textContent);
    expect(startPt).toBe('Come\u00e7ar a Praticar');

    // Shared nav string translated (proves common.js merges on this page too).
    const navHomePt = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomePt).toBe('In\u00edcio');

    // Footer tagline (shared) translates.
    const footerPt = await page.$eval('[data-i18n="footer.tagline"]', (el) => el.textContent);
    expect(footerPt).toContain('Brasil');

    const stored = await page.evaluate(() => localStorage.getItem('capoeira_lang'));
    expect(stored).toBe('pt');
  }, TIMEOUT);

  it('restores the stored language on reload', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => localStorage.setItem('capoeira_lang', 'pt'));
    await page.reload({ waitUntil: 'load', timeout: 20000 });

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');
    const heading = await page.$eval('[data-i18n="practice.gen.heading"]', (el) => el.textContent);
    expect(heading).toBe('Gerar uma Sess\u00e3o');
  }, TIMEOUT);
});
