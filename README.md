# Capoeira Practice Platform 🎵

Static-site capoeira practice tool that pairs Bico Duro's individual-move video clips with curated berimbau-tempo music to drive 45-minute solo sessions, plus a public donation flow whose net proceeds go to Tribo Bahia Mirim's after-school program in Itacaré.

## Repository Structure

```
capoeira/
├── data/
│   ├── music_library.json      # Track metadata (BPM, tempo_category, etc.)
│   └── music/                # MP3 files for practice sessions
├── assets/
│   ├── css/styles.css
│   ├── js/
│   └── images/
└── README.md
```

## Development Status

- ✅ **Phase 1B**: Music library curation and MP3 download
- 🔄 **Phase 1A**: Bico Duro move clip cataloging (in progress)
- ⏳ **Phase 2**: Core site build
- ⏳ **Phase 3**: Persistence & Analytics
- ⏳ **Phase 4**: Donation & Ledger Integration

## Deployment Target

- **Main site**: capoeira.agroverse.shop (GitHub Pages)
- **Transparency dashboard**: mirim-bahia.truesight.me

## Contributing

This project is part of the TrueSight DAO ecosystem. See [tribomirimbahia/AGENT_BRIEF.md](https://github.com/TrueSightDAO/tribomirimbahia) for detailed implementation guidelines.