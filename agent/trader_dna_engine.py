import json
import time
from typing import Dict, Any, List

class TraderDNAEngine:
    """
    Trader DNA Engine: Encodes, monitors, and mimics the owner's 6 core behavioral dimensions:
    1. Trading Patterns (execution style, frequency, order types, time horizon)
    2. Risk Tolerance (drawdown resilience, leverage elasticity, margin mode)
    3. Leverage Preferences (average leverage, leverage caps, degen vs conservative vectors)
    4. Stop-Loss Habits (stop adherence, average stop cushion, risk boundaries)
    5. Profit-Taking Behavior (realized R:R ratio, TP discipline, harvest style)
    6. Decision-Making Tendencies (dip buyer vs breakout chaser, panic resilience, funding sensitivity)
    """

    def __init__(self, raw_dna_json: str = None):
        self.trade_history: List[Dict[str, Any]] = []
        self.closed_positions: List[Dict[str, Any]] = []
        if raw_dna_json:
            try:
                self.dna = json.loads(raw_dna_json)
                self.trade_history = self.dna.get("trade_history", [])
                self.closed_positions = self.dna.get("closed_positions", [])
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
                
                # 1. Trading Patterns
                "trading_patterns": {
                    "execution_style": "LIMIT_DISCIPLINED",
                    "time_horizon": "SWING_TRADER (1h-24h)",
                    "limit_order_ratio_pct": 80.0,
                    "perp_ratio_pct": 65.0,
                    "spot_ratio_pct": 25.0,
                    "futures_ratio_pct": 10.0
                },

                # 2. Risk Tolerance
                "risk_tolerance": {
                    "drawdown_tolerance": 0.35,     # 35% max drawdown patience
                    "volatility_affinity": 0.65,    # medium-high volatility comfort
                    "leverage_appetite": 0.25,      # low leverage preference
                    "patience_score": 0.88          # high patience (avoids instant market dumps)
                },

                # 3. Leverage Preferences
                "leverage_preferences": {
                    "avg_leverage": 2.5,
                    "max_recorded_leverage": 3.0,
                    "leverage_discipline_grade": "A (CONSERVATIVE)"
                },

                # 4. Stop-Loss Habits
                "stop_loss_habits": {
                    "stop_loss_adherence_pct": 92.0,
                    "avg_stop_loss_pct": 3.2,
                    "hard_stop_enforcement": True
                },

                # 5. Profit-Taking Behavior
                "profit_taking_behavior": {
                    "realized_rr_ratio": 2.15,            # Realized Risk/Reward
                    "tp_target_adherence_pct": 85.0,      # Allowed to run to TP target
                    "profit_harvest_style": "SCALE_OUT_TWAP", # SCALE_OUT_TWAP vs QUICK_SCALP
                    "avg_take_profit_pct": 6.2,
                    "win_rate_pct": 66.7
                },

                # 6. Decision-Making Tendencies
                "decision_making_tendencies": {
                    "dip_buyer_vs_breakout_score": 0.82,  # 0.82 = Counter-cyclical dip buyer (low RSI)
                    "panic_dump_resilience": 0.94,        # 0.94 = Refuses to panic-sell during red candles
                    "funding_rate_tolerance": "DEFENSIVE_HEDGER",
                    "decision_speed": "DELIBERATE (LIMIT_PLACED)"
                },

                # Summary Telemetry Metrics for quick UI readout
                "telemetry": {
                    "total_trades_recorded": 2,
                    "total_positions_closed": 1,
                    "avg_leverage": 2.5,
                    "realized_rr_ratio": 2.15,
                    "panic_dump_resilience": 0.94,
                    "dip_buyer_score": 0.82,
                    "profit_harvest_style": "SCALE_OUT_TWAP",
                    "stop_loss_adherence_pct": 92.0,
                    "last_recorded_at": int(time.time())
                },

                "personal_tenets": [
                    "Never market-sell into an oversold RSI (< 28).",
                    "Enforce minimum 2.1x Risk/Reward discipline before exiting profitable positions.",
                    "Execute cross-chain unwinds via TWAP batches with max leverage cap of 3.0x.",
                    "Consolidate all peripheral LPs into USDC via NEAR Intents."
                ]
            },
            "trade_history": [],
            "closed_positions": []
        }

    def record_trade(self, trade: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingests a new order submission and recalibrates open-phase metrics (entry RSI, order types, leverage).
        """
        trade_record = {
            "id": trade.get("id", f"tr-{int(time.time() * 1000)}"),
            "timestamp": trade.get("timestamp", int(time.time())),
            "symbol": trade.get("symbol", "NEAR/USDC"),
            "mode": trade.get("mode", "PERP"),
            "side": trade.get("side", "BUY"),
            "order_type": trade.get("order_type", "LIMIT"),
            "size": float(trade.get("size", 10.0)),
            "price": float(trade.get("price", 5.20)),
            "leverage": float(trade.get("leverage", 1.0) if trade.get("mode") != "SPOT" else 1.0),
            "has_stop_loss": bool(trade.get("has_stop_loss", True)),
            "stop_loss_pct": float(trade.get("stop_loss_pct", 2.5)),
            "take_profit_pct": float(trade.get("take_profit_pct", 5.0)),
            "entry_rsi": float(trade.get("entry_rsi", 32.5)) # Entry market momentum
        }

        self.trade_history.append(trade_record)
        if len(self.trade_history) > 50:
            self.trade_history.pop(0)

        self._recalibrate_all_dimensions()
        return self.dna

    def record_position_close(self, close_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingests a completed position close to calculate realized Profit-Taking behavior,
        actual Risk/Reward ratio, and Panic Resilience.
        """
        pnl = float(close_data.get("pnl", 0.0))
        pnl_pct = float(close_data.get("pnl_pct", 0.0))
        entry_price = float(close_data.get("entry_price", 1.0))
        exit_price = float(close_data.get("exit_price", entry_price))
        opened_at = int(close_data.get("opened_at", time.time() - 3600))
        closed_at = int(time.time())
        duration_s = max(1, closed_at - opened_at)
        
        target_tp = float(close_data.get("take_profit", entry_price * 1.06))
        target_sl = float(close_data.get("stop_loss", entry_price * 0.97))
        side = close_data.get("side", "LONG")

        # Did it reach or approach target TP?
        hit_tp = False
        if side == "LONG":
            hit_tp = exit_price >= target_tp * 0.95
        else:
            hit_tp = exit_price <= target_tp * 1.05

        # Planned risk vs realized reward (strictly signed and direction-aware)
        initial_risk_dist = abs(entry_price - target_sl) / entry_price if entry_price > 0 else 0.03
        initial_risk_dist = max(0.005, initial_risk_dist)

        # Reward = price move in favorable direction
        if side in ["LONG", "BUY"]:
            price_delta = exit_price - entry_price
        else:
            price_delta = entry_price - exit_price

        # Directional realized reward ratio
        # For winning trades: positive multiple of initial risk
        # For losing trades: negative multiple or 0
        realized_return_dist = price_delta / entry_price if entry_price > 0 else 0.0
        realized_rr = round(realized_return_dist / initial_risk_dist, 2)

        record = {
            "id": close_data.get("id", f"close-{int(time.time()*1000)}"),
            "symbol": close_data.get("symbol", "NEAR/USDC"),
            "side": side,
            "mode": close_data.get("mode", "PERP"),
            "pnl": pnl,
            "pnl_pct": pnl_pct,
            "duration_s": duration_s,
            "hit_tp": hit_tp,
            "realized_rr": realized_rr,
            "closed_at": closed_at
        }

        self.closed_positions.append(record)
        if len(self.closed_positions) > 50:
            self.closed_positions.pop(0)

        self._recalibrate_all_dimensions()
        return self.dna

    def _recalibrate_all_dimensions(self):
        total_trades = len(self.trade_history)
        total_closes = len(self.closed_positions)
        if total_trades == 0:
            return

        # 1. Trading Patterns
        limit_orders = sum(1 for t in self.trade_history if t.get("order_type", "LIMIT") in ["LIMIT", "TWAP"])
        limit_ratio = (limit_orders / total_trades) * 100
        perp_count = sum(1 for t in self.trade_history if t.get("mode", "PERP") == "PERP")
        spot_count = sum(1 for t in self.trade_history if t.get("mode", "PERP") == "SPOT")
        futures_count = sum(1 for t in self.trade_history if t.get("mode", "PERP") == "FUTURES")

        avg_duration = 3600
        if total_closes > 0:
            avg_duration = sum(c.get("duration_s", 3600) for c in self.closed_positions) / total_closes

        if avg_duration < 900:
            time_horizon = "SCALPER (<15m)"
        elif avg_duration < 86400:
            time_horizon = "SWING_TRADER (1h-24h)"
        else:
            time_horizon = "POSITIONAL (>24h)"

        # 2 & 3. Leverage Preferences
        leverages = [t.get("leverage", 1.0) for t in self.trade_history]
        avg_leverage = sum(leverages) / total_trades
        max_leverage = max(leverages)

        if avg_leverage <= 3.0:
            lev_grade = "A (CONSERVATIVE)"
        elif avg_leverage <= 7.0:
            lev_grade = "B (MODERATE)"
        else:
            lev_grade = "C (HIGH DEGEN RISK)"

        # 4. Stop-Loss Habits
        stop_loss_count = sum(1 for t in self.trade_history if t.get("has_stop_loss", True))
        sl_adherence = (stop_loss_count / total_trades) * 100
        avg_sl = sum(t.get("stop_loss_pct", 2.5) for t in self.trade_history) / total_trades

        # 5. Profit-Taking Behavior
        avg_tp = sum(t.get("take_profit_pct", 5.0) for t in self.trade_history) / total_trades
        if total_closes > 0:
            winning_closes = [c for c in self.closed_positions if c.get("pnl", 0.0) > 0]
            losing_closes = [c for c in self.closed_positions if c.get("pnl", 0.0) < 0]

            # True realized profit factor / R:R ratio
            avg_win_gain = sum(c.get("realized_rr", 1.0) for c in winning_closes) / len(winning_closes) if winning_closes else (avg_tp / max(1.0, avg_sl))
            avg_loss_dist = abs(sum(c.get("realized_rr", -1.0) for c in losing_closes) / len(losing_closes)) if losing_closes else 1.0

            realized_rr = round(max(0.1, avg_win_gain / max(0.5, avg_loss_dist)), 2)
            wins = len(winning_closes)
            win_rate = round((wins / total_closes) * 100, 1)
            tp_hits = sum(1 for c in self.closed_positions if c.get("hit_tp", False))
            tp_adherence = round((tp_hits / total_closes) * 100, 1)
        else:
            realized_rr = round(avg_tp / max(1.0, avg_sl), 2)
            win_rate = 65.0
            tp_adherence = 85.0

        if realized_rr >= 2.0:
            profit_harvest_style = "SCALE_OUT_TWAP"
        elif realized_rr >= 1.2:
            profit_harvest_style = "TRAILING_STOP_RUNNER"
        else:
            profit_harvest_style = "QUICK_SCALP"

        # 6. Decision-Making Tendencies
        # Dip buyer score: check if user enters when RSI is low
        rsi_entries = [t.get("entry_rsi", 45.0) for t in self.trade_history]
        low_rsi_entries = sum(1 for r in rsi_entries if r <= 38.0)
        dip_buyer_score = round(max(0.1, min(0.99, (low_rsi_entries / total_trades) * 0.7 + 0.3)), 2)

        # Panic resilience: did user hold through red candles without panic closing at market?
        panic_dump_resilience = round(min(0.99, max(0.40, (limit_ratio / 100) * 0.5 + (sl_adherence / 100) * 0.5)), 2)

        # Synthesize Archetype
        if avg_leverage >= 8.0 or max_leverage >= 15.0:
            archetype = "High-Leverage Momentum Scalper"
            unwind_strategy = "TRAILING_STOP_REBOUND_HARVEST"
            rsi_threshold = 24
        elif spot_count > total_trades * 0.6 and avg_leverage <= 1.5:
            archetype = "Ultra-Conservative Capital Preserver"
            unwind_strategy = "IMMEDIATE_STABLE_CONSOLIDATION"
            rsi_threshold = 32
        elif realized_rr >= 1.8 and sl_adherence >= 80:
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

        dna_data["trading_patterns"] = {
            "execution_style": "LIMIT_DISCIPLINED" if limit_ratio >= 60 else "MARKET_AGGRESSIVE",
            "time_horizon": time_horizon,
            "limit_order_ratio_pct": round(limit_ratio, 1),
            "perp_ratio_pct": round((perp_count / total_trades) * 100, 1),
            "spot_ratio_pct": round((spot_count / total_trades) * 100, 1),
            "futures_ratio_pct": round((futures_count / total_trades) * 100, 1)
        }

        dna_data["risk_tolerance"] = {
            "drawdown_tolerance": round(min(0.60, max(0.10, (avg_sl / 100.0) * (avg_leverage * 0.5 + 0.5))), 2),
            "volatility_affinity": round(min(1.0, max(0.2, (avg_leverage / 10.0) * 0.5 + 0.4)), 2),
            "leverage_appetite": round(min(1.0, max(0.05, avg_leverage / 15.0)), 2),
            "patience_score": round(panic_dump_resilience, 2)
        }
        # Backward compatibility for risk_vector
        dna_data["risk_vector"] = dna_data["risk_tolerance"]

        dna_data["leverage_preferences"] = {
            "avg_leverage": round(avg_leverage, 1),
            "max_recorded_leverage": round(max_leverage, 1),
            "leverage_discipline_grade": lev_grade
        }

        dna_data["stop_loss_habits"] = {
            "stop_loss_adherence_pct": round(sl_adherence, 1),
            "avg_stop_loss_pct": round(avg_sl, 1),
            "hard_stop_enforcement": sl_adherence >= 80.0
        }

        dna_data["profit_taking_behavior"] = {
            "realized_rr_ratio": realized_rr,
            "tp_target_adherence_pct": tp_adherence,
            "profit_harvest_style": profit_harvest_style,
            "avg_take_profit_pct": round(avg_tp, 1),
            "win_rate_pct": win_rate
        }

        dna_data["decision_making_tendencies"] = {
            "dip_buyer_vs_breakout_score": dip_buyer_score,
            "panic_dump_resilience": panic_dump_resilience,
            "funding_rate_tolerance": "DEFENSIVE_HEDGER" if avg_leverage <= 5.0 else "MOMENTUM_SPECULATOR",
            "decision_speed": "DELIBERATE (LIMIT_PLACED)" if limit_ratio >= 60 else "FAST (MARKET_FLOW)"
        }

        dna_data["telemetry"] = {
            "total_trades_recorded": total_trades,
            "total_positions_closed": total_closes,
            "avg_leverage": round(avg_leverage, 1),
            "realized_rr_ratio": realized_rr,
            "panic_dump_resilience": panic_dump_resilience,
            "dip_buyer_score": dip_buyer_score,
            "profit_harvest_style": profit_harvest_style,
            "stop_loss_adherence_pct": round(sl_adherence, 1),
            "last_recorded_at": int(time.time())
        }

        dna_data["personal_tenets"] = [
            f"Never market-sell into an oversold RSI (< {rsi_threshold}).",
            f"Enforce minimum {realized_rr}x Risk/Reward discipline before exiting profitable positions.",
            f"Unwind positions via {profit_harvest_style} with max leverage cap of {dna_data['max_leverage_limit']}x.",
            f"Maintain {panic_dump_resilience * 100}% panic resilience holding through flash-crash spikes.",
            "Consolidate all peripheral LPs into USDC via NEAR Intents."
        ]

        self.dna["trader_dna"] = dna_data
        self.dna["trade_history"] = self.trade_history
        self.dna["closed_positions"] = self.closed_positions

    def get_prompt_constraints(self) -> str:
        """
        Formats all 6 behavioral dimensions into strict constraints for OpenRouter (inclusionai/ling-3.0-flash).
        """
        dna_data = self.dna.get("trader_dna", self.dna)
        patterns = dna_data.get("trading_patterns", {})
        risk = dna_data.get("risk_tolerance", {})
        lev = dna_data.get("leverage_preferences", {})
        sl = dna_data.get("stop_loss_habits", {})
        pt = dna_data.get("profit_taking_behavior", {})
        dec = dna_data.get("decision_making_tendencies", {})
        tenets = "\n- ".join(dna_data.get("personal_tenets", []))

        return f"""
[OWNER'S LIVING 6-DIMENSION TRADER DNA MATRIX]
1. TRADING PATTERNS:
   - Style: {patterns.get('execution_style')} | Horizon: {patterns.get('time_horizon')}
   - Limit/TWAP Order Ratio: {patterns.get('limit_order_ratio_pct')}%
2. RISK TOLERANCE:
   - Max Drawdown Patience: {risk.get('drawdown_tolerance')} | Volatility Affinity: {risk.get('volatility_affinity')}
   - Overall Patience Score: {risk.get('patience_score')}/1.0
3. LEVERAGE PREFERENCES:
   - Average Leverage: {lev.get('avg_leverage')}x | Max Cap Allowed: {dna_data.get('max_leverage_limit')}x
   - Discipline Grade: {lev.get('leverage_discipline_grade')}
4. STOP-LOSS HABITS:
   - Stop-Loss Adherence: {sl.get('stop_loss_adherence_pct')}% | Average SL Cushion: {sl.get('avg_stop_loss_pct')}%
5. PROFIT-TAKING BEHAVIOR:
   - Realized Risk/Reward (R:R): {pt.get('realized_rr_ratio')}x | Target Adherence: {pt.get('tp_target_adherence_pct')}%
   - Harvest Style: {pt.get('profit_harvest_style')} (Do not dump prematurely; scale out to maximize USDC)
6. DECISION-MAKING TENDENCIES:
   - Dip-Buyer Score: {dec.get('dip_buyer_vs_breakout_score')} (Buys dips at low RSI)
   - Panic-Dump Resilience: {dec.get('panic_dump_resilience')}/1.0 (Holds through red volatility)
   - Funding Rate Tolerance: {dec.get('funding_rate_tolerance')}

[OWNER'S IMMUTABLE BEHAVIORAL TENETS (MANDATORY TO MIMIC)]:
- {tenets}
"""

    def evaluate_action_alignment(self, candidate_action: Dict[str, Any]) -> Dict[str, Any]:
        dna_data = self.dna.get("trader_dna", self.dna)
        slippage = candidate_action.get("slippage_pct", 0.0)
        max_slippage = dna_data.get("max_slippage_tolerance_pct", 0.5)

        if slippage > max_slippage:
            return {
                "aligned": False,
                "reason": f"Action slippage ({slippage}%) exceeds owner's strict threshold ({max_slippage}%)"
            }

        return {"aligned": True, "reason": "Action fully conforms to owner's trading psychology."}
