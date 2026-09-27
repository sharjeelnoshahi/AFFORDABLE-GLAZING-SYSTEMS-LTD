# AGS Improvements Roadmap

## Done
- **v1.2** Quotes workflow, notes, email, dashboard metrics, shortcuts
- **v1.3** reporting.js, monthly table, CAD redo, CSV exports
- **v1.4** Customer edit, SVG import, PDF notes parity, monthly bars

## Deferred (higher risk / needs more design)
| Item | Why deferred |
|------|----------------|
| Full SQLite migration | Data migration risk; current JSON DB is stable |
| Full app.html split into many modules | EMBEDDED_BACKUP size; do in dedicated refactor branch |
| Code signing | Needs company certificate |
| electron-updater | Needs release host |

## Optional later
- Dimension tool in CAD (draw mm labels)
- Simple canvas bar chart
- Quote line-item notes
