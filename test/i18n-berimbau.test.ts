import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 30000;

// PR6 of CAPOEIRA_I18N_PLAN: berimbau.html wired to the shared i18n engine.
// Mirrors the per-page tests (i18n-practice/library/roda/transparency) so the
// pattern is proven on this page too:
//  - the shared toggle is injected into this page's header nav
//  - clicking PT swaps berimbau.* strings (incl. the one HTML-valued key) AND the
//    shared nav.* / footer.tagline strings
//  - <html lang> flips and the choice persists under `capoeira_lang`
//  - reload restores the stored language
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
describe('berimbau.html i18n toggle (headless browser)', () => {
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

  const fileUrl = 'file://' + resolve(__dirname, '..', 'berimbau.html');

  it('injects the toggle and swaps berimbau.* + nav.* EN -> PT', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem('capoeira_lang'));
    await page.reload({ waitUntil: 'load', timeout: 20000 });

    expect(await page.$('#lang-toggle')).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

    const headingEn = await page.$eval('[data-i18n="berimbau.heading"]', (el) => el.textContent);
    expect(headingEn).toBe('How to Make a Berimbau');

    // aria-label attribute target (hamburger).
    const menuEn = await page.$eval('#hamburger-btn', (el) => el.getAttribute('aria-label'));
    expect(menuEn).toBe('Menu');

    const navHomeEn = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomeEn).toBe('Home');

    await page.evaluate(() => (window as any).setLang('pt'));

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');

    const headingPt = await page.$eval('[data-i18n="berimbau.heading"]', (el) => el.textContent);
    expect(headingPt).toBe('Como Fazer um Berimbau');

    // A part description translated.
    const vergaPt = await page.$eval('[data-i18n="berimbau.part.verga"]', (el) => el.textContent || '');
    expect(vergaPt).toContain('arco de madeira');

    // HTML-valued key: proves data-i18n-html sets innerHTML and keeps the <em>.
    const whyPt = await page.$eval('[data-i18n-html="berimbau.why.body"]', (el) => el.innerHTML);
    expect(whyPt).toContain('<em>berimbau gunga</em>');
    expect(whyPt).toContain('maestro');

    // Shared nav + footer strings translate (common.js merges here too).
    const navHomePt = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomePt).toBe('In\u00edcio');
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
    const heading = await page.$eval('[data-i18n="berimbau.heading"]', (el) => el.textContent);
    expect(heading).toBe('Como Fazer um Berimbau');
  }, TIMEOUT);
});
