@echo off
setlocal
pushd "%~dp0"
set "ROOT_DIR=%CD%"

echo ========================================================
echo       GHOSTPROTOCOL - POST-HUMAN SOVEREIGN EXECUTOR
echo       NEAR Hackathon Track 13 (Open Innovation)
echo ========================================================
echo.

if not exist "%ROOT_DIR%\agent\.env" (
    echo [CONFIG] agent\.env not found. Auto-generating from agent\.env.example...
    if exist "%ROOT_DIR%\agent\.env.example" (
        copy "%ROOT_DIR%\agent\.env.example" "%ROOT_DIR%\agent\.env" > nul
        echo [CONFIG] Created agent\.env successfully.
    ) else (
        echo [WARNING] agent\.env.example not found!
    )
)

if not exist "%ROOT_DIR%\frontend\node_modules\" (
    echo.
    echo [DEPENDENCIES] frontend\node_modules not found.
    echo [DEPENDENCIES] Installing frontend dependencies with npm install...
    pushd "%ROOT_DIR%\frontend"
    call npm.cmd install
    popd
    echo [DEPENDENCIES] Frontend dependencies installed successfully.
    echo.
)

echo [1/2] Starting Python Ghost Agent Daemon on http://127.0.0.1:8000 ...
start "Ghost Agent Daemon" /D "%ROOT_DIR%\agent" cmd /k "python ghost_agent.py"

timeout /t 2 /nobreak > nul

echo [2/2] Starting Cyberpunk Vault Frontend on http://localhost:3000 ...
start "Ghost Vault Frontend" /D "%ROOT_DIR%\frontend" cmd /k "npm.cmd run dev"

timeout /t 2 /nobreak > nul

echo [BROWSER] Launching Cyberpunk Vault Dashboard in default browser...
start http://localhost:3000

echo.
echo All services launched!
echo - Web Dashboard: http://localhost:3000
echo - Telemetry API: http://127.0.0.1:8000/docs
echo ========================================================
popd
endlocal
