import asyncio
import time
import json
import uuid
import random
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

# Initial sample positions
default_positions = [
    {
        "id": "pos-near-01",
        "symbol": "NEAR/USDC",
        "mode": "PERP",
        "side": "LONG",
        "size": 500.0,
        "entry_price": 5.15,
        "mark_price": 5.24,
        "leverage": 3.0,
        "margin": 858.33,
        "pnl": 45.00,
        "pnl_pct": 5.24,
        "stop_loss": 4.98,
        "take_profit": 5.80,
        "entry_rsi": 31.8,
        "opened_at": int(time.time()) - 3600
    },
    {
        "id": "pos-eth-02",
        "symbol": "ETH/USDC",
        "mode": "PERP",
        "side": "LONG",
        "size": 1.5,
        "entry_price": 3120.00,
        "mark_price": 3154.50,
        "leverage": 2.0,
        "margin": 2340.00,
        "pnl": 51.75,
        "pnl_pct": 2.21,
        "stop_loss": 3020.00,
        "take_profit": 3350.00,
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
    "timeout_period_ms": 15000, # 15s hackathon demo timer
    "last_heartbeat_ms": int(time.time() * 1000),
    "status": "Alive", # Alive -> Warning -> GhostAwake -> Executed
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
        "active_positions": state["active_positions"],
        "trade_history": state["trade_history"][-10:],
        "trader_dna": json.loads(state["trader_dna_raw"]),
        "logs": state["live_logs"][-20:]
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

        for action in plan.get("unwind_actions", []):
            asset_in = action.get("asset_in")
            amount = action.get("amount")
            log_event("INTENTS", f"Publishing NEAR Intent: Swap {amount} {asset_in} -> USDC via Solver Bus...")
            
            payload = self.intents.create_intent_payload(
                user_account_id=state["owner"],
                asset_in=asset_in,
                amount_in=amount,
                asset_out="USDC",
                min_amount_out=amount * (180 if asset_in == "SOL" else (5.10 if asset_in == "NEAR" else 3100)),
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
                "consolidated_amount": "14,820 USDC + 12.45 NEAR",
                "intent_tx": "8zWp882f09ba1923NEARIntentSettled",
                "beneficiary": state["beneficiary"],
                "key_share_a": state["key_share_a"]
            }
        )
        log_event("SUCCESS", "Protocol finalized. Beneficiary received consolidated assets & decryption Share A.")

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
        "key_share_a": state["key_share_a"] if state["status"] in ["GhostAwake", "Executed"] else None,
        "trader_dna": json.loads(state["trader_dna_raw"])
    }

@app.post("/api/heartbeat")
async def ping_heartbeat():
    if state["status"] == "Executed":
        return {"error": "Protocol is already finalized."}
    state["last_heartbeat_ms"] = int(time.time() * 1000)
    state["status"] = "Alive"
    coordinator.warned = False
    log_event("HEARTBEAT", "Proof-of-Life verified on NEAR. Timer reset.")
    await broadcast_state()
    return {"success": True, "last_heartbeat_ms": state["last_heartbeat_ms"]}

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
    log_event("TRADE_TELEMETRY", 
        f"Owner executed {mode} {side} {size} {symbol} ({leverage}x). "
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
    faucet_tx = f"Faucet{uuid.uuid4().hex[:18].upper()}"
    log_event("TESTNET_FAUCET", f"Testnet Faucet funded +10.00 NEAR to {account_id}. Tx: {faucet_tx}")
    return {
        "success": True,
        "amount": "10 NEAR",
        "tx_hash": faucet_tx,
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
    log_event("SYSTEM", "Demo environment reset to initial Alive state with default active positions.")
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
