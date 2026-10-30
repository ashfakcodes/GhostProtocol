import json
import time
from typing import Dict, Any, List

class TraderDNAEngine:
    """
    Trader DNA Engine: Encodes, monitors, and mimics the owner's trading psychology,
    risk tolerance, leverage boundaries, order types, and exit habits.
    
    When the owner places trades in the Terminal (Perp, Spot, Futures), this engine
    extracts behavioral telemetry and continuously updates their Living Behavioral Twin.
    """

    def __init__(self, raw_dna_json: str = None):
        self.trade_history: List[Dict[str, Any]] = []
        if raw_dna_json:
            try:
                self.dna = json.loads(raw_dna_json)
                self.trade_history = self.dna.get("trade_history", [])
            except Exception:
                self.dna = self.default_dna()
        else:
            self.dna = self.default_dna()

    @staticmethod
    def default_dna() -> Dict[str, Any]:
        return {
            "trader_dna": {
                "archetype": "Patience-Disciplined Swing Hedger",
                "max_slippage_tolerance_pct": 0.25,
                "unwind_strategy": "TWAP_VOLATILITY_ADAPTIVE",
                "panic_dump_threshold_rsi": 28,
                "perp_action": "CLOSE_ON_REBOUND_OR_TRAILING_STOP",
                "preferred_reserve_asset": "USDC",
                "max_leverage_limit": 3.0,
                "telemetry": {
                    "total_trades_recorded": 0,
                    "avg_leverage": 2.5,
                    "stop_loss_adherence_pct": 90.0,
                    "limit_order_ratio_pct": 75.0,
                    "perp_ratio_pct": 60.0,
                    "spot_ratio_pct": 30.0,
                    "futures_ratio_pct": 10.0,
                    "last_recorded_at": int(time.time())
                },
                "risk_vector": {
                    "drawdown_tolerance": 0.35,     # 35% max drawdown patience
                    "volatility_affinity": 0.65,    # medium-high volatility comfort
                    "leverage_appetite": 0.25,      # low leverage preference
                    "patience_score": 0.85          # high patience (avoids instant market dumps)
                },
                "personal_tenets": [
                    "Never market-sell into an oversold RSI (< 30).",
                    "Always execute unwinds via TWAP batches across 3 intervals.",
                    "Hedge with delta-neutral shorts if funding rate is below -0.05%.",
                    "Consolidate all peripheral LPs into USDC via NEAR Intents."
                ]
            },
            "trade_history": []
        }

    def record_trade(self, trade: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingests a new trade executed by the owner in the Trading Interface (Perp/Spot/Futures)
        and recalculates the Trader DNA behavioral matrix.
        """
        trade_record = {
            "id": trade.get("id", f"tr-{int(time.time() * 1000)}"),
            "timestamp": trade.get("timestamp", int(time.time())),
            "symbol": trade.get("symbol", "NEAR/USDC"),
            "mode": trade.get("mode", "PERP"),  # PERP | SPOT | FUTURES
            "side": trade.get("side", "BUY"),   # BUY (Long) | SELL (Short)
            "order_type": trade.get("order_type", "LIMIT"), # MARKET | LIMIT | TWAP
            "size": float(trade.get("size", 10.0)),
            "price": float(trade.get("price", 5.20)),
            "leverage": float(trade.get("leverage", 1.0) if trade.get("mode") != "SPOT" else 1.0),
            "has_stop_loss": bool(trade.get("has_stop_loss", True)),
            "stop_loss_pct": float(trade.get("stop_loss_pct", 2.5)),
            "take_profit_pct": float(trade.get("take_profit_pct", 5.0)),
        }

        self.trade_history.append(trade_record)
        # Keep last 50 trades in DNA storage
        if len(self.trade_history) > 50:
            self.trade_history.pop(0)

        # Recalculate behavioral DNA weights
        self._recalibrate_from_history()
        return self.dna

    def _recalibrate_from_history(self):
        if not self.trade_history:
            return

        total = len(self.trade_history)
        leverages = [t["leverage"] for t in self.trade_history]
        avg_leverage = sum(leverages) / total
        max_leverage = max(leverages)

        stop_loss_count = sum(1 for t in self.trade_history if t["has_stop_loss"])
        sl_adherence = (stop_loss_count / total) * 100

        limit_orders = sum(1 for t in self.trade_history if t["order_type"] in ["LIMIT", "TWAP"])
        limit_ratio = (limit_orders / total) * 100

        perp_count = sum(1 for t in self.trade_history if t["mode"] == "PERP")
        spot_count = sum(1 for t in self.trade_history if t["mode"] == "SPOT")
        futures_count = sum(1 for t in self.trade_history if t["mode"] == "FUTURES")

        # Dynamic Behavioral Scores (0.0 to 1.0)
        # Patience: higher if using Limit/TWAP and setting Stop Losses
        patience_score = min(1.0, max(0.1, (limit_ratio / 100 * 0.6) + (sl_adherence / 100 * 0.4)))
        
        # Leverage appetite: normalized against max 20x
        leverage_appetite = min(1.0, max(0.05, avg_leverage / 15.0))
        
        # Drawdown tolerance: derived from average stop loss and leverage
        avg_sl = sum(t["stop_loss_pct"] for t in self.trade_history) / total
        drawdown_tolerance = min(0.60, max(0.10, (avg_sl / 100.0) * (avg_leverage * 0.5 + 0.5)))
        
        # Volatility affinity: higher if trading alts with leverage
        volatility_affinity = min(1.0, max(0.2, (avg_leverage / 10.0) * 0.5 + 0.4))

        # Dynamic Archetype Classifier
        if avg_leverage >= 8.0 or max_leverage >= 15.0:
            archetype = "High-Leverage Momentum Scalper"
            unwind_strategy = "TRAILING_STOP_REBOUND_HARVEST"
            rsi_threshold = 24
        elif spot_count > total * 0.6 and avg_leverage <= 1.5:
            archetype = "Ultra-Conservative Capital Preserver"
            unwind_strategy = "IMMEDIATE_STABLE_CONSOLIDATION"
            rsi_threshold = 32
        elif limit_ratio >= 70 and sl_adherence >= 80:
            archetype = "Patience-Disciplined Swing Hedger"
            unwind_strategy = "TWAP_VOLATILITY_ADAPTIVE"
            rsi_threshold = 28
        else:
            archetype = "Tactical Adaptive Combatant"
            unwind_strategy = "TWAP_VOLATILITY_ADAPTIVE"
            rsi_threshold = 26

        dna_data = self.dna.get("trader_dna", self.dna)
        dna_data["archetype"] = archetype
        dna_data["unwind_strategy"] = unwind_strategy
        dna_data["panic_dump_threshold_rsi"] = rsi_threshold
        dna_data["max_leverage_limit"] = round(max(3.0, max_leverage * 1.2), 1)
        
        dna_data["telemetry"] = {
            "total_trades_recorded": total,
            "avg_leverage": round(avg_leverage, 1),
            "stop_loss_adherence_pct": round(sl_adherence, 1),
            "limit_order_ratio_pct": round(limit_ratio, 1),
            "perp_ratio_pct": round((perp_count / total) * 100, 1),
            "spot_ratio_pct": round((spot_count / total) * 100, 1),
            "futures_ratio_pct": round((futures_count / total) * 100, 1),
            "last_recorded_at": int(time.time())
        }

        dna_data["risk_vector"] = {
            "drawdown_tolerance": round(drawdown_tolerance, 2),
            "volatility_affinity": round(volatility_affinity, 2),
            "leverage_appetite": round(leverage_appetite, 2),
            "patience_score": round(patience_score, 2)
        }

        dna_data["personal_tenets"] = [
            f"Never market-sell into an oversold RSI (< {rsi_threshold}).",
            f"Execute cross-chain unwinds via {unwind_strategy} with max leverage cap of {dna_data['max_leverage_limit']}x.",
            f"Enforce stop-loss cushion based on historical {round(sl_adherence, 0)}% adherence discipline.",
            "Consolidate all peripheral LPs into USDC via NEAR Intents."
        ]

        self.dna["trader_dna"] = dna_data
        self.dna["trade_history"] = self.trade_history

    def get_prompt_constraints(self) -> str:
        """
        Formats the Trader DNA into strict behavioural constraints for the LLM reasoner.
        """
        dna_data = self.dna.get("trader_dna", self.dna)
        tenets = "\n- ".join(dna_data.get("personal_tenets", []))
        risk = dna_data.get("risk_vector", {})
        telem = dna_data.get("telemetry", {})

        return f"""
[OWNER'S TRADER DNA & LIVE BEHAVIORAL PROFILE]
- Archetype: {dna_data.get('archetype', 'Disciplined Hedger')}
- Unwind Strategy: {dna_data.get('unwind_strategy', 'TWAP')}
- Max Permitted Leverage Cap: {dna_data.get('max_leverage_limit', 3.0)}x
- Target Reserve Asset: {dna_data.get('preferred_reserve_asset', 'USDC')}
- Recorded Trade Samples: {telem.get('total_trades_recorded', 0)} (Avg Leverage: {telem.get('avg_leverage', 2.5)}x, SL Adherence: {telem.get('stop_loss_adherence_pct', 90)}%)
- Risk Tolerances: Drawdown: {risk.get('drawdown_tolerance')}, Volatility: {risk.get('volatility_affinity')}, Patience: {risk.get('patience_score')}
- Owner's Immutable Behavioral Tenets:
- {tenets}
"""

    def evaluate_action_alignment(self, candidate_action: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanity-checks a planned market action against the owner's Trader DNA boundaries.
        """
        dna_data = self.dna.get("trader_dna", self.dna)
        slippage = candidate_action.get("slippage_pct", 0.0)
        max_slippage = dna_data.get("max_slippage_tolerance_pct", 0.5)

        if slippage > max_slippage:
            return {
                "aligned": False,
                "reason": f"Action slippage ({slippage}%) exceeds owner's strict threshold ({max_slippage}%)"
            }

        return {"aligned": True, "reason": "Action fully conforms to owner's trading psychology."}
