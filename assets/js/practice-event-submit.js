/**
 * practice-event-submit.js — sign + submit [PRACTICE EVENT] to Edgar
 *
 * On Finish Session this module:
 *   1. Ensures a localStorage RSA keypair (generates one if absent, anonymous).
 *   2. Builds the [PRACTICE EVENT] payload from a completed-session object.
 *   3. Signs it with RSASSA-PKCS1-v1_5 / SHA-256 (same shape as dapp).
 *   4. POSTs to Edgar /dao/submit_contribution.
 *   5. Marks the session as `submitted_at` in localStorage so it doesn't get re-submitted.
 *
 * It also exposes a `getCvUrl()` helper so the page can surface the
 * person's CV link immediately at Finish Session (slug = pk-<hash>
 * derived client-side from the public key — no server round-trip).
 *
 * Design doc:
 *   agentic_ai_context/CREDENTIALING_PLATFORM.md
 * Reuses the existing dapp keypair + signing pattern from:
 *   dapp/create_signature.html + dapp/report_contribution.html.
 */
(function () {
  'use strict';

  const EDGAR_SUBMIT_URL = 'https://edgar.truesight.me/dao/submit_contribution';
  const TRUESIGHT_BASE = 'https://truesight.me';

  // Match the dapp's localStorage keys so a user who has already
  // generated keys via dapp.truesight.me/create_signature.html reuses them.
  const LS_PUBLIC_KEY = 'publicKey';
  const LS_PRIVATE_KEY = 'privateKey';
  // History key used by session-history.js for the past-sessions dashboard.
  const LS_SESSION_HISTORY = 'capoeira_session_history';

  // ---- low-level helpers (mirror the dapp implementations) ----

  function base64ToArrayBuffer(b64) {
    const bin = window.atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function arrayBufferToBase64(buf) {
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return window.btoa(bin);
  }

  function base64ToBase64Url(b64) {
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Compute the canonical practitioner slug from a base64 public key.
   *
   * The GAS event-processor MUST use the same derivation when deciding
   * where to commit the practice event in lineage-credentials:
   *
   *   slug = "pk-" + base64url( SHA-256(base64-decoded public-key bytes) ).slice(0, 12)
   *
   * Truncation is fine — 12 chars of base64url = 72 bits of collision
   * resistance, far more than enough for the practitioner population.
   */
  async function publicKeyToSlug(publicKeyBase64) {
    const keyBytes = base64ToArrayBuffer(publicKeyBase64);
    const hashBuf = await window.crypto.subtle.digest('SHA-256', keyBytes);
    const b64 = arrayBufferToBase64(hashBuf);
    return 'pk-' + base64ToBase64Url(b64).slice(0, 12);
  }

  // ---- keypair management ----

  async function generateKeypair() {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify']
    );
    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const publicKeyBase64 = arrayBufferToBase64(publicKey);
    const privateKeyBase64 = arrayBufferToBase64(privateKey);
    localStorage.setItem(LS_PUBLIC_KEY, publicKeyBase64);
    localStorage.setItem(LS_PRIVATE_KEY, privateKeyBase64);
    return publicKeyBase64;
  }

  async function ensureKeypair() {
    let pub = localStorage.getItem(LS_PUBLIC_KEY);
    const priv = localStorage.getItem(LS_PRIVATE_KEY);
    if (pub && priv) return pub;
    pub = await generateKeypair();
    return pub;
  }

  function getStoredPublicKey() {
    return localStorage.getItem(LS_PUBLIC_KEY) || null;
  }

  async function getCvUrl() {
    const pub = getStoredPublicKey();
    if (!pub) return null;
    const slug = await publicKeyToSlug(pub);
    return `${TRUESIGHT_BASE}/credentials/#${slug}`;
  }

  // ---- payload + signing ----

  function buildPracticeEventText(session, opts) {
    const captured = (session.completedAt || new Date().toISOString());
    const moves = (session.moves || []).map(m => ({
      id: m.id,
      name_pt: m.name_pt,
      duration_seconds: Math.round((m.duration_minutes || 0) * 60),
    }));
    const music = (session.music || []).map(t => t.id || t.title);
    const totalMin = session.totalTime || Math.round(moves.reduce((s, m) => s + (m.duration_seconds || 0), 0) / 60);

    const payload = {
      theme: session.theme || '',
      moves_practiced: moves,
      music_played: music,
      total_practice_minutes: totalMin,
    };
    const payloadJson = JSON.stringify(payload, null, 2);

    return (
      '[PRACTICE EVENT]\n'
      + '- Program: capoeira-tribo-mirim\n'
      + '- Practice Type: training-session\n'
      + '- Practitioner Public Key: ' + opts.publicKey + '\n'
      + (opts.practitionerName ? '- Practitioner Name: ' + opts.practitionerName + '\n' : '')
      + '- Captured At: ' + captured + '\n'
      + '- Source URL: ' + opts.sourceUrl + '\n'
      + '- Payload JSON:\n' + payloadJson + '\n'
      + '--------'
    );
  }

  async function signRequestText(requestText) {
    const privateKeyB64 = localStorage.getItem(LS_PRIVATE_KEY);
    if (!privateKeyB64) throw new Error('No private key in localStorage');
    const privateKeyObj = await window.crypto.subtle.importKey(
      'pkcs8',
      base64ToArrayBuffer(privateKeyB64),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const encoder = new TextEncoder();
    const sig = await window.crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKeyObj,
      encoder.encode(requestText)
    );
    return arrayBufferToBase64(sig);
  }

  // ---- submit ----

  /**
   * Submit a completed practice session to Edgar.
   * @param {object} session — { theme, moves[], music[], totalTime, completedAt }
   * @returns {Promise<{ok:boolean, requestHash:string, slug:string, error?:string}>}
   */
  async function submitSession(session) {
    try {
      const publicKey = await ensureKeypair();
      const sourceUrl = window.location.href;
      const requestText = buildPracticeEventText(session, { publicKey, sourceUrl });
      const requestHash = await signRequestText(requestText);
      const shareText = (
        requestText
        + '\n\nMy Digital Signature: ' + publicKey
        + '\n\nRequest Transaction ID: ' + requestHash
        + '\n\nThis submission was generated using ' + sourceUrl
        + '\n\nVerify submission here: https://dapp.truesight.me/verify_request.html'
      );

      const formData = new FormData();
      formData.append('text', shareText);

      const resp = await fetch(EDGAR_SUBMIT_URL, { method: 'POST', body: formData });
      const ok = resp.ok;
      const slug = await publicKeyToSlug(publicKey);

      if (!ok) {
        const errText = await resp.text().catch(() => '');
        return { ok: false, requestHash, slug, error: 'HTTP ' + resp.status + ' ' + errText.slice(0, 120) };
      }

      // Mark this session as submitted in localStorage history so the
      // backfill scanner doesn't re-submit it.
      try {
        const raw = localStorage.getItem(LS_SESSION_HISTORY);
        const history = raw ? JSON.parse(raw) : [];
        if (Array.isArray(history)) {
          // Find the entry that matches by completedAt + theme — that's the
          // tightest identifier we have without modifying session-history.js.
          for (let i = history.length - 1; i >= 0; i--) {
            const h = history[i];
            if (h.completedAt === session.completedAt && h.theme === session.theme) {
              h.submitted_at = new Date().toISOString();
              h.request_transaction_id = requestHash;
              h.slug = slug;
              break;
            }
          }
          localStorage.setItem(LS_SESSION_HISTORY, JSON.stringify(history));
        }
      } catch (e) { /* non-fatal */ }

      return { ok: true, requestHash, slug };
    } catch (err) {
      console.error('[PracticeEventSubmit] submit failed:', err);
      return { ok: false, error: String(err && err.message || err) };
    }
  }

  /**
   * Scan localStorage session history for entries without `submitted_at`
   * and submit each. Used on page load so any sessions completed while
   * offline (or before this feature shipped) get backfilled.
   * @returns {Promise<{checked:number, submitted:number, errors:number}>}
   */
  async function backfillUnsent() {
    let checked = 0, submitted = 0, errors = 0;
    try {
      const raw = localStorage.getItem(LS_SESSION_HISTORY);
      const history = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(history)) return { checked: 0, submitted: 0, errors: 0 };
      const unsent = history.filter(h => h && !h.submitted_at);
      checked = unsent.length;
      for (const session of unsent) {
        const r = await submitSession(session);
        if (r.ok) submitted++;
        else errors++;
      }
    } catch (e) {
      console.error('[PracticeEventSubmit] backfill error:', e);
    }
    return { checked, submitted, errors };
  }

  window.CapoeiraPracticeSubmit = {
    ensureKeypair,
    getStoredPublicKey,
    publicKeyToSlug,
    getCvUrl,
    submitSession,
    backfillUnsent,
  };
})();
