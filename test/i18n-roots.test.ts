import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 30000;

// PR8 of CAPOEIRA_I18N_PLAN: roots.html wired to the shared i18n engine — the LAST
// of the 8 pages. Mirrors the per-page tests (i18n-practice/library/roda/
// transparency/berimbau/community) so the pattern is proven here too:
//  - the shared toggle is injected into this page's header nav
//  - clicking PT swaps roots.* strings (incl. HTML-valued keys) AND the shared
//    nav.* / footer.tagline strings
//  - <html lang> flips and the choice persists under `capoeira_lang`
//  - reload restores the stored language
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
describe('roots.html i18n toggle (headless browser)', () => {
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

  const fileUrl = 'file://' + resolve(__dirname, '..', 'roots.html');

  it('injects the toggle and swaps roots.* + nav.* EN -> PT', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem('capoeira_lang'));
    await page.reload({ waitUntil: 'load', timeout: 20000 });

    expect(await page.$('#lang-toggle')).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

    const headingEn = await page.$eval('[data-i18n="roots.heading"]', (el) => el.textContent);
    expect(headingEn).toBe('Where the Cacao Grows');

    // aria-label attribute target (hamburger).
    const menuEn = await page.$eval('#hamburger-btn', (el) => el.getAttribute('aria-label'));
    expect(menuEn).toBe('Menu');

    const navHomeEn = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomeEn).toBe('Home');

    await page.evaluate(() => (window as any).setLang('pt'));

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');

    const headingPt = await page.$eval('[data-i18n="roots.heading"]', (el) => el.textContent);
    expect(headingPt).toBe('Onde o Cacau Cresce');

    // HTML-valued key: proves data-i18n-html sets innerHTML and keeps the links.
    const soilP2Pt = await page.$eval('[data-i18n-html="roots.soil.p2"]', (el) => el.innerHTML);
    expect(soilP2Pt).toContain('<a href="https://agroverse.shop">');
    expect(soilP2Pt).toContain('cacau cerimonial');

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
    const heading = await page.$eval('[data-i18n="roots.heading"]', (el) => el.textContent);
    expect(heading).toBe('Onde o Cacau Cresce');
  }, TIMEOUT);
});
