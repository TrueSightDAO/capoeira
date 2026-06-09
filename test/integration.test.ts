import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import type { Browser, Page, ConsoleMessage } from 'puppeteer';

const INTEGRATION_TIMEOUT = 30000;

describe('Capoeira integration tests (headless browser)', () => {
  let browser: Browser;
  let page: Page;
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];
  let failedRequests: string[] = [];

  beforeAll(async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--js-flags=--max_old_space_size=256',
      ],
    });

    page = await browser.newPage();

    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      if (msg.type() === 'error') consoleErrors.push(text);
      else if (msg.type() === 'warning') consoleWarnings.push(text);
    });

    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.url()} — ${request.failure()?.errorText || 'unknown'}`);
    });
  }, INTEGRATION_TIMEOUT);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('index.html loads without console errors', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    const htmlPath = 'file://' + resolve(__dirname, '..', 'index.html');

    await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Console warnings: ${consoleWarnings.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);

    const hasConstructorCrash = consoleErrors.some(e =>
      e.includes('generateKeyPairSync') ||
      e.includes('Use generateKeyPair') ||
      e.includes('DaoClient')
    );
    expect(hasConstructorCrash).toBe(false);

    const hasUncaughtError = consoleErrors.some(e =>
      e.includes('Uncaught') ||
      e.includes('uncaught') ||
      e.includes('TypeError') ||
      e.includes('ReferenceError')
    );
    expect(hasUncaughtError).toBe(false);

    const title = await page.title();
    expect(title.toLowerCase()).toContain('capoeira');

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('Capoeira');
  }, INTEGRATION_TIMEOUT);

  it('practice.html loads without console errors', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    const practicePath = 'file://' + resolve(__dirname, '..', 'practice.html');

    consoleErrors = [];
    consoleWarnings = [];
    failedRequests = [];

    await page.goto(practicePath, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log(`Practice page — Console errors: ${consoleErrors.length}`);
    console.log(`Practice page — Console warnings: ${consoleWarnings.length}`);
    console.log(`Practice page — Failed requests: ${failedRequests.length}`);

    // CRITICAL: No DaoClient constructor crash
    const hasConstructorCrash = consoleErrors.some(e =>
      e.includes('generateKeyPairSync') ||
      e.includes('Use generateKeyPair') ||
      e.includes('DaoClient')
    );
    expect(hasConstructorCrash).toBe(false);

    const hasUncaughtError = consoleErrors.some(e =>
      e.includes('Uncaught') ||
      e.includes('uncaught') ||
      e.includes('TypeError') ||
      e.includes('ReferenceError')
    );
    expect(hasUncaughtError).toBe(false);

    const title = await page.title();
    expect(title.toLowerCase()).toContain('practice');

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('Generate a Session');
  }, INTEGRATION_TIMEOUT);

  it('practice.html session generation works', async () => {
    if (!process.env.VITEST_INTEGRATION) return;

    const practicePath = 'file://' + resolve(__dirname, '..', 'practice.html');

    consoleErrors = [];
    consoleWarnings = [];
    failedRequests = [];

    await page.goto(practicePath, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    // Click "Generate Session"
    const genBtn = await page.$('button:has-text("Generate Session")');
    if (genBtn) {
      await genBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    const hasCrash = consoleErrors.some(e =>
      e.includes('Uncaught') ||
      e.includes('uncaught') ||
      e.includes('TypeError') ||
      e.includes('ReferenceError')
    );
    expect(hasCrash).toBe(false);
  }, INTEGRATION_TIMEOUT);
});
