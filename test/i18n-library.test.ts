import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 30000;

// PR3 of CAPOEIRA_I18N_PLAN: library.html wired to the shared i18n engine.
// Mirrors test/i18n-practice.test.ts (practice.html) so the pattern is proven
// per page:
//  - the shared toggle is injected into this page's header nav
//  - clicking PT swaps library.* strings AND the shared nav.* / footer.* strings
//  - <html lang> flips and the choice persists under `capoeira_lang`
//  - reload restores the stored language
// The move TABLE itself is JS-rendered from data/moves.json (bilingual name_pt/
// name_en in the data) and is deliberately out of scope for this unit -- see the
// inline note in library.html. This test covers the static markup only.
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
describe('library.html i18n toggle (headless browser)', () => {
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

  const fileUrl = 'file://' + resolve(__dirname, '..', 'library.html');

  it('injects the toggle and swaps library.* + nav.* EN -> PT', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });

    expect(await page.$('#lang-toggle')).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

    // Page-local string in English.
    const headingEn = await page.$eval('[data-i18n="library.heading"]', (el) => el.textContent);
    expect(headingEn).toBe('Move Library');

    // Placeholder attribute target in English.
    const phEn = await page.$eval('#library-search', (el) => el.getAttribute('placeholder'));
    expect(phEn).toBe('Search moves by name or description...');

    // Shared nav string in English.
    const navHomeEn = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomeEn).toBe('Home');

    await page.evaluate(() => (window as any).setLang('pt'));

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');

    // Page-local string translated.
    const headingPt = await page.$eval('[data-i18n="library.heading"]', (el) => el.textContent);
    expect(headingPt).toBe('Biblioteca de Movimentos');

    // Placeholder attribute translated.
    const phPt = await page.$eval('#library-search', (el) => el.getAttribute('placeholder'));
    expect(phPt).toBe('Pesquisar movimentos por nome ou descri\u00e7\u00e3o...');

    // Empty-state paragraph (page-local) translated. Asserted via the merged
    // dictionary rather than the DOM node: under file:// the fetch of
    // data/moves.json fails and move-library.js's catch block rewrites
    // #library-empty's innerHTML, clobbering the marked <p>. Over HTTP
    // (production) the fetch succeeds and the node survives intact.
    const emptyPt = await page.evaluate(() => (window as any).t('library.empty'));
    expect(emptyPt).toContain('Bico Duro');
    expect(emptyPt).not.toBe('library.empty');

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
    const heading = await page.$eval('[data-i18n="library.heading"]', (el) => el.textContent);
    expect(heading).toBe('Biblioteca de Movimentos');
  }, TIMEOUT);
});
