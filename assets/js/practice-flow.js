/**
 * practice-flow.js — §4.2 Practice Flow Logic
 * 
 * Steps through generated session moves:
 * - Display move: name_pt (large), name_en (subtitle), embedded YouTube, notes
 * - "Play Music" button starts YouTube music embed + countdown timer
 * - Timer runs for move's duration_minutes
 * - When timer ends → "Rest" prompt with 30s countdown → next move auto-loads
 * - Final move ends → "Log session" CTA writes to localStorage
 */

(function () {
  'use strict';

  let currentMoveIndex = 0;
  let moves = [];
  let music = [];
  let theme = '';
  let timerInterval = null;
  let remainingSeconds = 0;
  let totalSessionSeconds = 0;
  let isPaused = false;

  const REST_SECONDS = 30;

  /**
   * Start practice flow from a session plan (set by session-generator.js).
   */
  function startPractice() {
    const plan = window.__sessionPlan;
    if (!plan || !plan.moves || plan.moves.length === 0) {
      showError('No session plan. Generate a session first.');
      return;
    }

    moves = plan.moves;
    music = plan.music || [];
    theme = plan.theme || '';
    currentMoveIndex = 0;
    totalSessionSeconds = 0;

    document.getElementById('generate-section').classList.add('hidden');
    document.getElementById('practice-section').classList.remove('hidden');

    loadMove(0);
  }

  /**
   * Load a move into the practice view.
   */
  function loadMove(index) {
    if (index >= moves.length) {
      finishSession();
      return;
    }

    // Stop any currently playing audio
    const existingAudio = document.getElementById('practice-audio');
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.currentTime = 0;
    }

    currentMoveIndex = index;
    const move = moves[index];
    const moveTime = move.duration_minutes * 60;
    remainingSeconds = moveTime;

    // Persist state so refresh / open-in-new-window lands on this same move.
    if (window.CapoeiraSessionState && window.__sessionPlan) {
      window.CapoeiraSessionState.persist(window.__sessionPlan, index);
    }

    document.getElementById('move-pt').textContent = move.name_pt;
    document.getElementById('move-en').textContent = move.name_en;
    document.getElementById('move-notes').textContent = move.notes || '';

    // YouTube embed
    const videoContainer = document.getElementById('move-video');
    if (move.youtube_clip_url) {
      const videoId = extractYouTubeId(move.youtube_clip_url);
      if (videoId) {
        videoContainer.innerHTML = `
          <div class="video-embed">
            <iframe src="https://www.youtube-nocookie.com/embed/${videoId}" allowfullscreen></iframe>
          </div>`;
      } else {
        videoContainer.innerHTML = '<p class="loading">Video URL format not recognized</p>';
      }
    } else {
      videoContainer.innerHTML = '<p class="loading">Video coming soon — Phase 1 data being curated</p>';
    }

    // Music track for this move
    const musicTrack = music[index % music.length];
    const musicContainer = document.getElementById('music-player');
    if (musicTrack && musicTrack.audio_url) {
      musicContainer.innerHTML = `
        <div class="music-player-wrapper">
          <audio id="practice-audio" preload="auto" controls style="width:100%">
            <source src="${musicTrack.audio_url}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
          <div style="margin-top:0.5rem;font-size:0.9rem;color:var(--color-text-light)">
            ${musicTrack.title} (${musicTrack.tempo_category}, ${musicTrack.bpm}bpm)
          </div>
        </div>`;
    } else {
      musicContainer.innerHTML = '<p class="loading">Music track — audio file pending</p>';
    }

    // Reset UI
    document.getElementById('play-music-btn').classList.remove('hidden');
    document.getElementById('pause-btn').classList.add('hidden');
    document.getElementById('rest-section').classList.add('hidden');
    document.getElementById('move-progress').textContent = `Move ${index + 1} of ${moves.length}`;

    updateNavButtons();
    updateTimerDisplay();
    stopTimer();
  }

  /**
   * Toggle disabled state on prev/next based on bounds. On the final move,
   * relabel "Next →" to "Finish Session →" so the user has a clear way out
   * without sitting through the full timer + rest countdown.
   */
  function updateNavButtons() {
    const prev = document.getElementById('prev-move-btn');
    const next = document.getElementById('next-move-btn');
    if (prev) prev.disabled = currentMoveIndex <= 0;
    if (next) {
      next.disabled = false;
      const isLast = currentMoveIndex >= moves.length - 1;
      next.textContent = isLast ? 'Finish Session →' : 'Next →';
      next.setAttribute('aria-label', isLast ? 'Finish session' : 'Next move');
    }
  }

  /**
   * Manual navigation. Skips any in-flight timer / rest period and loads the
   * neighbouring move. Music+timer reset; user can re-click "Play Music".
   */
  function prevMove() {
    if (currentMoveIndex <= 0) return;
    loadMove(currentMoveIndex - 1);
  }
  function nextMove() {
    if (currentMoveIndex >= moves.length - 1) {
      finishSession();
      return;
    }
    loadMove(currentMoveIndex + 1);
    // Auto-start music on manual next — the user is in the flow.
    playMusicAndStart();
  }

  let audioEndedListener = null;

  /**
   * Start the countdown timer and play music.
   */
  function playMusicAndStart() {
    document.getElementById('play-music-btn').classList.add('hidden');
    document.getElementById('pause-btn').classList.remove('hidden');

    // Play the local audio element
    const audio = document.getElementById('practice-audio');
    if (audio) {
      audio.play().catch(err => {
        console.error('Audio playback failed:', err);
      });
    }

    // When music ends before the timer, auto-advance to next move.
    // On the very last move, just stop (don't advance).
    bindAudioEnded();

    startTimer();
  }

  /**
   * Listen for the audio ended event. If music finishes before the
   * move timer, auto-advance to the next move (or finish on last move).
   * No rest period — the music's natural end is the transition.
   */
  function bindAudioEnded() {
    const audio = document.getElementById('practice-audio');
    if (!audio) return;

    // Remove any previous listener to avoid stacking
    if (audioEndedListener) {
      audio.removeEventListener('ended', audioEndedListener);
    }

    audioEndedListener = function () {
      stopTimer();
      const isLastMove = currentMoveIndex >= moves.length - 1;
      if (isLastMove) {
        finishSession();
      } else {
        loadMove(currentMoveIndex + 1);
      }
    };
    audio.addEventListener('ended', audioEndedListener);
  }

  /**
   * Remove the audio ended listener (called when manually navigating,
   * so the old move's audio ending doesn't trigger a transition).
   */
  function unbindAudioEnded() {
    const audio = document.getElementById('practice-audio');
    if (audio && audioEndedListener) {
      audio.removeEventListener('ended', audioEndedListener);
      audioEndedListener = null;
    }
  }

  /**
   * Pause / Resume toggle
   */
  function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    btn.textContent = isPaused ? 'Resume' : 'Pause';

    const audio = document.getElementById('practice-audio');
    if (audio) {
      if (isPaused) {
        audio.pause();
      } else {
        audio.play().catch(err => {
          console.error('Audio playback failed:', err);
        });
      }
    }
  }

  /**
   * Start the move timer.
   */
  function startTimer() {
    isPaused = false;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      if (isPaused) return;

      remainingSeconds--;
      totalSessionSeconds++;

      updateTimerDisplay();
      updateProgressBar();

      if (remainingSeconds <= 0) {
        stopTimer();
        showRestPeriod();
      }
    }, 1000);
  }

  /**
   * Stop the timer interval.
   */
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    unbindAudioEnded();

    // Stop any playing audio
    const audio = document.getElementById('practice-audio');
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  /**
   * Update the countdown display (MM:SS format).
   */
  function updateTimerDisplay() {
    const el = document.getElementById('countdown');
    const mins = Math.floor(Math.max(0, remainingSeconds) / 60);
    const secs = Math.max(0, remainingSeconds) % 60;

    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Warning color when under 60 seconds
    if (remainingSeconds < 60) {
      el.classList.add('warning');
    } else {
      el.classList.remove('warning');
    }
  }

  /**
   * Update the progress bar.
   */
  function updateProgressBar() {
    const move = moves[currentMoveIndex];
    if (!move) return;

    const total = move.duration_minutes * 60;
    const elapsed = total - remainingSeconds;
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

    document.getElementById('progress-fill').style.width = pct + '%';
  }

  /**
   * Show the 30-second rest period.
   */
  function showRestPeriod() {
    document.getElementById('rest-section').classList.remove('hidden');
    document.getElementById('play-music-btn').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden');

    const isLastMove = currentMoveIndex >= moves.length - 1;
    document.getElementById('next-move-label').textContent = isLastMove
      ? 'Session Complete! Time to reflect.'
      : `Next: ${moves[currentMoveIndex + 1].name_pt}`;

    let restRemaining = REST_SECONDS;
    const restEl = document.getElementById('rest-countdown');
    restEl.textContent = REST_SECONDS;

    timerInterval = setInterval(() => {
      restRemaining--;
      restEl.textContent = Math.max(0, restRemaining);

      if (restRemaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;

        if (isLastMove) {
          finishSession();
        } else {
          loadMove(currentMoveIndex + 1);
          // Auto-start music when rest period naturally transitions.
          playMusicAndStart();
        }
      }
    }, 1000);
  }

  /**
   * Finish the session and show the log CTA.
   */
  function finishSession() {
    stopTimer();
    document.getElementById('practice-section').classList.add('hidden');
    document.getElementById('finish-section').classList.remove('hidden');

    const totalMin = Math.round(totalSessionSeconds / 60);
    document.getElementById('session-total-time').textContent = totalMin;

    // Store for logging
    window.__completedSession = {
      theme,
      moves,
      music,
      totalTime: totalMin,
      completedAt: new Date().toISOString()
    };

    // Persisted state isn't useful past the finish screen — clear it so
    // the next visit lands fresh, not back on the just-completed session.
    if (window.CapoeiraSessionState) window.CapoeiraSessionState.clear();

    // Sign + submit [PRACTICE EVENT] to Edgar, then surface the public record link.
    // Runs async — UI is non-blocking; the link section reveals once we
    // have the slug derived locally (no need to wait on the network).
    if (window.CapoeiraPracticeSubmit) {
      revealCvLinkOptimistically();
      window.CapoeiraPracticeSubmit.submitSession(window.__completedSession)
        .then(showSubmitResult)
        .catch(err => showSubmitResult({ ok: false, error: String(err) }));
    }
  }

  /**
   * Show the "open public record" link the moment the user finishes — the slug
   * is derived client-side from the localStorage public key, so we don't
   * need the network round-trip to know the URL. The credentials page itself will
   * render a "being generated" placeholder until the cache build catches
   * up; that handling is server-side on truesight.me.
   */
  async function revealCvLinkOptimistically() {
    try {
      await window.CapoeiraPracticeSubmit.ensureKeypair();
      const url = await window.CapoeiraPracticeSubmit.getCvUrl();
      const section = document.getElementById('cv-link-section');
      const anchor = document.getElementById('cv-link-anchor');
      if (url && anchor && section) {
        anchor.href = url;
        section.classList.remove('hidden');
      }
    } catch (e) { /* non-fatal */ }
  }

  function showSubmitResult(result) {
    const status = document.getElementById('submit-status');
    if (!status) return;
    if (result.ok) {
      status.textContent = 'Submitted — your training record is being updated.';
      status.style.color = 'var(--color-success, #2a8c3d)';
    } else {
      status.textContent = 'Submission deferred (' + (result.error || 'offline') + ') — we will retry on next visit.';
      status.style.color = 'var(--color-text-light, #888)';
    }
  }

  /**
   * Log session and show dashboard.
   */
  function logAndFinish() {
    if (window.CapoeiraHistory && window.CapoeiraHistory.logSession) {
      window.CapoeiraHistory.logSession(window.__completedSession);
    }
    document.getElementById('finish-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');

    if (window.CapoeiraHistory && window.CapoeiraHistory.renderDashboard) {
      window.CapoeiraHistory.renderDashboard('history-dashboard');
    }
  }

  /**
   * Reset to generate a new session.
   */
  function resetPractice() {
    stopTimer();
    // Clear persisted state so we start clean.
    if (window.CapoeiraSessionState) window.CapoeiraSessionState.clear();
    document.getElementById('practice-section').classList.add('hidden');
    document.getElementById('finish-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('generate-section').classList.remove('hidden');
    document.getElementById('session-card').classList.add('hidden');
    document.getElementById('start-session-btn').classList.add('hidden');

    // Restore the bits that hide once a session is generated, so the
    // overview page (history + generator preamble) is back to its initial
    // state. Mirror of the hide-on-generate logic in session-generator.js.
    var historySection = document.getElementById('history-summary-section');
    var preamble = document.getElementById('generator-preamble');
    var regenBtn = document.getElementById('regenerate-session-btn');
    var backBtn = document.getElementById('back-to-overview-btn');
    if (historySection) historySection.classList.remove('hidden');
    if (preamble) preamble.classList.remove('hidden');
    if (regenBtn) regenBtn.classList.add('hidden');
    if (backBtn) backBtn.classList.add('hidden');
  }

  // --- Helpers ---

  function extractYouTubeId(url) {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const p of patterns) {
      const match = url.match(p);
      if (match) return match[1];
    }
    return null;
  }

  function showError(msg) {
    const el = document.getElementById('practice-status');
    if (el) {
      el.textContent = msg;
      el.className = 'error';
    }
  }

  // Expose public API
  window.CapoeiraPractice = {
    start: startPractice,
    playMusic: playMusicAndStart,
    togglePause,
    prev: prevMove,
    next: nextMove,
    logAndFinish,
    reset: resetPractice
  };
})();
