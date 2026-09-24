import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// Regression guard (PR7 of CAPOEIRA_I18N_PLAN): an unescaped apostrophe inside a
// single-quoted string in a page's inline `window.I18N_PAGE` block is a silent
// killer — the whole block throws a SyntaxError at parse time, so I18N_PAGE is
// never defined and every key falls back to its literal name. That is exactly the
// bug caught on community.html during PR7 ("Miguel's" terminated the string).
//
// This test parse-checks each page's inline page-local dictionary WITHOUT a
// browser, so the default `vitest run` catches it, not just the integration pass.
const PAGES = readdirSync(resolve(__dirname, '..')).filter((f) => f.endsWith('.html'));

describe('inline I18N_PAGE blocks parse cleanly', () => {
  for (const page of PAGES) {
    it(`${page} inline dictionary is valid JS`, () => {
      const html = readFileSync(resolve(__dirname, '..', page), 'utf8');
      // Grab the <script> block(s) that assign window.I18N_PAGE.
      const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1])
        .filter((js) => js.includes('window.I18N_PAGE'));
      for (const js of blocks) {
        // Construction parses the source (throws on SyntaxError) without running it.
        expect(() => new Function(js)).not.toThrow();
      }
    });
  }
});
