@echo off
setlocal
pushd "%~dp0.."
set "ROOT_DIR=%CD%"

echo ========================================================
echo       GHOSTPROTOCOL - SYSTEM VERIFICATION SUITE
echo ========================================================
echo.

echo [1/3] Running NEAR Smart Contract Unit Tests (Rust) ...
cd /d "%ROOT_DIR%\contracts"
cargo test --lib
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Contract tests failed!
    popd
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Verifying Python Behavioral Engine and Combat Reasoner ...
cd /d "%ROOT_DIR%"
python -c "import asyncio; from agent.trader_dna_engine import TraderDNAEngine; from agent.combat_reasoner import CombatReasoner; e = TraderDNAEngine(); r = CombatReasoner(openrouter_api_key='', gemini_api_key=''); plan = r._heuristic_combat_plan('CONSTRAINTS', {'sol_rsi': 25.0}, {}); print('DNA Engine Initialized:', e.dna['trader_dna']['archetype']); print('Combat Reasoner Plan:', plan['tactical_status'])"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python verification failed!
    popd
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Building TypeScript and Vite Frontend ...
cd /d "%ROOT_DIR%\frontend"
call npm.cmd run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed!
    popd
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo       ALL VERIFICATION CHECKS PASSED (100% CLEAN)
echo ========================================================
popd
endlocal
