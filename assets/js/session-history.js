/**
 * session-history.js — §4.3 localStorage Persistence + Streak Counter
 *
 * Features:
 * - Sessions completed this week (rolling 7d)
 * - Theme frequency breakdown (last 30d)
 * - Most/least practiced moves (top 5 / bottom 5)
 * - Streak counter (consecutive days with ≥1 session)
 * - All client-side, localStorage only. No backend.
 *
 * Schema mirrors session_history.json from the spec for future backend migration.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'capoeira_session_history';
  const STREAK_KEY = 'capoeira_streak_data';

  /**
   * Load all sessions from localStorage
   */
  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save sessions to localStorage
   */
  function saveSessions(sessions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn('localStorage quota exceeded — session not saved');
    }
  }

  /**
   * Log a completed session.
   * @param {Object} session - { theme, moves: [{id, name_pt, duration_minutes}], music: [{id, title}], totalTime, completedAt }
   */
  function logSession(session) {
    const sessions = loadSessions();
    sessions.push({
      timestamp: new Date().toISOString(),
      theme: session.theme || 'unknown',
      moves: (session.moves || []).map(m => ({
        id: m.id,
        name_pt: m.name_pt,
        duration_minutes: m.duration_minutes || 0
      })),
      music_tracks: (session.music || []).map(t => ({
        id: t.id,
        title: t.title
      })),
      total_duration_minutes: session.totalTime || 0
    });
    saveSessions(sessions);
    updateStreak();
  }

  /**
   * Get the current date as YYYY-MM-DD string in the user's local timezone.
   */
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /**
   * Convert YYYY-MM-DD to a Date object (local noon to avoid timezone shifts).
   */
  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  /**
   * Load streak data
   */
  function loadStreak() {
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      return raw ? JSON.parse(raw) : { lastDate: null, currentStreak: 0, longestStreak: 0 };
    } catch (e) {
      return { lastDate: null, currentStreak: 0, longestStreak: 0 };
    }
  }

  /**
   * Save streak data
   */
  function saveStreak(data) {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  }

  /**
   * Update streak counter after a session is logged.
   * Called automatically by logSession().
   */
  function updateStreak() {
    const today = todayStr();
    const streak = loadStreak();

    if (!streak.lastDate) {
      // First session ever
      streak.lastDate = today;
      streak.currentStreak = 1;
      streak.longestStreak = 1;
    } else {
      const last = parseDate(streak.lastDate);
      const now = parseDate(today);
      const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Already logged today — streak unchanged
      } else if (diffDays === 1) {
        // Consecutive day
        streak.currentStreak++;
        streak.lastDate = today;
        if (streak.currentStreak > streak.longestStreak) {
          streak.longestStreak = streak.currentStreak;
        }
      } else {
        // Gap — reset
        streak.currentStreak = 1;
        streak.lastDate = today;
      }
    }

    saveStreak(streak);
  }

  /**
   * Get streak data (current streak, longest streak)
   */
  function getStreak() {
    return loadStreak();
  }

  /**
   * Get sessions within the last N days.
   */
  function getSessionsInWindow(days = 7) {
    const sessions = loadSessions();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return sessions.filter(s => new Date(s.timestamp) >= cutoff);
  }

  /**
   * Sessions completed this week (rolling 7d).
   */
  function getWeekCount() {
    return getSessionsInWindow(7).length;
  }

  /**
   * Theme frequency breakdown over last 30 days.
   * Returns object: { theme: count, ... }
   */
  function getThemeBreakdown() {
    const sessions = getSessionsInWindow(30);
    const counts = {};
    sessions.forEach(s => {
      counts[s.theme] = (counts[s.theme] || 0) + 1;
    });
    return counts;
  }

  /**
   * Most/least practiced moves (by count over all history).
   * Returns { top5, bottom5 }
   */
  function getMoveStats() {
    const sessions = loadSessions();
    const counts = {};
    sessions.forEach(s => {
      (s.moves || []).forEach(m => {
        const key = m.id || m.name_pt;
        if (!counts[key]) counts[key] = { id: key, name: m.name_pt, count: 0 };
        counts[key].count++;
      });
    });

    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    return {
      top5: sorted.slice(0, 5),
      bottom5: sorted.slice(-5).reverse()
    };
  }

  /**
   * Clear all session data (for testing/reset).
   */
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STREAK_KEY);
  }

  /**
   * Render the history dashboard into the DOM.
   * Called from practice.html and index.html sidebar.
   */
  function renderDashboard(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const sessions = loadSessions();
    const streak = getStreak();
    const weekCount = getWeekCount();
    const themes = getThemeBreakdown();
    const { top5, bottom5 } = getMoveStats();

    if (sessions.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>No sessions yet. Start your first practice.</p></div>';
      return;
    }

    const themeBars = Object.entries(themes)
      .sort((a, b) => b[1] - a[1])
      .map(([theme, count]) =>
        `<div style="display:flex;justify-content:space-between;margin:0.25rem 0;font-size:0.9rem">
          <span>${theme}</span><span style="font-weight:700">${count}</span>
        </div>`
      ).join('');

    const topMovesList = top5.map((m, i) =>
      `<li>${m.name || m.id} <span style="color:var(--color-text-light)">— ${m.count}x</span></li>`
    ).join('');

    const bottomMovesList = bottom5.map((m, i) =>
      `<li>${m.name || m.id} <span style="color:var(--color-text-light)">— ${m.count}x</span></li>`
    ).join('');

    el.innerHTML = `
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-value">${weekCount}</div>
          <div class="stat-label">Sessions this week</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${streak.currentStreak}</div>
          <div class="stat-label">Day Streak</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${streak.longestStreak}</div>
          <div class="stat-label">Longest Streak</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${sessions.length}</div>
          <div class="stat-label">Total Sessions</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <div>
          <h4 style="margin-bottom:0.5rem">Themes (30 days)</h4>
          ${themeBars || '<span style="color:var(--color-text-light)">—</span>'}
        </div>
        <div>
          <h4 style="margin-bottom:0.5rem">Top Moves</h4>
          <ol style="font-size:0.9rem;padding-left:1.25rem">${topMovesList || '<li><span style="color:var(--color-text-light)">—</span></li>'}</ol>
          ${bottom5.length > 0 ? `
            <h4 style="margin:1rem 0 0.5rem">Least Practiced</h4>
            <ol style="font-size:0.9rem;padding-left:1.25rem">${bottomMovesList}</ol>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Expose public API
  window.CapoeiraHistory = {
    logSession,
    getSessionHistory: loadSessions,
    getStreak,
    getWeekCount,
    getThemeBreakdown,
    getMoveStats,
    clearHistory,
    renderDashboard
  };
})();
