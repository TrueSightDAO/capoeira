/**
 * session-state.js — URL hash persistence for the active practice session.
 *
 * Two pieces of state are persisted:
 *   - `s` : a compact JSON {th: theme, mv: [moveIds], mu: [musicIds]} of the
 *           current session plan. Present after Generate Session is clicked.
 *   - `m` : current move index. Present once Start Practice is clicked.
 *
 * Encoding lives in the URL hash (so it survives refresh AND can be copied
 * into a new window to resume the same move). A localStorage mirror exists
 * purely as a fallback if the user lands on /practice.html without the hash
 * (e.g. via a nav link) and has an in-flight session.
 *
 * Hash form: #s=<base64url>(&m=<int>)?
 *   - base64url so it survives URL encoding cleanly
 *   - We intentionally don't encode music or theme in `mu/th` if it can be
 *     reconstructed from mv — but theme + music are cheap, so include them.
 */
(function () {
  'use strict';

  const LS_KEY = 'capoeira_active_session_v1';

  function b64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    try { return decodeURIComponent(escape(atob(s))); } catch (e) { return null; }
  }

  function parseHash() {
    const h = (window.location.hash || '').replace(/^#/, '');
    if (!h) return {};
    const out = {};
    h.split('&').forEach(p => {
      const i = p.indexOf('=');
      if (i < 0) return;
      out[p.slice(0, i)] = p.slice(i + 1);
    });
    return out;
  }

  function writeHash(params) {
    const parts = [];
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        parts.push(k + '=' + params[k]);
      }
    });
    const hash = parts.length ? '#' + parts.join('&') : '';
    if ((window.location.hash || '') !== hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search + hash);
    }
  }

  /**
   * Persist a fresh session plan + optional move index. Called from
   * session-generator.js after Generate Session and from practice-flow.js
   * when the user navigates between moves.
   *
   * @param {Object} plan - { theme, moves: [{id,..}], music: [{id,..}] }
   * @param {number|null} moveIndex - current move index (null/undefined for
   *   pre-start preview state)
   */
  function persist(plan, moveIndex) {
    const payload = {
      th: plan.theme || '',
      mv: (plan.moves || []).map(m => m.id),
      mu: (plan.music || []).map(t => t.id),
    };
    const s = b64urlEncode(JSON.stringify(payload));
    const params = { s };
    if (typeof moveIndex === 'number') params.m = String(moveIndex);
    writeHash(params);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        payload,
        moveIndex: typeof moveIndex === 'number' ? moveIndex : null,
        savedAt: Date.now(),
      }));
    } catch (e) { /* quota — non-fatal */ }
  }

  /**
   * Read whatever state is encoded in the URL hash (preferred) or localStorage
   * (fallback). Returns null if nothing is recoverable.
   *
   * Hydrating the {moves, music} arrays needs the full library — caller is
   * responsible for joining the ids back to records.
   *
   * @returns {{th:string, mv:string[], mu:string[], moveIndex:(number|null), source:'hash'|'localStorage'}|null}
   */
  function read() {
    // Prefer hash so cross-window resumption works
    const hp = parseHash();
    if (hp.s) {
      const json = b64urlDecode(hp.s);
      if (json) {
        try {
          const p = JSON.parse(json);
          const mi = hp.m ? parseInt(hp.m, 10) : null;
          return { th: p.th || '', mv: p.mv || [], mu: p.mu || [], moveIndex: Number.isFinite(mi) ? mi : null, source: 'hash' };
        } catch (e) { /* fall through */ }
      }
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.payload) {
          return { th: obj.payload.th || '', mv: obj.payload.mv || [], mu: obj.payload.mu || [], moveIndex: typeof obj.moveIndex === 'number' ? obj.moveIndex : null, source: 'localStorage' };
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /** Wipe both URL hash + localStorage mirror — call when the user finishes
   *  or explicitly resets. */
  function clear() {
    writeHash({});
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  window.CapoeiraSessionState = { persist, read, clear };
})();
