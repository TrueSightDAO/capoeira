/**
 * i18n.js — shared English/Portuguese language engine for the Capoeira site.
 *
 * Mirrors SunMint's toggle mechanism (sunmint.truesight.me) but adapted to a
 * multi-page static site: the engine is shared, each page supplies only its own
 * strings. See agentic_ai_context/plans/CAPOEIRA_I18N_PLAN.md.
 *
 * Storage key: `capoeira_lang` (namespaced — deliberately NOT `sunmint_lang`).
 * Default language: `en` (the site's current/only language).
 *
 * ── Markup contract (each page) ─────────────────────────────────────────────
 *   1. Include, near the end of <body>, in this order:
 *        <script src="assets/js/i18n/common.js"></script>
 *        <script>window.I18N_PAGE = { en: { ... }, pt: { ... } };</script>
 *        <script src="assets/js/i18n.js" defer></script>
 *      (defer, so it runs after the page's own I18N_PAGE is defined.)
 *   2. Mark any element whose text should translate:
 *        <h2 data-i18n="someKey">English fallback</h2>
 *      The initial HTML text is the English string; setLang() overwrites it.
 *   3. Attribute targets:
 *        data-i18n               -> textContent
 *        data-i18n-html          -> innerHTML (strings that contain markup, e.g. <br>)
 *        data-i18n-placeholder   -> placeholder=""
 *        data-i18n-aria-label    -> aria-label=""
 *        data-i18n-alt           -> alt=""
 *        data-i18n-title         -> title=""
 *   4. The language toggle is injected automatically into <body> <header> <nav>
 *      right after the .logo anchor — no per-page toggle markup required.
 *   5. Keys: shared keys live in common.js (nav.*, footer.*, lang.*); page-local
 *      keys live in that page's I18N_PAGE. Page keys win on collision.
 *   6. Adding a new page (9th+): no change to i18n.js is needed. Copy the pattern
 *      from index.html -- include the three i18n tags (item 1), mark the page's
 *      content with data-i18n* attributes (items 2-3), and add a nav.* entry in
 *      common.js ONLY if the page joins the header nav. The engine picks it up
 *      automatically; localStorage('capoeira_lang') already persists across pages.
 * ────────────────────────────────────────────────────────────────────────────
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'capoeira_lang';
    var DEFAULT_LANG = 'en';
    var SUPPORTED = ['en', 'pt'];

    var currentLang = DEFAULT_LANG;

    // data-attribute -> target attribute (null => element textContent)
    var ATTR_TARGETS = [
        ['data-i18n', null],
        ['data-i18n-placeholder', 'placeholder'],
        ['data-i18n-aria-label', 'aria-label'],
        ['data-i18n-alt', 'alt'],
        ['data-i18n-title', 'title']
    ];

    var merged = { en: {}, pt: {} };

    function isSupported(lang) {
        return SUPPORTED.indexOf(lang) !== -1;
    }

    function assign(target, source) {
        var k;
        for (k in source) {
            if (Object.prototype.hasOwnProperty.call(source, k)) target[k] = source[k];
        }
        return target;
    }

    function buildDictionaries() {
        var common = window.I18N_COMMON || {};
        var page = window.I18N_PAGE || {};
        merged = { en: {}, pt: {} };
        SUPPORTED.forEach(function (lang) {
            merged[lang] = assign(assign({}, common[lang] || {}), page[lang] || {});
        });
    }

    function t(key) {
        if (!key) return '';
        var dict = merged[currentLang] || {};
        if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
        var fallback = merged[DEFAULT_LANG] || {};
        if (Object.prototype.hasOwnProperty.call(fallback, key)) return fallback[key];
        return key;
    }

    function apply(root) {
        var scope = root || document;
        ATTR_TARGETS.forEach(function (pair) {
            var attr = pair[0];
            var target = pair[1];
            var nodes = scope.querySelectorAll('[' + attr + ']');
            Array.prototype.forEach.call(nodes, function (el) {
                var value = t(el.getAttribute(attr));
                if (target === null) el.textContent = value;
                else el.setAttribute(target, value);
            });
        });
        var htmlNodes = scope.querySelectorAll('[data-i18n-html]');
        Array.prototype.forEach.call(htmlNodes, function (el) {
            el.innerHTML = t(el.getAttribute('data-i18n-html'));
        });
    }

    function updateButtons() {
        var en = document.getElementById('langEn');
        var pt = document.getElementById('langPt');
        if (en) {
            en.classList.toggle('active', currentLang === 'en');
            en.setAttribute('aria-pressed', String(currentLang === 'en'));
        }
        if (pt) {
            pt.classList.toggle('active', currentLang === 'pt');
            pt.setAttribute('aria-pressed', String(currentLang === 'pt'));
        }
    }

    function setLang(lang) {
        if (!isSupported(lang)) lang = DEFAULT_LANG;
        currentLang = lang;
        try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode */ }
        document.documentElement.lang = lang;
        updateButtons();
        apply(document);
    }

    function getLang() { return currentLang; }

    // ---- Toggle injection -------------------------------------------------
    function buildToggle() {
        var mount = document.getElementById('lang-toggle');
        if (!mount) {
            var nav = document.querySelector('body > header nav');
            if (!nav) return;
            mount = document.createElement('div');
            mount.className = 'lang-toggle';
            mount.id = 'lang-toggle';
            mount.setAttribute('role', 'group');
            mount.setAttribute('aria-label', 'Language / Idioma');
            var logo = nav.querySelector('a.logo');
            if (logo && logo.parentNode === nav) {
                logo.insertAdjacentElement('afterend', mount);
            } else {
                nav.appendChild(mount);
            }
        }
        if (mount.querySelector('button')) return; // already built

        var en = document.createElement('button');
        en.type = 'button';
        en.id = 'langEn';
        en.textContent = 'EN';
        en.setAttribute('onclick', "setLang('en')");
        en.setAttribute('title', t('lang.english'));
        en.setAttribute('aria-label', t('lang.english'));

        var pt = document.createElement('button');
        pt.type = 'button';
        pt.id = 'langPt';
        pt.textContent = 'PT';
        pt.setAttribute('onclick', "setLang('pt')");
        pt.setAttribute('title', t('lang.portuguese'));
        pt.setAttribute('aria-label', t('lang.portuguese'));

        mount.appendChild(en);
        mount.appendChild(pt);
    }

    function init() {
        buildDictionaries();
        var stored = null;
        try { stored = window.localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        currentLang = isSupported(stored) ? stored : DEFAULT_LANG;
        buildToggle();
        apply(document);
        updateButtons();
        document.documentElement.lang = currentLang;
    }

    // Public API (setLang is also called from injected inline onclick handlers).
    window.t = t;
    window.setLang = setLang;
    window.getLang = getLang;
    window.i18n = { t: t, setLang: setLang, getLang: getLang, apply: apply, init: init };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
