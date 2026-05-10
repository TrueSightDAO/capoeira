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
├── library.html         # Move library (searchable/filterable)
├── practice.html        # Session generator + practice flow + history
├── transparency.html    # Donation flow summary + fee calculator
├── assets/
│   ├── css/styles.css
│   ├── js/session-generator.js
│   ├── js/practice-flow.js
│   ├── js/move-library.js
│   ├── js/session-history.js
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
└── README.md
```

## Deploy

Deploys via GitHub Pages from the `capoeira` repo, custom domain `capoeira.agroverse.shop`.

### DNS

CNAME record: `capoeira.agroverse.shop` → `<username>.github.io`

### GitHub Pages config

- Source: Deploy from a branch
- Branch: `main` / `(root)`

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
