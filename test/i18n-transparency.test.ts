import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 30000;

// PR5 of CAPOEIRA_I18N_PLAN: transparency.html wired to the shared i18n engine.
// Mirrors test/i18n.test.ts / i18n-practice.test.ts / i18n-library.test.ts /
// i18n-roda.test.ts so the pattern is proven per page, plus one page-specific case:
//  - the shared toggle is injected into this page's header nav
//  - clicking PT swaps transparency.* strings (incl. HTML-valued keys) AND the
//    shared nav.* / footer.* strings
//  - <html lang> flips and the choice persists under `capoeira_lang`
//  - reload restores the stored language
//  - the `?just_donated=1` thank-you survives the on-load setLang() pass (this
//    page's one integration wrinkle: its own inline script rewrites the same
//    heading <p> that i18n.js also owns).
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
describe('transparency.html i18n toggle (headless browser)', () => {
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

  const fileUrl = 'file://' + resolve(__dirname, '..', 'transparency.html');

  it('injects the toggle and swaps transparency.* + nav.* EN -> PT', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem('capoeira_lang'));
    await page.reload({ waitUntil: 'load', timeout: 20000 });

    expect(await page.$('#lang-toggle')).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

    // Page-local string in English.
    const headingEn = await page.$eval('[data-i18n="transparency.heading"]', (el) => el.textContent);
    expect(headingEn).toBe('Where Every Dollar Goes');

    // aria-label attribute target in English (hamburger).
    const menuEn = await page.$eval('#hamburger-btn', (el) => el.getAttribute('aria-label'));
    expect(menuEn).toBe('Menu');

    // Shared nav string in English.
    const navHomeEn = await page.$eval('#primary-nav-links a', (el) => el.textContent);
    expect(navHomeEn).toBe('Home');

    await page.evaluate(() => (window as any).setLang('pt'));

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt');

    // Page-local string translated.
    const headingPt = await page.$eval('[data-i18n="transparency.heading"]', (el) => el.textContent);
    expect(headingPt).toBe('Para Onde Vai Cada D\u00f3lar');

    // A fee-calc row label translated.
    const donationPt = await page.$eval('[data-i18n="transparency.calc.donation"]', (el) => el.textContent);
    expect(donationPt).toBe('Sua doa\u00e7\u00e3o:');

    // HTML-valued key inside the flow list: proves data-i18n-html sets innerHTML.
    const step1Pt = await page.$eval('[data-i18n-html="transparency.flow.step1"]', (el) => el.innerHTML);
    expect(step1Pt).toContain('<strong>Stripe Checkout</strong>');
    expect(step1Pt).toContain('Voc\u00ea doa');

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
    const heading = await page.$eval('[data-i18n="transparency.heading"]', (el) => el.textContent);
    expect(heading).toBe('Para Onde Vai Cada D\u00f3lar');
  }, TIMEOUT);

  it('keeps the ?just_donated=1 thank-you through the on-load i18n pass', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    // The page's own inline script rewrites the heading <p> under ?just_donated=1;
    // it must re-key that element onto transparency.thankyou so i18n.js's deferred
    // init() does not overwrite the thank-you with the default sub.
    // Reset the persisted language first -- a prior test leaves `pt` in
    // localStorage, and the thank-you is (correctly) rendered in the stored
    // language, so assert against a known EN start.
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem('capoeira_lang'));
    await page.goto(fileUrl + '?just_donated=1', { waitUntil: 'load', timeout: 20000 });

    const el = await page.$eval('.section-heading p', (el) => ({
      text: el.textContent || '',
      key: el.getAttribute('data-i18n'),
    }));
    expect(el.key).toBe('transparency.thankyou');
    expect(el.text).toContain('Thank you for your donation');

    // And it translates too: after switching to PT the thank-you is Portuguese.
    await page.evaluate(() => (window as any).setLang('pt'));
    const ptText = await page.$eval('.section-heading p', (el) => el.textContent || '');
    expect(ptText).toContain('Obrigado pela sua doa\u00e7\u00e3o');
  }, TIMEOUT);
});
