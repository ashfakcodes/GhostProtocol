@echo off
echo ========================================================
echo       GHOSTPROTOCOL - POST-HUMAN SOVEREIGN EXECUTOR
echo       NEAR Hackathon Track 13 (Open Innovation)
echo ========================================================
echo.
echo [1/2] Starting Python Ghost Agent Daemon & Telemetry API on http://127.0.0.1:8000 ...
start "Ghost Agent Daemon" cmd /k "cd agent && python ghost_agent.py"

timeout /t 2 /nobreak > nul

echo [2/2] Starting Cyberpunk Vault Frontend on http://localhost:3000 ...
start "Ghost Vault Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo All services launched!
echo - Web Dashboard: http://localhost:3000
echo - Telemetry API: http://127.0.0.1:8000/docs
echo ========================================================
