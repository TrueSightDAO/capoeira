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

    function render() {
      if (!container) return;

      if (filteredMoves.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem;color:var(--color-text-light)">No moves match the current filters</td></tr>';
      } else {
        container.innerHTML = filteredMoves.map(m => `
          <tr>
            <td>
              <strong>${m.name_pt}</strong><br>
              <small style="color:var(--color-text-light)">${m.name_en}</small>
            </td>
            <td><span class="theme-tag ${m.theme.toLowerCase()}">${m.theme}</span></td>
            <td><span class="diff-tag ${m.difficulty.toLowerCase()}">${m.difficulty}</span></td>
            <td>${m.duration_minutes} min</td>
            <td><span class="theme-tag ${(m.tempo_range || 'medium').toLowerCase()}">${m.tempo_range || 'Medium'}</span></td>
          </tr>
        `).join('');
      }
    }

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
