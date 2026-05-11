/**
 * session-generator.js — §4.1 Session Generator Logic
 * 
 * Algorithm:
 * 1. Load last 3-4 sessions from localStorage.session_history
 * 2. Pick a theme not used in last 2 sessions
 * 3. From theme's moves, pick 4-6 weighted by:
 *    - Difficulty bias toward Beginner/Intermediate (configurable)
 *    - Total duration_minutes summing to ~45 (±10)
 *    - Recency penalty: a move in last session has lower weight
 * 4. Pick music tracks matching the theme's tempo arc
 * 5. Render session card
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'capoeira_session_history';
  const TARGET_DURATION = 45;
  const DURATION_TOLERANCE = 10;
  const MIN_MOVES = 4;
  const MAX_MOVES = 6;
  const RECENCY_LOOKBACK = 2;  // themes not in last N sessions

  const DIFFICULTY_WEIGHTS = {
    Beginner:     1.0,
    Intermediate: 0.85,
    Advanced:     0.45
  };

  /**
   * Load JSON data safely
   */
  async function loadJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
    return resp.json();
  }

  /**
   * Retrieve session history from localStorage
   */
  function getSessionHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Pick a theme not used in the last RECENCY_LOOKBACK sessions.
   * Falls back to the least-recently-used viable theme if all viable themes are recent.
   *
   * A theme is "viable" if it has at least MIN_MOVES candidates — otherwise
   * pickMoves() can't fill out a 4-6 move session from that theme alone.
   * (Currently this filters out Foundation [Ginga only] and Flow [Giro + intro]
   * until the curriculum-based session structure ships — see follow-up.)
   */
  function pickTheme(moves, history) {
    const allThemes = [...new Set(moves.map(m => m.theme))];
    const viableThemes = allThemes.filter(
      t => moves.filter(m => m.theme === t).length >= MIN_MOVES
    );

    // Safety net: if nothing is viable, fall back to all themes (and pickMoves
    // will just return whatever it can find).
    const themePool = viableThemes.length > 0 ? viableThemes : allThemes;

    const recentThemes = history.slice(-RECENCY_LOOKBACK).map(s => s.theme);
    const available = themePool.filter(t => !recentThemes.includes(t));

    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }

    // All viable themes were used recently — pick the least-recently-used one.
    const themeLastUsed = {};
    themePool.forEach(t => { themeLastUsed[t] = -1; });
    history.forEach((s, i) => { themeLastUsed[s.theme] = i; });

    const sorted = [...themePool].sort((a, b) => themeLastUsed[a] - themeLastUsed[b]);
    return sorted[0];
  }

  /**
   * Pick 4-6 moves from a theme, weighted by difficulty bias, recency penalty,
   * and summing to ~45min (±10).
   * 
   * @param {Array} moves - all moves
   * @param {string} theme - selected theme
   * @param {Array} history - session history for recency penalty
   * @param {Object} bias - difficulty weight overrides (optional)
   * @return {Array} selected moves (4-6)
   */
  function pickMoves(moves, theme, history, bias = {}) {
    const diffWeights = { ...DIFFICULTY_WEIGHTS, ...bias };
    const lastSessionMoveIds = history.length > 0
      ? (history[history.length - 1].moves || []).map(m => m.id)
      : [];

    let candidates = moves.filter(m => m.theme === theme);

    // Score each candidate: difficulty bias * recency penalty
    candidates = candidates.map(m => {
      let weight = diffWeights[m.difficulty] || 0.5;

      // Recency penalty: 0.5x multiplier if move was in last session
      // MULTIPLICATIVE, not a hard gate — a move can still be selected
      if (lastSessionMoveIds.includes(m.id)) {
        weight *= 0.5;
      }

      return { ...m, _weight: weight };
    });

    // Sort by weight descending (prefer higher-weighted moves first)
    candidates.sort((a, b) => b._weight - a._weight);

    // Greedy subset selection: pick moves that sum to ~45min
    const selected = [];
    let totalDur = 0;
    const target = TARGET_DURATION;
    const minTarget = target - DURATION_TOLERANCE;
    const maxTarget = target + DURATION_TOLERANCE;

    // Weighted random selection: higher-weight moves are more likely to be picked early
    for (let i = 0; i < candidates.length && selected.length < MAX_MOVES; i++) {
      // Skip if adding this move would exceed max target and we already have MIN_MOVES
      if (totalDur + candidates[i].duration_minutes > maxTarget && selected.length >= MIN_MOVES) {
        continue;
      }

      selected.push(candidates[i]);
      totalDur += candidates[i].duration_minutes;

      if (totalDur >= minTarget && selected.length >= MIN_MOVES) break;
    }

    // If we couldn't reach min target, add more moves
    for (let i = 0; i < candidates.length && totalDur < minTarget && selected.length < MAX_MOVES; i++) {
      if (selected.includes(candidates[i])) continue;
      selected.push(candidates[i]);
      totalDur += candidates[i].duration_minutes;
    }

    // If still too few moves, pad with remaining
    if (selected.length < MIN_MOVES) {
      for (let i = 0; i < candidates.length && selected.length < MIN_MOVES; i++) {
        if (selected.includes(candidates[i])) continue;
        selected.push(candidates[i]);
        totalDur += candidates[i].duration_minutes;
      }
    }

    return selected.map(m => {
      const { _weight, ...move } = m;
      return move;
    });
  }

  /**
   * Pick music tracks: slow → medium-fast → cool-down arc
   * matching the selected theme's moves' tempo_range.
   */
  function pickMusic(musicLibrary, selectedMoves, count = 4) {
    const tempoMap = { Slow: 0, Medium: 1, Fast: 2 };
    const moveTempos = selectedMoves.map(m => tempoMap[m.tempo_range] || 1);
    const avgTempo = moveTempos.reduce((a, b) => a + b, 0) / moveTempos.length;

    // Arc: start slow-ish, middle faster, end slow
    const arcTempos = [];
    if (count >= 4) {
      arcTempos.push('Slow', 'Medium', 'Medium', 'Slow');
    } else if (count === 3) {
      arcTempos.push('Slow', 'Medium', 'Slow');
    } else {
      arcTempos.push('Medium', 'Slow');
    }

    const selected = [];
    const used = new Set();

    for (const tempo of arcTempos) {
      const candidates = musicLibrary.filter(t => t.tempo_category === tempo && !used.has(t.id));
      if (candidates.length === 0) {
        // Fallback to any unused
        const fallback = musicLibrary.filter(t => !used.has(t.id));
        if (fallback.length > 0) {
          const pick = fallback[Math.floor(Math.random() * fallback.length)];
          selected.push(pick);
          used.add(pick.id);
        }
      } else {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        selected.push(pick);
        used.add(pick.id);
      }
    }

    return selected;
  }

  /**
   * Extract the YouTube video ID from a watch URL.
   * Supports https://www.youtube.com/watch?v=ID and https://youtu.be/ID forms.
   */
  function extractYouTubeId(url) {
    if (!url) return null;
    let m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
    m = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
    return null;
  }

  /**
   * Render the session card into the DOM.
   *
   * Each move renders as a card with Bico Duro's YouTube thumbnail (clickable
   * to open in a new tab) + PT/EN names + duration. Lightweight: thumbnails
   * are static images (i.ytimg.com), no iframe per move.
   */
  function renderSessionCard(theme, moves, music, totalTime) {
    const container = document.getElementById('session-card');

    const themeBadge = `<div class="theme-badge">${theme}</div>`;

    const moveCards = moves.map((m, i) => {
      const ytId = extractYouTubeId(m.youtube_clip_url);
      const thumb = ytId
        ? `<a href="${m.youtube_clip_url}" target="_blank" rel="noopener" class="move-thumb-link" aria-label="Watch ${m.name_pt} demo by Bico Duro">
             <img src="https://i.ytimg.com/vi/${ytId}/mqdefault.jpg" alt="${m.name_pt} demo by Bico Duro" loading="lazy" class="move-thumb">
             <span class="move-thumb-play" aria-hidden="true">▶</span>
           </a>`
        : `<div class="move-thumb move-thumb-placeholder" aria-hidden="true">no video</div>`;
      return `
        <li class="move-preview-card">
          <div class="move-preview-index">${i + 1}</div>
          ${thumb}
          <div class="move-preview-body">
            <div class="move-name-pt">${m.name_pt}</div>
            <div class="move-name-en">${m.name_en}</div>
            <div class="move-preview-meta">
              <span class="diff-tag ${m.difficulty.toLowerCase()}">${m.difficulty}</span>
              <span class="theme-tag ${(m.tempo_range || 'medium').toLowerCase()}">${m.tempo_range || 'Medium'}</span>
              <span class="move-duration">~${m.duration_minutes} min</span>
            </div>
          </div>
        </li>`;
    }).join('');

    const musicItems = music.map(t =>
      `<span class="music-chip">${t.title} (${t.tempo_category}, ${t.bpm}bpm)</span>`
    ).join(' ');

    container.innerHTML = `
      ${themeBadge}
      <h3>Your ${theme} Session</h3>
      <p style="color:var(--color-text-light);margin-bottom:1rem">Click any thumbnail to preview Bico Duro's demo on YouTube before you start.</p>
      <ol class="move-preview-list">${moveCards}</ol>
      <h4 style="margin-top:1.5rem;margin-bottom:0.5rem">Music</h4>
      <div class="music-list">${musicItems}</div>
      <div class="session-total">Total estimated time: ~${totalTime} minutes</div>
    `;

    // Store session plan for practice-flow.js
    window.__sessionPlan = { theme, moves, music, totalTime };
  }

  /**
   * Main entry point — called from practice.html
   */
  window.generateSession = async function (bias = {}) {
    const statusEl = document.getElementById('generator-status');
    const cardEl = document.getElementById('session-card');
    const startBtn = document.getElementById('start-session-btn');

    try {
      statusEl.textContent = 'Loading move library...';
      statusEl.className = 'loading';

      const [moves, music] = await Promise.all([
        loadJSON('data/moves.json'),
        loadJSON('data/music_library.json')
      ]);

      if (moves.length === 0) {
        statusEl.textContent = 'No moves available yet — Phase 1 data still being curated.';
        statusEl.className = 'error';
        return;
      }

      const history = getSessionHistory();
      const theme = pickTheme(moves, history);
      const selectedMoves = pickMoves(moves, theme, history, bias);
      const selectedMusic = pickMusic(music, selectedMoves);
      const totalTime = selectedMoves.reduce((sum, m) => sum + m.duration_minutes, 0);

      renderSessionCard(theme, selectedMoves, selectedMusic, totalTime);

      statusEl.textContent = '';
      statusEl.className = '';
      cardEl.classList.remove('hidden');
      startBtn.classList.remove('hidden');

      // Mobile: ensure the just-revealed Start Practice button is visible.
      // Without this, on a small viewport the button can render below the
      // fold (especially below iOS Safari's bottom toolbar) and the user
      // doesn't realize it appeared. Smooth scroll keeps the context.
      // Use rAF + setTimeout so layout settles after the .hidden -> visible
      // class change before measuring.
      requestAnimationFrame(function () {
        setTimeout(function () {
          startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      });
    } catch (err) {
      statusEl.textContent = 'Could not generate session: ' + err.message;
      statusEl.className = 'error';
    }
  };
})();
