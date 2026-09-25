# Tribo Bahia Mirim Capoeira Practice Platform

Static practice platform at [capoeira.agroverse.shop](https://capoeira.agroverse.shop).

## What

45-minute solo capoeira practice sessions pairing Bico Duro's move videos with curated berimbau-tempo music. Public donation flow whose net proceeds go to Tribo Bahia Mirim's after-school program in Itacare, Bahia.

## Develop

Open any HTML file in a browser — no build step, no framework.

```
python3 -m http.server 8000
# → http://localhost:8000
```

## Files

```
├── index.html           # Landing page (narrative, photos, donate CTA)
├── practice.html        # Session generator + practice flow + history
├── library.html         # Move library (searchable/filterable)
├── roda.html            # Roda — the music of capoeira
├── transparency.html    # Donation flow summary + fee calculator
├── berimbau.html        # How to make a berimbau
├── community.html       # Community life in Itacaré
├── roots.html           # Where the cacao grows
├── assets/
│   ├── css/styles.css
│   ├── js/
│   │   ├── i18n.js             # Shared EN/PT engine (header = the markup contract)
│   │   ├── i18n/common.js      # Nav/footer/toggle strings shared by every page
│   │   ├── nav.js              # Mobile hamburger nav
│   │   ├── session-generator.js
│   │   ├── practice-flow.js
│   │   ├── move-library.js
│   │   └── session-history.js
│   └── images/          # Add hero/thumbnail images here
├── data/
│   ├── moves.json              # 39 moves (Phase 1A), all with YouTube URLs on admin@truesight.me
│   ├── move_metadata.json      # title/transcript_pt/transcript_en/summary per move (upload source)
│   ├── segmentation_plan.json  # Whisper-word-timestamp cut windows used to slice each move
│   ├── youtube_videos.json     # idempotent state: move_id → YouTube video_id
│   ├── music_library.json      # Music track catalog (12 tracks, local MP3s)
│   └── music/                  # *.mp3 — local audio for practice sessions
├── scripts/
│   └── upload_clips_to_youtube.py  # Slice + upload, reuses agroverse_shop OAuth (admin@truesight.me)
├── test/                # Vitest unit + headless-browser i18n tests (see below)
└── README.md
```

## Deploy

Deploys via GitHub Pages from the `capoeira` repo, custom domain `capoeira.agroverse.shop`.

> There is **no beta/staging environment** for this repo — merging to `main` **is** the production deploy. Test locally before every merge.

### DNS

CNAME record: `capoeira.agroverse.shop` → `<username>.github.io`

### GitHub Pages config

- Source: Deploy from a branch
- Branch: `main` / `(root)`

## Internationalization (English / Portuguese)

Every page carries an **EN/PT toggle** in the header. Choosing a language stores it in
`localStorage('capoeira_lang')` and every other page reads that back on load, so the
preference is **retained as you navigate the site** (the plan's core requirement).

- **Engine:** `assets/js/i18n.js` — shared `t()` / `setLang()` + the DOM-apply loop; it also
  injects the toggle button itself. Its file header is the authoritative **markup contract**
  (including how to add a 9th page).
- **Shared strings:** `assets/js/i18n/common.js` (`nav.*`, `footer.*`, `lang.*`).
- **Per-page strings:** a small inline `window.I18N_PAGE = { en: {…}, pt: {…} }` on each page,
  merged over the common dictionary at init (page keys win on collision).
- **Default language:** English (the site's original language); storage key is the namespaced
  `capoeira_lang` (deliberately not SunMint's `sunmint_lang`).

Run the i18n tests — unit is Chromium-free; integration drives a real headless browser:

```
npx vitest run                        # unit
VITEST_INTEGRATION=1 npx vitest run   # + per-page toggle & cross-page persistence
```

> ⚠️ Portuguese strings are an **AI first-draft** pending native-reader review.

## Data pipeline (Phase 1A — shipped 2026-05-10)

Source: Bico Duro's two pre-compiled instructional uploads on TrueSight DAO's YouTube channel —
[cqKMvYbB1Kw](https://www.youtube.com/watch?v=cqKMvYbB1Kw) (beginner curriculum, 10 min) and
[zLPVWP5WQOg](https://www.youtube.com/watch?v=zLPVWP5WQOg) (intermediate rolê-drill, 13.6 min).

1. `yt-dlp` both source videos → local `.mp4`
2. `faster-whisper --language pt --word-timestamps` extracts Bico Duro's spoken move-name
   announcements with sub-second timing
3. `ffmpeg` cuts each per-move clip from announcement-to-next-announcement → `data/compiled_clips/<move_id>.mp4`
   (gitignored — regeneratable, ~181 MB locally)
4. Claude drafts EN translations + 1–2 sentence pedagogy summaries in `data/move_metadata.json`
5. `scripts/upload_clips_to_youtube.py` re-uploads each clip as an individual public YouTube
   video on admin@truesight.me, recording URLs in `data/youtube_videos.json`
6. `data/moves.json` is the merged Phase 1A artifact consumed by the site (spec §3 schema)

The 209 raw `.MOV` files in `~/Downloads/capoeira/` were originally intended as the source but
Whisper confirmed they have no intelligible spoken narration (phone mic at recording distance
+ outdoor setting). The compiled instructional uploads were the real source.

## Conventions

- No frontend frameworks — static HTML/CSS/vanilla JS
- Mirror [agroverse_shop](https://github.com/TrueSightDAO/agroverse_shop_beta) conventions
- Design tokens: `--color-primary: #3b3333`, `--color-accent: #fefc8f`, Playfair Display + Open Sans
- Video embeds: `youtube-nocookie.com`
- All session data is client-side (`localStorage`), no accounts or tracking

## Related repos

| Repo | Purpose | Deploys to |
|---|---|---|
| [`capoeira`](https://github.com/TrueSightDAO/capoeira) | **This repo** — practice platform site + move/music data + upload scripts | `capoeira.agroverse.shop` |
| [`tribomirimbahia`](https://github.com/TrueSightDAO/tribomirimbahia) | Ledger & transparency layer (donation flow, treasury-cache integration, transparency explorer) | `mirim-bahia.truesight.me` |
| [`treasury-cache`](https://github.com/TrueSightDAO/treasury-cache) | Public JSON ledger consumed by transparency dashboards | (raw GitHub) |
| [`agroverse_shop`](https://github.com/TrueSightDAO/agroverse_shop_beta) | Cross-link from `farms/baia-itacare/` (per spec §10) | `agroverse.shop` |

## License

No license yet. Contact Gary for permissions.

Phase 2 shipped: 2026-05-10
PWA + QR dojo poster shipped
