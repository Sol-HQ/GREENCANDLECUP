# Kill dev servers, clear Next.js cache, rebuild packages.
$ErrorActionPreference = "SilentlyContinue"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Stopping ports 3000 and 8787..."
Get-NetTCPConnection -LocalPort 3000,8787 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

Start-Sleep -Seconds 2

if (Test-Path "apps\web\.next") {
  Write-Host "Removing apps\web\.next..."
  Remove-Item -Recurse -Force "apps\web\.next"
}

Write-Host "Building packages..."
pnpm build:packages

Write-Host "Done. Start servers:"
Write-Host "  pnpm --filter @gcc/server dev"
Write-Host "  pnpm --filter web dev"
