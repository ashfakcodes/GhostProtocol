import json
from typing import Dict, Any, List

class TraderDNAEngine:
    """
    Trader DNA Engine: Encodes and mimics the deceased owner's trading psychology,
    risk tolerance, leverage boundaries, and exit habits.
    """

    def __init__(self, raw_dna_json: str = None):
        if raw_dna_json:
            try:
                self.dna = json.loads(raw_dna_json)
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
            }
        }

    def get_prompt_constraints(self) -> str:
        """
        Formats the Trader DNA into strict behavioural constraints for the LLM reasoner.
        """
        dna_data = self.dna.get("trader_dna", self.dna)
        tenets = "\n- ".join(dna_data.get("personal_tenets", []))
        risk = dna_data.get("risk_vector", {})

        return f"""
[OWNER'S TRADER DNA & BEHAVIORAL PROFILE]
- Archetype: {dna_data.get('archetype', 'Disciplined Hedger')}
- Unwind Strategy: {dna_data.get('unwind_strategy', 'TWAP')}
- Max Slippage Tolerance: {dna_data.get('max_slippage_tolerance_pct', 0.3)}%
- Target Reserve Asset: {dna_data.get('preferred_reserve_asset', 'USDC')}
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
