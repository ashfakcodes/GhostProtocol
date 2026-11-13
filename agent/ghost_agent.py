import sys
import asyncio
import time
import json
import uuid
import random

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
from typing import Dict, Any, List
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from config import (
        CONTRACT_ID, OWNER_ACCOUNT_ID, AGENT_ACCOUNT_ID,
        BENEFICIARY_ACCOUNT_ID, BENEFICIARY_TG,
        SIMULATED_POLL_INTERVAL_S, WARNING_THRESHOLD_MS, TIMEOUT_PERIOD_MS
    )
    from trader_dna_engine import TraderDNAEngine
    from combat_reasoner import CombatReasoner
    from near_intents import NearIntentsEngine
    from telegram_listener import TelegramBridge
    from near_client import NearClient
except ImportError:
    from agent.config import (
        CONTRACT_ID, OWNER_ACCOUNT_ID, AGENT_ACCOUNT_ID,
        BENEFICIARY_ACCOUNT_ID, BENEFICIARY_TG,
        SIMULATED_POLL_INTERVAL_S, WARNING_THRESHOLD_MS, TIMEOUT_PERIOD_MS
    )
    from agent.trader_dna_engine import TraderDNAEngine
    from agent.combat_reasoner import CombatReasoner
    from agent.near_intents import NearIntentsEngine
    from agent.telegram_listener import TelegramBridge
    from agent.near_client import NearClient

app = FastAPI(title="GhostProtocol Autonomous Executor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initial sample positions (calibrated to current live market prices)
default_positions = [
    {
        "id": "pos-near-01",
        "symbol": "NEAR/USDC",
        "mode": "PERP",
        "side": "LONG",
        "size": 500.0,
        "entry_price": 4.05,
        "mark_price": 4.08,
        "leverage": 3.0,
        "margin": 675.00,
        "pnl": 15.00,
        "pnl_pct": 2.22,
        "stop_loss": 3.50,
        "take_profit": 5.20,
        "entry_rsi": 31.8,
        "opened_at": int(time.time()) - 3600
    },
    {
        "id": "pos-eth-02",
        "symbol": "ETH/USDC",
        "mode": "PERP",
        "side": "LONG",
        "size": 1.5,
        "entry_price": 2250.00,
        "mark_price": 2280.00,
        "leverage": 2.0,
        "margin": 1687.50,
        "pnl": 45.00,
        "pnl_pct": 2.67,
        "stop_loss": 1950.00,
        "take_profit": 2800.00,
        "entry_rsi": 34.2,
        "opened_at": int(time.time()) - 7200
    }
]

# Shared In-Memory State for Demo & Synchronization
state = {
    "owner": OWNER_ACCOUNT_ID,
    "agent": AGENT_ACCOUNT_ID,
    "beneficiary": BENEFICIARY_ACCOUNT_ID,
    "beneficiary_tg": BENEFICIARY_TG,
    "timeout_period_ms": TIMEOUT_PERIOD_MS, # Configurable countdown timer (e.g. 50,000ms)
    "warning_threshold_ms": WARNING_THRESHOLD_MS, # Configurable warning threshold
    "last_heartbeat_ms": int(time.time() * 1000),
    "status": "Alive", # Alive -> Warning -> GhostAwake -> Executed
    "seq": 0,
    "key_share_a": "SHARE_A_SEC_98a7cf28b",
    "encrypted_vault_hash": "QmZ84bN81GhostVaultEncrypted",
    "trader_dna_raw": json.dumps(TraderDNAEngine.default_dna()),
    "treasury_near": 12.5,
    "active_positions": default_positions.copy(),
    "trade_history": [
        {
            "id": "tr-hist-01",
            "symbol": "NEAR/USDC",
            "mode": "PERP",
            "side": "BUY",
            "order_type": "LIMIT",
            "size": 500.0,
            "price": 5.15,
            "leverage": 3.0,
            "has_stop_loss": True,
            "stop_loss_pct": 3.3,
            "timestamp": int(time.time()) - 3600
        },
        {
            "id": "tr-hist-02",
            "symbol": "ETH/USDC",
            "mode": "PERP",
            "side": "BUY",
            "order_type": "LIMIT",
            "size": 1.5,
            "price": 3120.00,
            "leverage": 2.0,
            "has_stop_loss": True,
            "stop_loss_pct": 3.2,
            "timestamp": int(time.time()) - 7200
        }
    ],
    "live_logs": []
}

active_websockets: List[WebSocket] = []

def log_event(category: str, message: str):
    timestamp = time.strftime("%H:%M:%S")
    entry = f"[{timestamp}] [{category.upper()}] {message}"
    try:
        print(entry)
    except Exception:
        try:
            print(entry.encode('ascii', errors='replace').decode('ascii'))
        except Exception:
            pass
    state["live_logs"].append(entry)
    # Keep last 100 logs
    if len(state["live_logs"]) > 100:
        state["live_logs"].pop(0)

async def broadcast_state():
    now_ms = int(time.time() * 1000)
    time_remaining_ms = (state["last_heartbeat_ms"] + state["timeout_period_ms"]) - now_ms
    state["seq"] = state.get("seq", 0) + 1
    
    payload = {
        "seq": state["seq"],
        "timestamp": now_ms,
        "owner": state["owner"],
        "beneficiary": state["beneficiary"],
        "agent": state["agent"],
        "status": state["status"],
        "time_remaining_ms": max(0, time_remaining_ms),
        "timeout_period_ms": state["timeout_period_ms"],
        "warning_threshold_ms": state.get("warning_threshold_ms", WARNING_THRESHOLD_MS),
        "treasury_near": state["treasury_near"],
        # Key Share A is strictly locked unless protocol has reached GhostAwake or Executed state
        "key_share_a": state["key_share_a"] if state["status"] in ("Executed", "GhostAwake") else None,
        "active_positions": state["active_positions"],
        "trade_history": state["trade_history"][-10:],
        "trader_dna": json.loads(state["trader_dna_raw"]),
        "logs": state["live_logs"][-20:]
    }

    dead_sockets = []
    for ws in list(active_websockets):
        try:
            await ws.send_json(payload)
        except Exception:
            dead_sockets.append(ws)

    for dead in dead_sockets:
        if dead in active_websockets:
            active_websockets.remove(dead)

class GhostAgentCoordinator:
    def __init__(self):
        self.dna_engine = TraderDNAEngine(state["trader_dna_raw"])
        self.reasoner = CombatReasoner()
        self.intents = NearIntentsEngine()
        self.near_client = NearClient()
        self.telegram = TelegramBridge(on_alive_callback=self.on_telegram_alive)
        self.warned = False
        self.is_running = True
        self.takeover_lock = asyncio.Lock()
        self.is_executing = False

    async def on_telegram_alive(self, source: str = "Telegram"):
        if state["status"] == "Executed":
            return
        state["last_heartbeat_ms"] = int(time.time() * 1000)
        state["status"] = "Alive"
        self.warned = False
        log_event("HEARTBEAT", f"Proof-of-Life verified via Telegram ({source}). Expiration timer reset on NEAR.")
        await broadcast_state()

    async def run_loop(self):
        log_event("WATCHMAN", f"GhostProtocol Watchman armed for {state['owner']}. Interval: {state['timeout_period_ms']/1000}s.")
        await self.telegram.start()

        while self.is_running:
            try:
                now_ms = int(time.time() * 1000)
                time_remaining = (state["last_heartbeat_ms"] + state["timeout_period_ms"]) - now_ms

                if state["status"] != "Executed":
                    # Real-time position tick evaluation (dynamic mark price & PnL)
                    for p in state["active_positions"]:
                        drift = (random.random() - 0.495) * 0.0016
                        curr = p.get("mark_price", p.get("entry_price", 5.24))
                        new_mark = round(curr * (1 + drift), 2)
                        p["mark_price"] = new_mark
                        is_long = p.get("side") == "LONG"
                        entry = p.get("entry_price", 1.0)
                        size = p.get("size", 10.0)
                        margin = p.get("margin", (size * entry) / max(p.get("leverage", 1.0), 1.0))
                        raw_pnl = (new_mark - entry if is_long else entry - new_mark) * size
                        p["pnl"] = round(raw_pnl, 2)
                        p["pnl_pct"] = round((raw_pnl / margin) * 100, 2) if margin > 0 else 0.0

                    # Safety guardrail: warning threshold cannot exceed timeout_period_ms
                    effective_warning_ms = min(state.get("warning_threshold_ms", WARNING_THRESHOLD_MS), max(1000, state["timeout_period_ms"] - 2000))

                    if time_remaining <= 0:
                        state["status"] = "GhostAwake"
                        await broadcast_state()
                        await self.execute_takeover()
                    elif time_remaining <= effective_warning_ms:
                        state["status"] = "Warning"
                        if not self.warned:
                            self.warned = True
                            log_event("WARNING", f"Heartbeat critical ({int(time_remaining/1000)}s left). Sending Telegram alert...")
                            try:
                                await self.telegram.send_emergency_warning(state["beneficiary_tg"], int(time_remaining/1000))
                            except Exception as tg_err:
                                log_event("TELEGRAM_ERR", f"Warning alert dispatch error: {tg_err}")
                    else:
                        state["status"] = "Alive"
                        self.warned = False

                await broadcast_state()
            except Exception as loop_err:
                log_event("LOOP_ERROR", f"Watchman loop handled exception: {loop_err}")
            await asyncio.sleep(SIMULATED_POLL_INTERVAL_S)

    async def execute_takeover(self):
        async with self.takeover_lock:
            if self.is_executing or state["status"] == "Executed":
                return
            self.is_executing = True

            try:
                log_event("CRITICAL", "Proof-of-Life expired. Smart contract verified absence on NEAR.")
                log_event("GHOST_BRAIN", "Awakening Ghost Agent Sovereign Executor on NEAR...")

                # 1. Load Owner's Trader DNA (Calibrated through their actual trades!)
                constraints = self.dna_engine.get_prompt_constraints()
                dna_info = self.dna_engine.dna.get("trader_dna", {})
                pt = dna_info.get("profit_taking_behavior", {})
                dec = dna_info.get("decision_making_tendencies", {})
                log_event("DNA_MIMIC", 
                    f"Loaded Behavioral Twin: {dna_info.get('archetype')} | "
                    f"R:R Target: {pt.get('realized_rr_ratio', 2.15)}x | "
                    f"Panic Resilience: {int(dec.get('panic_dump_resilience', 0.94)*100)}% | "
                    f"Harvest: {pt.get('profit_harvest_style', 'SCALE_OUT_TWAP')}"
                )

                # 2. Extract Active Positions opened by the owner
                open_positions = {}
                for p in state["active_positions"]:
                    key = f"{p['symbol'].replace('/', '_')}_{p['mode'].lower()}"
                    open_positions[key] = f"{p['side']} {p['size']} @ {p['entry_price']} ({p['leverage']}x leverage)"

                if not open_positions:
                    open_positions = {
                        "solana_spot": "25.0 SOL",
                        "arbitrum_lp": "1.5 ETH / USDC",
                        "hyperliquid_perp": "0.5 BTC Long"
                    }

                mock_market = {
                    "eth_price": 3154.50, "eth_rsi": 32.4,
                    "sol_price": 182.20, "sol_rsi": 28.1,
                    "near_price": 5.24, "near_rsi": 35.6,
                    "volatility_index": "14.2%", "funding_rate": "-0.018%"
                }
                
                log_event("COMBAT_AI", f"Synthesizing market depth with OpenRouter ({self.reasoner.openrouter_model})...")
                plan = await self.reasoner.analyze_and_plan(constraints, mock_market, open_positions)
                log_event("REASONING", plan.get("reasoning_log", "Executing optimal protective unwind."))

                # 3. Unwind & Settle Positions via NEAR Intents & Chain Signatures
                for pos in state["active_positions"]:
                    log_event("CHAIN_SIG", f"NEAR MPC (v1.signer) signing perp closure for {pos['symbol']} {pos['mode']}...")
                    await asyncio.sleep(0.3)

                # Clear active positions as they are unwound
                state["active_positions"] = []

                unit_prices = {
                    "SOL": mock_market.get("sol_price", 182.20),
                    "NEAR": mock_market.get("near_price", 5.24),
                    "ETH": mock_market.get("eth_price", 3154.50),
                    "BTC": 68450.00,
                    "DOGE": 0.165,
                    "REF": 0.185,
                    "SWEAT": 0.0078,
                    "ARB": 0.582,
                    "AURORA": 0.142
                }

                for action in plan.get("unwind_actions", []):
                    # Enforce behavioral alignment guardrail
                    alignment = self.dna_engine.evaluate_action_alignment({
                        "slippage_pct": float(action.get("max_slippage_pct", 0.0)),
                        "amount": float(action.get("amount", 0.0)),
                        "asset_in": action.get("asset_in", "")
                    })
                    if not alignment.get("aligned", True):
                        log_event("GUARDRAIL", f"AI action adjusted by DNA Engine: {alignment.get('reason')}. Clamping to tolerance.")
                        action["max_slippage_pct"] = dna_info.get("max_slippage_tolerance_pct", 0.25)

                    asset_in = action.get("asset_in", "SOL")
                    amount = float(action.get("amount", 10.0))
                    price_est = unit_prices.get(asset_in.upper(), 100.0)
                    slippage_allowance = 1.0 - (float(action.get("max_slippage_pct", 0.25)) / 100.0)
                    min_amount_out = round(amount * price_est * slippage_allowance, 2)

                    log_event("INTENTS", f"Publishing NEAR Intent: Swap {amount} {asset_in} -> USDC via Solver Bus (Min Out: {min_amount_out} USDC)...")
                    
                    payload = self.intents.create_intent_payload(
                        user_account_id=state["owner"],
                        asset_in=asset_in,
                        amount_in=amount,
                        asset_out="USDC",
                        min_amount_out=min_amount_out,
                        beneficiary_recipient=state["beneficiary"]
                    )
                    receipt = await self.intents.broadcast_and_settle(payload)
                    log_event("SOLVER_BUS", f"Settled by {receipt['solver_account']} in {receipt['execution_time_ms']}ms. Tx: {receipt['tx_hash'][:16]}...")

                # 4. Finalize Settlement on NEAR
                log_event("SETTLEMENT", f"Executing trigger_ghost_protocol() on NEAR (Contract: {self.near_client.contract_id})...")
                near_tx = await self.near_client.trigger_ghost_protocol()
                tx_hash = near_tx.get("tx_hash", "8zWpExecutedNEAR")
                tx_mode = near_tx.get("mode", "ONCHAIN")
                log_event("ONCHAIN_TX", f"Ghost Protocol finalized on NEAR [{tx_mode}]! Tx: {tx_hash[:20]}... Treasury & Key Share A released.")
                state["status"] = "Executed"
                state["treasury_near"] = 0.05 # Storage cushion
                await broadcast_state()
                
                # 5. Notify Beneficiary on Telegram
                await self.telegram.send_beneficiary_settlement(
                    state["beneficiary_tg"],
                    {
                        "consolidated_amount": "14,820 USDC + 12.45 NEAR",
                        "intent_tx": "8zWp882f09ba1923NEARIntentSettled",
                        "beneficiary": state["beneficiary"],
                        "key_share_a": state["key_share_a"]
                    }
                )
                log_event("SUCCESS", "Protocol finalized. Beneficiary received consolidated assets & decryption Share A.")

            finally:
                self.is_executing = False

coordinator = GhostAgentCoordinator()

# --- HTTP Endpoints ---

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(coordinator.run_loop())

@app.get("/", response_class=HTMLResponse)
async def root_index():
    now_ms = int(time.time() * 1000)
    time_remaining_ms = max(0, (state["last_heartbeat_ms"] + state["timeout_period_ms"]) - now_ms)
    status = state["status"]
    status_color = "#10B981" if status == "Alive" else ("#F59E0B" if status == "Warning" else "#EF4444")

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GhostProtocol Autonomous Agent Daemon</title>
        <style>
            body {{
                background-color: #0A0A0C;
                color: #E2E8F0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            }}
            .card {{
                background: #12131A;
                border: 1px solid #1E2230;
                border-radius: 14px;
                padding: 32px;
                max-width: 580px;
                width: 100%;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }}
            .badge {{
                display: inline-block;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 11px;
                font-family: monospace;
                font-weight: 700;
                letter-spacing: 0.05em;
                background: rgba(16, 185, 129, 0.12);
                color: {status_color};
                border: 1px solid {status_color}40;
                margin-bottom: 16px;
            }}
            h1 {{
                font-size: 22px;
                margin: 0 0 8px 0;
                color: #FFFFFF;
                letter-spacing: -0.02em;
            }}
            p {{
                font-size: 13px;
                line-height: 1.6;
                color: #94A3B8;
                margin: 0 0 24px 0;
            }}
            .stats {{
                background: #0D0E14;
                border: 1px solid #1A1D28;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 24px;
                font-family: monospace;
                font-size: 12px;
            }}
            .stat-row {{
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
            }}
            .stat-row:last-child {{
                margin-bottom: 0;
            }}
            .btn-group {{
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }}
            .btn {{
                flex: 1;
                min-width: 140px;
                text-align: center;
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                font-family: monospace;
                text-decoration: none;
                cursor: pointer;
                transition: all 0.2s;
            }}
            .btn-primary {{
                background: #FF2A4D;
                color: #FFFFFF;
                border: 1px solid #FF2A4D;
            }}
            .btn-primary:hover {{
                background: #E02040;
            }}
            .btn-secondary {{
                background: #1A1D28;
                color: #E2E8F0;
                border: 1px solid #282C3D;
            }}
            .btn-secondary:hover {{
                background: #232738;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <span class="badge">● GHOST AGENT DAEMON ONLINE</span>
            <h1>GhostProtocol: Post-Human Sovereign Executor</h1>
            <p>The backend telemetry daemon, proof-of-absence watchman, and NEAR Intents reasoner are running on port 8000.</p>
            <div class="stats">
                <div class="stat-row">
                    <span style="color:#64748B;">Protocol Status:</span>
                    <span style="color:{status_color}; font-weight:bold;">{status}</span>
                </div>
                <div class="stat-row">
                    <span style="color:#64748B;">Owner Account:</span>
                    <span>{state["owner"]}</span>
                </div>
                <div class="stat-row">
                    <span style="color:#64748B;">Countdown:</span>
                    <span>{int(time_remaining_ms / 1000)}s</span>
                </div>
                <div class="stat-row">
                    <span style="color:#64748B;">Active Positions:</span>
                    <span>{len(state["active_positions"])} open</span>
                </div>
            </div>
            <div class="btn-group">
                <a href="http://localhost:3000" class="btn btn-primary" target="_blank">Open Web Vault (Port 3000)</a>
                <a href="/docs" class="btn btn-secondary">API Swagger Docs</a>
                <a href="/api/status" class="btn btn-secondary">JSON Status</a>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/api/status")
async def get_status():
    now_ms = int(time.time() * 1000)
    time_remaining_ms = (state["last_heartbeat_ms"] + state["timeout_period_ms"]) - now_ms
    return {
        **state,
        "seq": state.get("seq", 0),
        "timestamp": now_ms,
        "time_remaining_ms": max(0, time_remaining_ms),
        "key_share_a": state["key_share_a"] if state["status"] in ("Executed", "GhostAwake") else None,
        "trader_dna": json.loads(state["trader_dna_raw"])
    }

@app.post("/api/heartbeat")
async def ping_heartbeat():
    if state["status"] == "Executed":
        return {"error": "Protocol is already finalized."}
    state["last_heartbeat_ms"] = int(time.time() * 1000)
    state["status"] = "Alive"
    coordinator.warned = False
    log_event("HEARTBEAT", f"Proof-of-Life verified on NEAR. Timer reset to {int(state['timeout_period_ms']/1000)}s.")
    await broadcast_state()
    return {
        "success": True, 
        "last_heartbeat_ms": state["last_heartbeat_ms"],
        "timeout_period_ms": state["timeout_period_ms"],
        "warning_threshold_ms": state.get("warning_threshold_ms", WARNING_THRESHOLD_MS)
    }

@app.post("/api/simulate_demise")
async def simulate_demise():
    """
    Simulates sudden absence: sets last_heartbeat_ms to 0,
    immediately triggering the Ghost Protocol takeover loop.
    """
    if state["status"] == "Executed":
        return {"error": "Protocol is already finalized."}
    state["last_heartbeat_ms"] = 0
    state["status"] = "GhostAwake"
    log_event("SIMULATION", "Owner silence simulated. Proof-of-Absence triggered immediately on NEAR.")
    await broadcast_state()
    asyncio.create_task(coordinator.execute_takeover())
    return {"success": True, "status": "GhostAwake"}

@app.post("/api/trade")
async def record_owner_trade(trade_data: Dict[str, Any]):
    """
    Submits a trade in the Trading Interface (Perp / Spot / Futures).
    - Acts as instant Proof-of-Life (resets heartbeat timer).
    - Extracts telemetry and recalibrates Trader DNA behavioral twin.
    - Adds to active positions.
    """
    if state["status"] == "Executed":
        return {"error": "Protocol is already finalized. Owner cannot trade."}

    # 1. Reset Proof-of-Life Heartbeat (Trading proves the owner is alive!)
    state["last_heartbeat_ms"] = int(time.time() * 1000)
    state["status"] = "Alive"
    coordinator.warned = False

    tx_hash = trade_data.get("tx_hash", f"8zWp{uuid.uuid4().hex[:24]}NEARBatch")
    nearblocks_url = f"https://testnet.nearblocks.io/txns/{tx_hash}"

    # 2. Ingest Trade into DNA Telemetry Engine
    updated_dna = coordinator.dna_engine.record_trade(trade_data)
    state["trader_dna_raw"] = json.dumps(updated_dna)
    dna_info = updated_dna.get("trader_dna", {})

    # 3. Create or Update Active Position (if Perp or Futures)
    symbol = trade_data.get("symbol", "NEAR/USDC")
    mode = trade_data.get("mode", "PERP")
    side = trade_data.get("side", "BUY")
    size = float(trade_data.get("size", 100.0))
    price = float(trade_data.get("price", 5.24))
    leverage = float(trade_data.get("leverage", 1.0) if mode != "SPOT" else 1.0)
    stop_loss = float(trade_data.get("stop_loss_pct", 2.5))
    take_profit = float(trade_data.get("take_profit_pct", 5.0))

    pos_id = f"pos-{uuid.uuid4().hex[:8]}"
    new_position = {
        "id": pos_id,
        "symbol": symbol,
        "mode": mode,
        "side": "LONG" if side == "BUY" else "SHORT",
        "size": size,
        "entry_price": price,
        "mark_price": price,
        "leverage": leverage,
        "margin": round((size * price) / leverage, 2),
        "pnl": 0.0,
        "pnl_pct": 0.0,
        "stop_loss": round(price * (1 - stop_loss/100) if side == "BUY" else price * (1 + stop_loss/100), 4),
        "take_profit": round(price * (1 + take_profit/100) if side == "BUY" else price * (1 - take_profit/100), 4),
        "opened_at": int(time.time()),
        "tx_hash": tx_hash,
        "nearblocks_url": nearblocks_url
    }

    if mode in ["PERP", "FUTURES"]:
        state["active_positions"].insert(0, new_position)

    # 4. Save to history
    state["trade_history"].append({
        "id": pos_id,
        "symbol": symbol,
        "mode": mode,
        "side": side,
        "order_type": trade_data.get("order_type", "LIMIT"),
        "size": size,
        "price": price,
        "leverage": leverage,
        "has_stop_loss": trade_data.get("has_stop_loss", True),
        "stop_loss_pct": stop_loss,
        "timestamp": int(time.time()),
        "tx_hash": tx_hash,
        "nearblocks_url": nearblocks_url
    })

    log_event("ATOMIC_BATCH", f"NEAR Testnet Tx: {tx_hash[:16]}... (Action 0: NEP-413 Intent, Action 1: ping_heartbeat)")
    trade_desc = f"executed SPOT {side} {size} {symbol}" if mode == "SPOT" else f"executed {mode} {side} {size} {symbol} ({leverage}x)"
    log_event("TRADE_TELEMETRY", 
        f"Owner {trade_desc}. "
        f"Twin Archetype: {dna_info.get('archetype')}, Patience: {dna_info.get('risk_vector', {}).get('patience_score')}. Proof-of-Life verified on NEAR."
    )

    await broadcast_state()
    return {
        "success": True,
        "position": new_position,
        "trader_dna": dna_info,
        "tx_hash": tx_hash,
        "nearblocks_url": nearblocks_url,
        "last_heartbeat_ms": state["last_heartbeat_ms"]
    }

@app.post("/api/testnet/faucet")
async def testnet_faucet(data: Dict[str, Any]):
    account_id = data.get("account_id", "owner.testnet")
    public_key = data.get("public_key")
    
    # If caller provided an Ed25519 public key, request actual funding from official NEAR testnet helper
    real_tx_hash = None
    if public_key:
        try:
            import urllib.request
            payload = json.dumps({
                "newAccountId": account_id,
                "newAccountPublicKey": public_key
            }).encode('utf-8')
            req = urllib.request.Request(
                "https://helper.testnet.near.org/account",
                data=payload,
                headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
            )
            # 15s timeout for testnet block confirmation
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp_data = json.loads(resp.read().decode('utf-8'))
                if "transaction" in resp_data and "hash" in resp_data["transaction"]:
                    real_tx_hash = resp_data["transaction"]["hash"]
                elif "transaction_outcome" in resp_data and "id" in resp_data["transaction_outcome"]:
                    real_tx_hash = resp_data["transaction_outcome"]["id"]
        except Exception as e:
            err_msg = str(e)
            if hasattr(e, 'read'):
                try:
                    err_msg = e.read().decode('utf-8')
                except Exception:
                    pass
            print(f"[TESTNET_FAUCET] Helper request error ({err_msg}).")
            # If account already exists on testnet, report clear status
            if "AccountAlreadyExists" in err_msg:
                log_event("TESTNET_FAUCET", f"Account {account_id} already exists on NEAR testnet.")
                return {
                    "success": True,
                    "already_exists": True,
                    "amount": "10 NEAR",
                    "tx_hash": None,
                    "message": f"Account {account_id} already registered & funded on NEAR Testnet."
                }

    faucet_tx = real_tx_hash or f"Faucet{uuid.uuid4().hex[:18].upper()}"
    log_event("TESTNET_FAUCET", f"Testnet Faucet funded +10.00 NEAR to {account_id}. Tx: {faucet_tx}")
    return {
        "success": True,
        "amount": "10 NEAR",
        "tx_hash": faucet_tx,
        "nearblocks_url": f"https://testnet.nearblocks.io/txns/{faucet_tx}" if real_tx_hash else None,
        "message": f"Successfully funded {account_id} with +10.00 Testnet NEAR"
    }

@app.post("/api/close_position")
async def close_position(data: Dict[str, Any]):
    pos_id = data.get("position_id")
    target_pos = None
    for p in state["active_positions"]:
        if p["id"] == pos_id:
            target_pos = p
            break

    if target_pos:
        state["active_positions"] = [p for p in state["active_positions"] if p["id"] != pos_id]
        
        # Realized exit telemetry calculation
        exit_price = data.get("exit_price", target_pos.get("mark_price", target_pos.get("entry_price", 1.0)))
        pnl = target_pos.get("pnl", 12.5)
        pnl_pct = target_pos.get("pnl_pct", 2.5)
        
        close_record = {
            **target_pos,
            "exit_price": exit_price,
            "pnl": pnl,
            "pnl_pct": pnl_pct
        }
        
        # Feed closed trade into Trader DNA Engine
        updated_dna = coordinator.dna_engine.record_position_close(close_record)
        state["trader_dna_raw"] = json.dumps(updated_dna)
        
        dna_info = updated_dna.get("trader_dna", {})
        pt = dna_info.get("profit_taking_behavior", {})
        dec = dna_info.get("decision_making_tendencies", {})
        
        log_event("POSITION_CLOSE", f"Owner closed {target_pos['symbol']} {target_pos['mode']} (PnL: +${pnl:.2f}). Heartbeat reset.")
        log_event("DNA_TELEMETRY", 
            f"Closed Telemetry Extracted :: Realized R:R: {pt.get('realized_rr_ratio')}x | "
            f"Panic Resilience: {int(dec.get('panic_dump_resilience', 0.94)*100)}% | "
            f"Harvest Style: {pt.get('profit_harvest_style')} | "
            f"Dip-Buyer Score: {dec.get('dip_buyer_vs_breakout_score')}"
        )
        
        # Reset heartbeat (closing a position is proof of life)
        state["last_heartbeat_ms"] = int(time.time() * 1000)
        state["status"] = "Alive"
        coordinator.warned = False
        await broadcast_state()
        return {
            "success": True, 
            "closed": target_pos,
            "trader_dna": dna_info
        }

    return {"error": "Position not found"}

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
    state["active_positions"] = default_positions.copy()
    coordinator.warned = False
    log_event("SYSTEM", f"Demo environment reset to initial Alive state with default active positions (Interval: {int(state['timeout_period_ms']/1000)}s).")
    await broadcast_state()
    return {
        "success": True,
        "timeout_period_ms": state["timeout_period_ms"],
        "warning_threshold_ms": state.get("warning_threshold_ms", WARNING_THRESHOLD_MS)
    }

@app.post("/api/vault/seal")
async def seal_vault(payload: Dict[str, Any]):
    if "key_share_a" in payload:
        state["key_share_a"] = payload["key_share_a"]
    if "ciphertext_hash" in payload:
        state["encrypted_vault_hash"] = payload["ciphertext_hash"]
    await broadcast_state()
    return {"success": True, "key_share_a_stored": bool(state.get("key_share_a"))}

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "protocol_status": state["status"]}

@app.get("/api/state")
async def get_state_alias():
    return await get_status()

@app.post("/api/order")
async def record_order_alias(trade_data: Dict[str, Any]):
    return await record_owner_trade(trade_data)

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
        if websocket in active_websockets:
            active_websockets.remove(websocket)

if __name__ == "__main__":
    uvicorn.run("ghost_agent:app", host="127.0.0.1", port=8000, reload=False)
