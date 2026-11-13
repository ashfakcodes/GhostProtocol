#!/usr/bin/env bash
cd "$(dirname "$0")/.."
ROOT_DIR="$(pwd)"

echo "========================================================"
echo "      GHOSTPROTOCOL - POST-HUMAN SOVEREIGN EXECUTOR"
echo "      NEAR Hackathon Track 13 (Open Innovation)"
echo "========================================================"
echo ""

if [ ! -f "$ROOT_DIR/agent/.env" ]; then
    echo "[CONFIG] agent/.env not found. Auto-generating from agent/.env.example..."
    if [ -f "$ROOT_DIR/agent/.env.example" ]; then
        cp "$ROOT_DIR/agent/.env.example" "$ROOT_DIR/agent/.env"
        echo "[CONFIG] Created agent/.env successfully."
    else
        echo "[WARNING] agent/.env.example not found!"
    fi
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo ""
    echo "[DEPENDENCIES] frontend/node_modules not found."
    echo "[DEPENDENCIES] Installing frontend dependencies with npm install..."
    (cd "$ROOT_DIR/frontend" && npm install)
    echo "[DEPENDENCIES] Frontend dependencies installed successfully."
    echo ""
fi

echo "[1/2] Starting Python Ghost Agent on http://127.0.0.1:8000 ..."
python3 agent/ghost_agent.py &
AGENT_PID=$!

sleep 2

echo "[2/2] Starting Cyberpunk Vault Frontend on http://localhost:3000 ..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

sleep 2

# Launch browser if supported
if command -v xdg-open > /dev/null 2>&1; then
    xdg-open http://localhost:3000 > /dev/null 2>&1 &
elif command -v open > /dev/null 2>&1; then
    open http://localhost:3000 > /dev/null 2>&1 &
fi

echo ""
echo "All services launched!"
echo "- Web Dashboard: http://localhost:3000"
echo "- Telemetry API: http://127.0.0.1:8000/docs"
echo "========================================================"

trap "kill $AGENT_PID $FRONTEND_PID" EXIT
wait
