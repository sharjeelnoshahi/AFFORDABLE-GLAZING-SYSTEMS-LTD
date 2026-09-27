# AGS Trade Pricing — Desktop

**Local embedded database** (no cloud, no server). Electron app for trade quotations, price matrix, and CAD window/door designs.

**Version:** 1.4.0

## Quick start (development)

```bash
npm install
npm start
```

## Build Windows installer

1. Install [Node.js LTS](https://nodejs.org/)
2. Double-click `BUILD-WINDOWS.bat` (or run `BUILD-WINDOWS.ps1`)
3. Output in `dist/`:
   - `AGS-Trade-Pricing-Setup-1.4.0.exe` — NSIS installer
   - `AGS-Trade-Pricing-Portable-1.4.0.exe` — portable

Customers only need the EXE. They do **not** need Node, Python, or npm.

See **README-BUILD-WINDOWS.md** for publisher / code-signing notes.

## Database

| File | Purpose |
|------|---------|
| `ags.db` | Main database (settings, customers, quotes, matrix, CAD designs) |
| `ags-data.json` | Legacy — auto-migrated into `ags.db` on first run |
| `backups/` | Manual / migration backups |

**Location**

- Windows: `%APPDATA%\AGS-Trade-Pricing\AGS-Data\`
- Mac: `~/Library/Application Support/AGS-Trade-Pricing/AGS-Data/`
- Linux: `~/.config/AGS-Trade-Pricing/AGS-Data/`

### Tables

- `settings` — company, VAT, margin
- `customers` — client records
- `quotes` + `quote_items` — quotations and line items
- `matrix_window` — design × height → price
- `matrix_door` — door design prices
- `custom_designs` — CAD Craft saved designs (SVG + shapes)
- `meta` — DB version / timestamps

First run seeds **67 CAD designs + matrix** from `seed-data.json`.

## App sections

| Page | Purpose |
|------|---------|
| Dashboard | Counts, matrix coverage, recent quotes, total value |
| New Quote | Customer → design → options → basket → save |
| Quotes | Search, filter by status, view PDF, change status, duplicate |
| Matrix Studio | Edit supplier height/price matrix |
| Designs | Catalogue (click → open in quote) |
| CAD Craft | Draw custom designs, save to catalogue |
| Customers | CRM list |
| Settings | Company, VAT, margin, backup, data folder |

## Sharing the app

- **Developers / builders:** share this source folder + build the installer.
- **End users:** send only the generated Setup/Portable EXE from `dist/`.
- Do **not** send the source ZIP to customers.

## Email / data path

Settings → **Open data folder** shows where `ags.db` lives.  
CAD designs can also be exported as JSON from CAD Craft.
