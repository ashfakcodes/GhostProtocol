import React, { useState } from 'react';
import { Sliders, ShieldCheck, Cpu, ArrowRight, Zap, Target } from 'lucide-react';

interface TraderDNASetupProps {
  onSaveDNA: (dna: any) => void;
}

export const TraderDNASetup: React.FC<TraderDNASetupProps> = ({ onSaveDNA }) => {
  const [archetype, setArchetype] = useState('Patience-Disciplined Swing Hedger');
  const [drawdown, setDrawdown] = useState(35);
  const [volatility, setVolatility] = useState(65);
  const [leverage, setLeverage] = useState(3);
  const [patience, setPatience] = useState(85);
  const [unwindStrategy, setUnwindStrategy] = useState('TWAP_VOLATILITY_ADAPTIVE');
  const [reserveAsset, setReserveAsset] = useState('USDC');
  const [isSaved, setIsSaved] = useState(false);

  const archetypes = [
    {
      id: 'Patience-Disciplined Swing Hedger',
      name: 'Disciplined Swing Hedger',
      desc: 'Never panic-sells oversold dips. Unwinds via multi-batch TWAP and uses delta-neutral hedges.',
      color: 'border-zinc-500 text-slate-200'
    },
    {
      id: 'Ultra-Conservative Capital Preserver',
      name: 'Capital Preserver',
      desc: 'Immediate protective hedging. Strict 0.15% slippage cap. Deploys exclusively into safe yield vaults.',
      color: 'border-zinc-500 text-slate-200'
    },
    {
      id: 'Tactical Momentum Combatant',
      name: 'Tactical Combatant',
      desc: 'Fights toxic flow & MEV. Uses trailing stops on rebounds to extract maximum value for beneficiaries.',
      color: 'border-zinc-500 text-slate-200'
    }
  ];

  const handleSave = () => {
    const payload = {
      trader_dna: {
        archetype,
        max_slippage_tolerance_pct: 0.25,
        unwind_strategy: unwindStrategy,
        panic_dump_threshold_rsi: 30,
        perp_action: 'CLOSE_ON_REBOUND_OR_TRAILING_STOP',
        preferred_reserve_asset: reserveAsset,
        max_leverage_limit: leverage,
        trading_patterns: {
          execution_style: 'LIMIT_DISCIPLINED',
          time_horizon: 'SWING_TRADER (1h-24h)',
          limit_order_ratio_pct: 80.0,
          perp_ratio_pct: 65.0,
          spot_ratio_pct: 25.0,
          futures_ratio_pct: 10.0
        },
        risk_tolerance: {
          drawdown_tolerance: drawdown / 100,
          volatility_affinity: volatility / 100,
          leverage_appetite: leverage / 20,
          patience_score: patience / 100
        },
        risk_vector: {
          drawdown_tolerance: drawdown / 100,
          volatility_affinity: volatility / 100,
          leverage_appetite: leverage / 20,
          patience_score: patience / 100
        },
        leverage_preferences: {
          avg_leverage: Math.min(leverage, 2.5),
          max_recorded_leverage: leverage,
          leverage_discipline_grade: leverage <= 3 ? 'A (CONSERVATIVE)' : leverage <= 7 ? 'B (MODERATE)' : 'C (AGGRESSIVE)'
        },
        stop_loss_habits: {
          stop_loss_adherence_pct: 92.0,
          avg_stop_loss_pct: 3.2,
          hard_stop_enforcement: true
        },
        profit_taking_behavior: {
          realized_rr_ratio: 2.15,
          tp_target_adherence_pct: 85.0,
          profit_harvest_style: 'SCALE_OUT_TWAP',
          avg_take_profit_pct: 6.2,
          win_rate_pct: 66.7
        },
        decision_making_tendencies: {
          dip_buyer_vs_breakout_score: 0.82,
          panic_dump_resilience: patience / 100,
          funding_rate_tolerance: 'DEFENSIVE_HEDGER',
          decision_speed: 'DELIBERATE (LIMIT_PLACED)'
        },
        personal_tenets: [
          `Never market-sell into an oversold RSI (< 38).`,
          `Enforce minimum 2.15x Risk/Reward discipline before exiting profitable positions.`,
          `Unwind positions via SCALE_OUT_TWAP with max leverage cap of ${leverage}x.`,
          `Maintain ${patience}% panic resilience holding through flash-crash spikes.`,
          `Consolidate all peripheral tokens into ${reserveAsset} via NEAR Intents.`
        ]
      }
    };
    onSaveDNA(payload);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-obsidian-800 border border-obsidian-700 text-slate-300">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Trader DNA & Behavioral Twin Engine
            </h3>
            <p className="text-xs text-slate-400">
              Your living trading clone. When you go dark, the Ghost Agent mimics your exact psychology.
            </p>
          </div>
        </div>

        {isSaved && (
          <span className="text-xs font-mono font-medium text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            DNA SYNCED
          </span>
        )}
      </div>

      {/* Archetype Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {archetypes.map((a) => (
          <div
            key={a.id}
            onClick={() => setArchetype(a.id)}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              archetype === a.id
                ? `${a.color} bg-obsidian-800`
                : 'border-obsidian-800 bg-obsidian-950 text-slate-400 hover:border-obsidian-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">{a.name}</span>
              {archetype === a.id && <Zap className="w-3.5 h-3.5" />}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">{a.desc}</p>
          </div>
        ))}
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-obsidian-950/60 p-4 rounded-xl border border-obsidian-800">
        <div>
          <div className="flex justify-between text-xs mb-1 font-mono">
            <span className="text-slate-400">Drawdown Tolerance</span>
            <span className="text-cyber-cyan font-bold">{drawdown}%</span>
          </div>
          <input
            type="range"
            min="5"
            max="60"
            value={drawdown}
            onChange={(e) => setDrawdown(Number(e.target.value))}
            className="w-full accent-scarlet-500 h-1.5 bg-obsidian-700 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1 font-mono">
            <span className="text-slate-400">Patience / Anti-Dump Discipline</span>
            <span className="text-cyber-emerald font-bold">{patience}/100</span>
          </div>
          <input
            type="range"
            min="20"
            max="100"
            value={patience}
            onChange={(e) => setPatience(Number(e.target.value))}
            className="w-full accent-cyber-emerald h-1.5 bg-obsidian-700 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1 font-mono">
            <span className="text-slate-400">Max Permitted Leverage</span>
            <span className="text-cyber-amber font-bold">{leverage}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-cyber-amber h-1.5 bg-obsidian-700 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1 font-mono">
            <span className="text-slate-400">Target Settlement Asset</span>
            <span className="text-white font-bold">{reserveAsset}</span>
          </div>
          <div className="flex gap-2 mt-1">
            {['USDC', 'USDT', 'NEAR'].map((asset) => (
              <button
                key={asset}
                type="button"
                onClick={() => setReserveAsset(asset)}
                className={`text-xs px-2.5 py-1 rounded font-mono border transition-all ${
                  reserveAsset === asset
                    ? 'border-zinc-500 bg-obsidian-800 text-white font-bold'
                    : 'border-obsidian-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-950 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-zinc-700" />
          <span>Commit Trader DNA</span>
        </button>
      </div>
    </div>
  );
};
