#!/usr/bin/env bash
echo "========================================================"
echo "      GHOSTPROTOCOL - POST-HUMAN SOVEREIGN EXECUTOR"
echo "      NEAR Hackathon Track 13 (Open Innovation)"
echo "========================================================"

echo "[1/2] Starting Python Ghost Agent on http://127.0.0.1:8000 ..."
python3 agent/ghost_agent.py &
AGENT_PID=$!

sleep 2

echo "[2/2] Starting Cyberpunk Vault Frontend on http://localhost:3000 ..."
cd frontend && npm run dev &
FRONTEND_PID=$!

trap "kill $AGENT_PID $FRONTEND_PID" EXIT
wait
