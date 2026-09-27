$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js was not found. Install Node.js LTS from https://nodejs.org/ and run this script again.' -ForegroundColor Yellow
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'npm was not found. Reinstall Node.js LTS and run this script again.' -ForegroundColor Yellow
  exit 1
}

Write-Host 'Installing build dependencies...' -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Building installer and portable EXE...' -ForegroundColor Cyan
npm run dist
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Build complete. Files are in .\dist' -ForegroundColor Green
Get-ChildItem .\dist | Select-Object Name, Length
