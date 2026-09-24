/**
 * i18n/common.js — shared dictionary for strings that appear on EVERY page
 * (top nav, footer, and the language-toggle labels themselves).
 *
 * Loaded BEFORE i18n.js and before the page's inline `window.I18N_PAGE`.
 * i18n.js merges I18N_PAGE over I18N_COMMON, so a page can override any key
 * here if it ever needs a different wording.
 *
 * Keys are namespaced by surface: `nav.*`, `footer.*`, `lang.*`.
 */
window.I18N_COMMON = {
    en: {
        'nav.home': 'Home',
        'nav.practice': 'Practice',
        'nav.library': 'Move Library',
        'nav.roda': 'Roda',
        'nav.community': 'Community',
        'nav.berimbau': 'Berimbau',
        'nav.roots': 'Roots',
        'nav.transparency': 'Transparency',
        'nav.donate': 'Donate',

        'footer.tagline': 'Tribo Bahia Mirim Capoeira \u2014 Baia Itacare, Bahia, Brazil',

        'lang.english': 'English',
        'lang.portuguese': 'Portugu\u00eas'
    },
    pt: {
        'nav.home': 'In\u00edcio',
        'nav.practice': 'Pr\u00e1tica',
        'nav.library': 'Biblioteca de Movimentos',
        'nav.roda': 'Roda',
        'nav.community': 'Comunidade',
        'nav.berimbau': 'Berimbau',
        'nav.roots': 'Ra\u00edzes',
        'nav.transparency': 'Transpar\u00eancia',
        'nav.donate': 'Doar',

        'footer.tagline': 'Tribo Bahia Mirim Capoeira \u2014 Ba\u00eda de Itacar\u00e9, Bahia, Brasil',

        'lang.english': 'Ingl\u00eas',
        'lang.portuguese': 'Portugu\u00eas'
    }
};
