# GhostProtocol Windows PowerShell Demo Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "      GHOSTPROTOCOL - POST-HUMAN SOVEREIGN EXECUTOR" -ForegroundColor White
Write-Host "      NEAR Hackathon Track 13 (Open Innovation)" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$baseDir = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path "$baseDir\agent\.env")) {
    Write-Host "[CONFIG] agent\.env not found. Auto-generating from agent\.env.example..." -ForegroundColor Yellow
    if (Test-Path "$baseDir\agent\.env.example") {
        Copy-Item "$baseDir\agent\.env.example" "$baseDir\agent\.env"
        Write-Host "[CONFIG] Created agent\.env successfully." -ForegroundColor Green
    } else {
        Write-Host "[WARNING] agent\.env.example not found!" -ForegroundColor Red
    }
}

if (-not (Test-Path "$baseDir\frontend\node_modules")) {
    Write-Host ""
    Write-Host "[DEPENDENCIES] frontend\node_modules not found." -ForegroundColor Yellow
    Write-Host "[DEPENDENCIES] Installing frontend dependencies with npm install..." -ForegroundColor Yellow
    Push-Location "$baseDir\frontend"
    npm.cmd install
    Pop-Location
    Write-Host "[DEPENDENCIES] Frontend dependencies installed successfully." -ForegroundColor Green
    Write-Host ""
}

Write-Host "[1/2] Starting Python Ghost Agent Daemon on http://127.0.0.1:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\agent'; python ghost_agent.py"

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting Cyberpunk Vault Frontend on http://localhost:3000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\frontend'; npm.cmd run dev"

Start-Sleep -Seconds 2

Write-Host "[BROWSER] Launching Cyberpunk Vault Dashboard in default browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "All GhostProtocol services initialized!" -ForegroundColor Cyan
Write-Host " - Web Interface: http://localhost:3000" -ForegroundColor White
Write-Host " - Telemetry API: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
