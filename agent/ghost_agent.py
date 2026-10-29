import asyncio
import time
import json
from typing import Dict, Any, List
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from config import (
        CONTRACT_ID, OWNER_ACCOUNT_ID, AGENT_ACCOUNT_ID,
        BENEFICIARY_ACCOUNT_ID, BENEFICIARY_TG,
        SIMULATED_POLL_INTERVAL_S, WARNING_THRESHOLD_MS
    )
    from trader_dna_engine import TraderDNAEngine
    from combat_reasoner import CombatReasoner
    from near_intents import NearIntentsEngine
    from telegram_listener import TelegramBridge
except ImportError:
    from agent.config import (
        CONTRACT_ID, OWNER_ACCOUNT_ID, AGENT_ACCOUNT_ID,
        BENEFICIARY_ACCOUNT_ID, BENEFICIARY_TG,
        SIMULATED_POLL_INTERVAL_S, WARNING_THRESHOLD_MS
    )
    from agent.trader_dna_engine import TraderDNAEngine
    from agent.combat_reasoner import CombatReasoner
    from agent.near_intents import NearIntentsEngine
    from agent.telegram_listener import TelegramBridge

app = FastAPI(title="GhostProtocol Autonomous Executor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared In-Memory State for Demo & Synchronization
state = {
    "owner": OWNER_ACCOUNT_ID,
    "agent": AGENT_ACCOUNT_ID,
    "beneficiary": BENEFICIARY_ACCOUNT_ID,
    "beneficiary_tg": BENEFICIARY_TG,
    "timeout_period_ms": 15000, # 15s hackathon demo timer
    "last_heartbeat_ms": int(time.time() * 1000),
    "status": "Alive", # Alive -> Warning -> GhostAwake -> Executed
    "key_share_a": "SHARE_A_SEC_98a7cf28b",
    "encrypted_vault_hash": "QmZ84bN81GhostVaultEncrypted",
    "trader_dna_raw": json.dumps(TraderDNAEngine.default_dna()),
    "treasury_near": 12.5,
    "live_logs": []
}

active_websockets: List[WebSocket] = []

def log_event(category: str, message: str):
    timestamp = time.strftime("%H:%M:%S")
    entry = f"[{timestamp}] [{category.upper()}] {message}"
    print(entry)
    state["live_logs"].append(entry)
    # Keep last 100 logs
    if len(state["live_logs"]) > 100:
        state["live_logs"].pop(0)

async def broadcast_state():
    now_ms = int(time.time() * 1000)
    time_remaining_ms = (state["last_heartbeat_ms"] + state["timeout_period_ms"]) - now_ms
    
    payload = {
        "owner": state["owner"],
        "beneficiary": state["beneficiary"],
        "agent": state["agent"],
        "status": state["status"],
        "time_remaining_ms": max(0, time_remaining_ms),
        "timeout_period_ms": state["timeout_period_ms"],
        "treasury_near": state["treasury_near"],
        "key_share_a": state["key_share_a"] if state["status"] in ["GhostAwake", "Executed"] else None,
        "logs": state["live_logs"][-15:]
    }

    for ws in active_websockets:
        try:
            await ws.send_json(payload)
        except Exception:
            pass

class GhostAgentCoordinator:
    def __init__(self):
        self.dna_engine = TraderDNAEngine(state["trader_dna_raw"])
        self.reasoner = CombatReasoner()
        self.intents = NearIntentsEngine()
        self.telegram = TelegramBridge()
        self.warned = False
        self.is_running = True

    async def run_loop(self):
        log_event("WATCHMAN", f"GhostProtocol Watchman armed for {state['owner']}. Interval: {state['timeout_period_ms']/1000}s.")
        await self.telegram.start()

        while self.is_running:
            now_ms = int(time.time() * 1000)
            time_remaining = (state["last_heartbeat_ms"] + state["timeout_period_ms"]) - now_ms

            if state["status"] != "Executed":
                if time_remaining <= 0:
                    state["status"] = "GhostAwake"
                    await self.execute_takeover()
                elif time_remaining <= WARNING_THRESHOLD_MS:
                    state["status"] = "Warning"
                    if not self.warned:
                        self.warned = True
                        log_event("WARNING", f"Heartbeat critical ({int(time_remaining/1000)}s left). Sending Telegram alert...")
                        await self.telegram.send_emergency_warning(state["beneficiary_tg"], int(time_remaining/1000))
                else:
                    state["status"] = "Alive"
                    self.warned = False

            await broadcast_state()
            await asyncio.sleep(SIMULATED_POLL_INTERVAL_S)

    async def execute_takeover(self):
        log_event("CRITICAL", "Proof-of-Life expired. Smart contract verified absence.")
        log_event("GHOST_BRAIN", "Awakening Ghost Agent Sovereign Executor on NEAR...")

        # 1. Load Owner's Trader DNA
        constraints = self.dna_engine.get_prompt_constraints()
        log_event("DNA_MIMIC", f"Loaded Trader DNA: {self.dna_engine.dna.get('trader_dna', {}).get('archetype')}")

        # 2. Market State & Adversarial Combat Reasoning
        mock_market = {
            "eth_price": 3150, "eth_rsi": 32.4,
            "sol_price": 182, "sol_rsi": 28.1,
            "volatility_index": "14.2%", "funding_rate": "-0.018%"
        }
        mock_positions = {
            "solana_spot": "25.0 SOL",
            "arbitrum_lp": "1.5 ETH / USDC",
            "hyperliquid_perp": "0.5 BTC Long"
        }
        
        log_event("COMBAT_AI", "Analyzing live market depth, funding rates, and RSI against Trader DNA...")
        plan = await self.reasoner.analyze_and_plan(constraints, mock_market, mock_positions)
        log_event("REASONING", plan.get("reasoning_log", "Executing optimal protective unwind."))

        # 3. Execute NEAR Intents
        for action in plan.get("unwind_actions", []):
            asset_in = action.get("asset_in")
            amount = action.get("amount")
            log_event("INTENTS", f"Publishing NEAR Intent: Swap {amount} {asset_in} -> USDC via Solver Bus...")
            
            payload = self.intents.create_intent_payload(
                user_account_id=state["owner"],
                asset_in=asset_in,
                amount_in=amount,
                asset_out="USDC",
                min_amount_out=amount * (180 if asset_in == "SOL" else 3100),
                beneficiary_recipient=state["beneficiary"]
            )
            receipt = await self.intents.broadcast_and_settle(payload)
            log_event("SOLVER_BUS", f"Settled by {receipt['solver_account']} in {receipt['execution_time_ms']}ms. Tx: {receipt['tx_hash'][:16]}...")

        # 4. Finalize Settlement on NEAR
        log_event("SETTLEMENT", f"Calling trigger_ghost_protocol() on NEAR. Releasing treasury & Key Share A.")
        state["status"] = "Executed"
        state["treasury_near"] = 0.05 # Storage cushion
        
        # 5. Notify Beneficiary on Telegram
        await self.telegram.send_beneficiary_settlement(
            state["beneficiary_tg"],
            {
                "consolidated_amount": "9,250 USDC + 12.45 NEAR",
                "intent_tx": "8zWp882f09ba1923NEARIntentSettled",
                "beneficiary": state["beneficiary"],
                "key_share_a": state["key_share_a"]
            }
        )
        log_event("SUCCESS", "Protocol finalized. Beneficiary received funds & decryption Share A.")

coordinator = GhostAgentCoordinator()

# --- HTTP Endpoints ---

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(coordinator.run_loop())

@app.get("/api/status")
async def get_status():
    now_ms = int(time.time() * 1000)
    time_remaining_ms = (state["last_heartbeat_ms"] + state["timeout_period_ms"]) - now_ms
    return {
        **state,
        "time_remaining_ms": max(0, time_remaining_ms),
        "key_share_a": state["key_share_a"] if state["status"] in ["GhostAwake", "Executed"] else None
    }

@app.post("/api/heartbeat")
async def ping_heartbeat():
    if state["status"] == "Executed":
        return {"error": "Protocol is already finalized."}
    state["last_heartbeat_ms"] = int(time.time() * 1000)
    state["status"] = "Alive"
    coordinator.warned = False
    log_event("HEARTBEAT", "Manual/Userbot ping received. Countdown reset.")
    await broadcast_state()
    return {"success": True, "last_heartbeat_ms": state["last_heartbeat_ms"]}

@app.post("/api/update_dna")
async def update_dna(new_dna: Dict[str, Any]):
    state["trader_dna_raw"] = json.dumps(new_dna)
    coordinator.dna_engine = TraderDNAEngine(state["trader_dna_raw"])
    log_event("DNA_UPDATE", "Trader DNA matrix recalibrated by owner.")
    return {"success": True}

@app.post("/api/reset_demo")
async def reset_demo():
    state["last_heartbeat_ms"] = int(time.time() * 1000)
    state["status"] = "Alive"
    state["treasury_near"] = 12.5
    coordinator.warned = False
    log_event("SYSTEM", "Demo environment reset to initial Alive state.")
    await broadcast_state()
    return {"success": True}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        active_websockets.remove(websocket)

if __name__ == "__main__":
    uvicorn.run("ghost_agent:app", host="127.0.0.1", port=8000, reload=False)
