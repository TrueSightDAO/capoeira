import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page } from 'puppeteer';

const TIMEOUT = 40000;

// PR9 of CAPOEIRA_I18N_PLAN: cross-page persistence QA. Every per-page test proves
// a page's OWN toggle works in isolation; this one proves the actual feature Gary
// asked for -- "flip between English and Portuguese and RETAIN that preference" --
// across page boundaries. It sets the language once, then walks the header nav
// through all 8 pages by CLICKING the nav links (a real navigation, not a fresh
// goto that re-seeds localStorage), asserting each destination loads already in
// the persisted language. Both directions (EN->PT and PT->EN).
// Gated on VITEST_INTEGRATION so the default `vitest run` (no Chromium) stays green.
const PAGES = [
  'index',
  'practice',
  'library',
  'roda',
  'transparency',
  'berimbau',
  'community',
  'roots',
] as const;

describe('cross-page language persistence (headless browser)', () => {
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

  const url = (p: string) => 'file://' + resolve(__dirname, '..', `${p}.html`);

  // Walk the header nav from page to page, clicking each target's link and waiting
  // for the resulting navigation. Returns the observed state on each landing page.
  async function clickThrough(startLang: 'en' | 'pt') {
    await page.goto(url('index'), { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem('capoeira_lang'));
    await page.reload({ waitUntil: 'load', timeout: 20000 });
    if (startLang === 'pt') await page.evaluate(() => (window as any).setLang('pt'));

    const observed: { target: string; lang: string; stored: string | null; navHome: string }[] = [];
    for (const target of PAGES) {
      const clicked = await page.evaluate((t) => {
        const links = Array.from(document.querySelectorAll('#primary-nav-links a'));
        const a = links.find((x) => ((x.getAttribute('href') || '').split('#')[0] === `${t}.html`)) as
          | HTMLAnchorElement
          | undefined;
        if (!a) return false;
        a.click();
        return true;
      }, target);
      expect(clicked, `no nav link to ${target}.html`).toBe(true);
      await page.waitForNavigation({ waitUntil: 'load', timeout: 20000 });

      expect(await page.evaluate(() => location.pathname.split('/').pop())).toBe(`${target}.html`);
      observed.push({
        target,
        lang: await page.evaluate(() => document.documentElement.lang),
        stored: await page.evaluate(() => localStorage.getItem('capoeira_lang')),
        navHome: await page.$eval('#primary-nav-links a', (el) => el.textContent!.trim()),
      });
    }
    return observed;
  }

  it('PT selected on one page is retained on every other page (click-through)', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    const observed = await clickThrough('pt');
    for (const o of observed) {
      expect(o.lang, `${o.target}: <html lang>`).toBe('pt');
      expect(o.stored, `${o.target}: localStorage`).toBe('pt');
      // nav.home is a shared common.js string -- proof the engine re-applied on load.
      expect(o.navHome, `${o.target}: nav label`).toBe('In\u00edcio');
    }
  }, TIMEOUT);

  it('EN is retained on every other page (click-through)', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    const observed = await clickThrough('en');
    for (const o of observed) {
      expect(o.lang, `${o.target}: <html lang>`).toBe('en');
      // Default language is not persisted until the user actively toggles, but the
      // document must still render EN on every page.
      expect(o.navHome, `${o.target}: nav label`).toBe('Home');
    }
  }, TIMEOUT);
});
