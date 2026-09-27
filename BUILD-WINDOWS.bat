@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo AGS Trade Pricing - Windows Installer Builder
echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  echo Install the current Node.js LTS from https://nodejs.org/
  echo Then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS and try again.
  pause
  exit /b 1
)

echo Node version:
node --version
echo npm version:
npm --version
echo.

echo Installing build dependencies...
npm install
if errorlevel 1 (
  echo.
  echo Dependency installation failed.
  pause
  exit /b 1
)

echo.
echo Building AGS Trade Pricing installer and portable EXE...
npm run dist
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo BUILD COMPLETE
echo ==============================================
echo Installer and portable EXE are in the dist folder.
echo.
dir /b dist
pause
