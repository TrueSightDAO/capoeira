/**
 * move-library.js — §4.4 Move Library (Searchable/Filterable Index)
 * 
 * Loads moves.json and renders a filterable table with:
 * - Text search across name_pt, name_en, notes, transcript_pt
 * - Theme dropdown filter
 * - Difficulty dropdown filter
 * - Tempo dropdown filter
 * - Sort by name, difficulty, duration
 */

(function () {
  'use strict';

  let allMoves = [];
  let filteredMoves = [];

  async function init() {
    const container = document.getElementById('move-table-body');
    const searchInput = document.getElementById('library-search');
    const themeFilter = document.getElementById('filter-theme');
    const diffFilter = document.getElementById('filter-difficulty');
    const tempoFilter = document.getElementById('filter-tempo');
    const emptyState = document.getElementById('library-empty');
    const tableEl = document.getElementById('move-table');

    try {
      const resp = await fetch('data/moves.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      allMoves = await resp.json();
    } catch (err) {
      if (emptyState) emptyState.innerHTML = `<p class="error">Could not load move library: ${err.message}</p>`;
      return;
    }

    if (allMoves.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (tableEl) tableEl.classList.add('hidden');
      return;
    }

    filteredMoves = [...allMoves];

    function extractYouTubeId(url) {
      if (!url) return null;
      let m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
      if (m) return m[1];
      m = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
      return m ? m[1] : null;
    }

    function render() {
      if (!container) return;

      if (filteredMoves.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;color:var(--color-text-light)">No moves match the current filters</td></tr>';
      } else {
        container.innerHTML = filteredMoves.map((m, idx) => {
          const hasVideo = !!extractYouTubeId(m.youtube_clip_url);
          const rowClass = hasVideo ? '' : 'no-link';
          return `
          <tr data-move-id="${m.id}" class="${rowClass}" ${hasVideo ? 'role="button" tabindex="0"' : ''}>
            <td>
              <strong>${m.name_pt}</strong><br>
              <small style="color:var(--color-text-light)">${m.name_en}</small>
            </td>
            <td><span class="theme-tag ${m.theme.toLowerCase()}">${m.theme}</span></td>
            <td><span class="diff-tag ${m.difficulty.toLowerCase()}">${m.difficulty}</span></td>
            <td>${m.duration_minutes} min</td>
            <td><span class="theme-tag ${(m.tempo_range || 'medium').toLowerCase()}">${m.tempo_range || 'Medium'}</span></td>
          </tr>`;
        }).join('');
      }
    }

    function openModal(moveId) {
      const m = allMoves.find(x => x.id === moveId);
      if (!m) return;
      const ytId = extractYouTubeId(m.youtube_clip_url);
      const backdrop = document.getElementById('move-modal-backdrop');
      const body = document.getElementById('move-modal-body');
      if (!backdrop || !body) return;
      const embed = ytId
        ? `<div class="move-modal-video">
             <iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0" title="${m.name_pt} demo by Bico Duro" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
           </div>`
        : '';
      body.innerHTML = `
        <h3>${m.name_pt}</h3>
        <p class="move-modal-subtitle">${m.name_en}</p>
        <div class="move-modal-meta">
          <span class="theme-tag ${m.theme.toLowerCase()}">${m.theme}</span>
          <span class="diff-tag ${m.difficulty.toLowerCase()}">${m.difficulty}</span>
          <span class="theme-tag ${(m.tempo_range || 'medium').toLowerCase()}">${m.tempo_range || 'Medium'}</span>
          <span style="color:var(--color-text-light);font-size:0.85rem">${m.duration_minutes} min</span>
        </div>
        ${embed}
        ${m.notes ? `<p class="move-modal-notes">${m.notes}</p>` : ''}
        ${m.transcript_pt ? `<div class="move-modal-transcript"><strong>Bico Duro (PT):</strong> "${m.transcript_pt}"</div>` : ''}
        ${m.transcript_en ? `<div class="move-modal-transcript"><strong>Translation:</strong> "${m.transcript_en}"</div>` : ''}
      `;
      backdrop.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      const backdrop = document.getElementById('move-modal-backdrop');
      const body = document.getElementById('move-modal-body');
      if (!backdrop) return;
      backdrop.classList.add('hidden');
      // Clear the iframe to stop playback
      if (body) body.innerHTML = '';
      document.body.style.overflow = '';
    }

    // Row click → open modal (event delegation, works after re-render)
    container?.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-move-id]');
      if (!tr || tr.classList.contains('no-link')) return;
      openModal(tr.dataset.moveId);
    });
    container?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr[data-move-id]');
      if (!tr || tr.classList.contains('no-link')) return;
      e.preventDefault();
      openModal(tr.dataset.moveId);
    });
    // Modal close handlers
    document.getElementById('move-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'move-modal-backdrop') closeModal();
    });
    document.getElementById('move-modal-close')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    function applyFilters() {
      const search = (searchInput?.value || '').toLowerCase().trim();
      const theme = themeFilter?.value || '';
      const difficulty = diffFilter?.value || '';
      const tempo = tempoFilter?.value || '';

      filteredMoves = allMoves.filter(m => {
        if (search) {
          const fields = [m.name_pt, m.name_en, m.notes, m.transcript_pt, m.transcript_en].join(' ').toLowerCase();
          if (!fields.includes(search)) return false;
        }
        if (theme && m.theme !== theme) return false;
        if (difficulty && m.difficulty !== difficulty) return false;
        if (tempo && m.tempo_range !== tempo) return false;
        return true;
      });

      render();
    }

    // Wire up filter events
    searchInput?.addEventListener('input', applyFilters);
    themeFilter?.addEventListener('change', applyFilters);
    diffFilter?.addEventListener('change', applyFilters);
    tempoFilter?.addEventListener('change', applyFilters);

    // Initial render
    if (tableEl) tableEl.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    render();
  }

  // Auto-init if on the library page
  if (document.getElementById('move-table-body')) {
    init();
  }

  // Expose for manual init
  window.CapoeiraLibrary = { init };
})();
