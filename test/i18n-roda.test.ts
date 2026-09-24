import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 30000;

// PR3 of CAPOEIRA_I18N_PLAN: roda.html wired to the shared i18n engine.
// Mirrors test/i18n.test.ts / i18n-practice.test.ts / i18n-library.test.ts so
// the pattern is proven per page:
//  - the shared toggle is injected into this page's header nav
//  - clicking PT swaps roda.* strings (incl. an HTML-valued key and an
//    aria-label attribute target) AND the shared nav.* / footer.* strings
//  - <html lang> flips and the choice persists under `capoeira_lang`
//  - reload restores the stored language
// The JS-generated roda session-status text and the per-track playlist tempo
// line are written by roda.html's own inline script and are deliberately out
// of scope for this unit -- see the inline note in roda.html. This test covers
// the static markup only.
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
describe('roda.html i18n toggle (headless browser)', () => {
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

  const fileUrl = 'file://' + resolve(__dirname, '..', 'roda.html');

  it('injects the toggle and swaps roda.* + nav.* EN -> PT', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });

    expect(await page.$('#lang-toggle')).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

    // Page-local string in English.
    const headingEn = await page.$eval('[data-i18n="roda.heading"]', (el) => el.textContent);
    expect(headingEn).toBe('Roda \u2014 The Music of Capoeira');

    // aria-label attribute target in English (hamburger).
    const menuEn = await page.$eval('#hamburger-btn', (el) => el.getAttribute('aria-label'));
    expect(menuEn).toBe('Menu');

    // Shared nav string in English.
    const navHomeEn = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomeEn).toBe('Home');

    await page.evaluate(() => (window as any).setLang('pt'));

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');

    // Page-local string translated.
    const headingPt = await page.$eval('[data-i18n="roda.heading"]', (el) => el.textContent);
    expect(headingPt).toBe('Roda \u2014 A M\u00fasica da Capoeira');

    // Transport button translated.
    const startPt = await page.$eval('[data-i18n="roda.start"]', (el) => el.textContent);
    expect(startPt).toBe('Iniciar Sess\u00e3o de Roda');

    // HTML-valued key: proves data-i18n-html sets innerHTML, not textContent.
    const caveatPt = await page.$eval('[data-i18n-html="roda.caveat"]', (el) => el.innerHTML);
    expect(caveatPt).toContain('<em>m\u00e9dia</em>');
    expect(caveatPt).toContain('corre\u00e7\u00f5es');

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
    const heading = await page.$eval('[data-i18n="roda.heading"]', (el) => el.textContent);
    expect(heading).toBe('Roda \u2014 A M\u00fasica da Capoeira');
  }, TIMEOUT);
});
