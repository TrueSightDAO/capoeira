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
│   ├── moves.json       # Move catalog (placeholder — Phase 1 fills this)
│   └── music_library.json # Music track catalog (placeholder)
└── README.md
```

## Deploy

Deploys via GitHub Pages from the `capoeira` repo, custom domain `capoeira.agroverse.shop`.

### DNS

CNAME record: `capoeira.agroverse.shop` → `<username>.github.io`

### GitHub Pages config

- Source: Deploy from a branch
- Branch: `main` / `(root)`

## Data pipeline

The `data/` directory is filled by Phase 1:

1. `analyze_incoming_videos.py` processes raw `.MOV` files from `~/Downloads/capoeira/`
2. Whisper transcribes Bico Duro's PT intro → `manifest.json`
3. Claude extracts move names, writes EN translations, drafts pedagogy notes
4. Gary reviews every entry before publish
5. Final `moves.json` is committed to this repo

## Conventions

- No frontend frameworks — static HTML/CSS/vanilla JS
- Mirror [agroverse_shop](https://github.com/anomalyco/agroverse_shop) conventions
- Design tokens: `--color-primary: #3b3333`, `--color-accent: #fefc8f`, Playfair Display + Open Sans
- Video embeds: `youtube-nocookie.com`
- All session data is client-side (`localStorage`), no accounts or tracking

## Related repos

| Repo | Purpose |
|---|---|
| `tribomirimbahia` | Project container, spec, brief, data pipeline |
| `capoeira` | This repo — the practice platform site |
| `truesight_me` | Transparency dashboard at `mirim-bahia.truesight.me` |
| `agroverse_shop` | Cross-link from `farms/baia-itacare/` |

## License

No license yet. Contact Gary for permissions.

Phase 2 shipped: 2026-05-10
