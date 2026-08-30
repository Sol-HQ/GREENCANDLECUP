Write-Host "=== GCC Phase 1 Gate Test ===" -ForegroundColor Cyan

function Test-Endpoint($name, $script) {
  try {
    & $script
    Write-Host "[OK] $name" -ForegroundColor Green
  } catch {
    Write-Host "[FAIL] $name - $($_.Exception.Message)" -ForegroundColor Red
  }
}

Test-Endpoint "API health" { Invoke-RestMethod http://localhost:8787/api/health | Out-Null }
Test-Endpoint "Phoenix market" { Invoke-RestMethod http://localhost:8787/api/market/SOL | Out-Null }
Test-Endpoint "Orderbook" { Invoke-RestMethod http://localhost:8787/api/orderbook/SOL | Out-Null }

Test-Endpoint "Paper order" {
  Invoke-RestMethod http://localhost:8787/api/orders -Method POST -ContentType 'application/json' -Headers @{'x-api-key'='dev'} -Body '{"symbol":"SOL","side":"buy","type":"market","sizeBase":"0.01","mode":"paper"}' | Out-Null
}

try {
  Invoke-RestMethod http://localhost:8787/api/orders -Method POST -ContentType 'application/json' -Headers @{'x-api-key'='dev'} -Body '{"symbol":"SOL","side":"buy","type":"market","sizeBase":"999","mode":"paper"}' | Out-Null
  Write-Host "[FAIL] Risk limit should block" -ForegroundColor Red
} catch {
  Write-Host "[OK] Risk limit blocks oversized order" -ForegroundColor Green
}

Write-Host "Open http://localhost:3000 for dashboard UI (run: pnpm --filter web dev)"
