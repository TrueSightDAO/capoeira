/**
 * practice-event-submit.js — sign + submit [PRACTICE EVENT] to Edgar
 *
 * On Finish Session this module:
 *   1. Ensures a localStorage RSA keypair (generates one if absent, anonymous).
 *   2. Builds the [PRACTICE EVENT] payload from a completed-session object.
 *   3. Submits via DaoClient.submitEvent() — one call handles signing + POST.
 *   4. Marks the session as `submitted_at` in localStorage so it doesn't get re-submitted.
 *
 * It also exposes a `getCvUrl()` helper so the page can surface the
 * person's public record link immediately at Finish Session (slug = pk-<hash>
 * derived client-side from the public key — no server round-trip).
 *
 * Design doc:
 *   agentic_ai_context/CREDENTIALING_PLATFORM.md
 *
 * DaoClient is loaded from the CDN (unpkg @truesight_dao/dao-client@1.1.0-rc.1)
 * in practice.html before this script runs.
 *
 * Generated-by: Sophia (TrueSight Autopilot)
 */
(function () {
  'use strict';

  const TRUESIGHT_BASE = 'https://truesight.me';

  // Match the dapp's localStorage keys so a user who has already
  // generated keys via dapp.truesight.me/create_signature.html reuses them.
  const LS_PUBLIC_KEY = 'publicKey';
  const LS_PRIVATE_KEY = 'privateKey';
  // History key used by session-history.js for the past-sessions dashboard.
  const LS_SESSION_HISTORY = 'capoeira_session_history';

  // Instantiate the DAO client once. Uses localStorage-backed keypair
  // (auto-loads existing keys, generates new ones if absent).
  const client = new DaoClient({
    storagePrefix: 'truesight_dao_',
  });

  // ---- keypair management ----

  async function ensureKeypair() {
    // DaoClient constructor already loads or generates a keypair.
    // If the client has a publicKey, we're good.
    if (client.publicKey) return client.publicKey;
    // Fallback: generate explicitly (shouldn't normally be needed).
    const kp = await client.generateKeyPair();
    return kp.publicKey;
  }

  function getStoredPublicKey() {
    return client.publicKey || localStorage.getItem(LS_PUBLIC_KEY) || null;
  }

  async function getCvUrl() {
    const pub = getStoredPublicKey();
    if (!pub) return null;
    const slug = await client.getSlug();
    return `${TRUESIGHT_BASE}/programs/tribomirim/credentials/#${slug}`;
  }

  // ---- submit ----

  /**
   * Submit a completed practice session to Edgar.
   * @param {object} session — { theme, moves[], music[], totalTime, completedAt }
   * @returns {Promise<{ok:boolean, requestHash:string, slug:string, error?:string}>}
   */
  async function submitSession(session) {
    try {
      await ensureKeypair();

      const captured = (session.completedAt || new Date().toISOString());
      const moves = (session.moves || []).map(m => ({
        id: m.id,
        name_pt: m.name_pt,
        duration_seconds: Math.round((m.duration_minutes || 0) * 60),
      }));
      const music = (session.music || []).map(t => t.id || t.title);
      const totalMin = session.totalTime || Math.round(moves.reduce((s, m) => s + (m.duration_seconds || 0), 0) / 60);

      const result = await client.submitEvent({
        eventType: 'PRACTICE EVENT',
        fields: {
          Program: 'capoeira-tribo-mirim',
          'Practice Type': 'training-session',
          'Captured At': captured,
          'Source URL': window.location.href,
          Theme: session.theme || '',
          'Moves Practiced': JSON.stringify(moves),
          'Music Played': JSON.stringify(music),
          'Total Practice Minutes': String(totalMin),
        },
      });

      if (!result.ok) {
        return { ok: false, error: result.error || 'Submission failed', slug: result.slug };
      }

      const slug = result.slug;
      const requestHash = result.txId;

      // Mark this session as submitted in localStorage history so the
      // backfill scanner doesn't re-submit it.
      try {
        const raw = localStorage.getItem(LS_SESSION_HISTORY);
        const history = raw ? JSON.parse(raw) : [];
        if (Array.isArray(history)) {
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
    publicKeyToSlug: client.getSlug.bind(client),
    getCvUrl,
    submitSession,
    backfillUnsent,
  };
})();
