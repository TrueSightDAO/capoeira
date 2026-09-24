import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 30000;

// PR7 of CAPOEIRA_I18N_PLAN: community.html wired to the shared i18n engine.
// Mirrors the per-page tests (i18n-practice/library/roda/transparency/berimbau)
// so the pattern is proven on this page too:
//  - the shared toggle is injected into this page's header nav
//  - clicking PT swaps community.* strings (incl. an HTML-valued key) AND the
//    shared nav.* / footer.tagline strings
//  - <html lang> flips and the choice persists under `capoeira_lang`
//  - reload restores the stored language
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
describe('community.html i18n toggle (headless browser)', () => {
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

  const fileUrl = 'file://' + resolve(__dirname, '..', 'community.html');

  it('injects the toggle and swaps community.* + nav.* EN -> PT', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem('capoeira_lang'));
    await page.reload({ waitUntil: 'load', timeout: 20000 });

    expect(await page.$('#lang-toggle')).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

    const headingEn = await page.$eval('[data-i18n="community.heading"]', (el) => el.textContent);
    expect(headingEn).toBe('Capoeira Community Life in Itacar\u00e9');

    // aria-label attribute target (hamburger).
    const menuEn = await page.$eval('#hamburger-btn', (el) => el.getAttribute('aria-label'));
    expect(menuEn).toBe('Menu');

    const navHomeEn = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomeEn).toBe('Home');

    await page.evaluate(() => (window as any).setLang('pt'));

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');

    const headingPt = await page.$eval('[data-i18n="community.heading"]', (el) => el.textContent);
    expect(headingPt).toContain('Vida da Comunidade');

    // HTML-valued key: proves data-i18n-html sets innerHTML and keeps the <em>.
    const batizadoPt = await page.$eval('[data-i18n-html="community.batizado.body"]', (el) => el.innerHTML);
    expect(batizadoPt).toContain('<em>corda</em>');
    expect(batizadoPt).toContain('apelido');

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
    const heading = await page.$eval('[data-i18n="community.heading"]', (el) => el.textContent);
    expect(heading).toContain('Vida da Comunidade');
  }, TIMEOUT);
});
