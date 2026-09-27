# AGS Trade Pricing — Windows Installer Build

This package builds a normal Windows installer. The installed application does **not** require Python, pip, pywebview, or a separate Node.js installation.

## Build the installer

1. Install Node.js LTS on the computer used to build the installer:
   https://nodejs.org/
2. Open this folder.
3. Double-click `BUILD-WINDOWS.bat`.
4. The build downloads Electron/electron-builder dependencies and creates the output in `dist`.

Expected output:

- `AGS-Trade-Pricing-Setup-1.2.0.exe` — normal Windows installer
- `AGS-Trade-Pricing-Portable-1.2.0.exe` — portable version

## Install on another computer

Copy only the generated `AGS-Trade-Pricing-Setup-1.2.0.exe` to the other computer and run it. The other computer does not need Python, pip, pywebview, or Node.js.

The installer creates Start Menu and Desktop shortcuts. Application data is stored in the Windows per-user application-data directory and is preserved when the app is updated.

## Publisher name

The package metadata uses `Affordable Glazing Systems Ltd` as the publisher/company name. Windows will still show an unverified/unknown publisher warning until the final EXE is signed with a trusted code-signing certificate issued to the company.

## Important

Do not send the source/build ZIP to customers. Build the installer and distribute the generated EXE from `dist`.
