import React from 'react';
import { Activity, ShieldAlert, Zap, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CountdownHUDProps {
  status: string;
  timeRemainingMs: number;
  timeoutPeriodMs: number;
  treasuryNear: number;
  onPingHeartbeat: () => void;
  onResetDemo: () => void;
  isPinging: boolean;
}

export const CountdownHUD: React.FC<CountdownHUDProps> = ({
  status,
  timeRemainingMs,
  timeoutPeriodMs,
  treasuryNear,
  onPingHeartbeat,
  onResetDemo,
  isPinging
}) => {
  const secondsLeft = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const progressPct = Math.min(100, Math.max(0, (timeRemainingMs / timeoutPeriodMs) * 100));

  const getStatusBadge = () => {
    switch (status) {
      case 'Alive':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyber-emerald/10 text-cyber-emerald border border-cyber-emerald/30">
            <span className="w-2 h-2 rounded-full bg-cyber-emerald animate-pulse"></span>
            ACTIVE GUARDIAN (ALIVE)
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/40 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-cyber-amber" />
            GRACE PERIOD EXPIRING
          </span>
        );
      case 'GhostAwake':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-scarlet-500/20 text-scarlet-400 border border-scarlet-500 animate-pulse-glow">
            <Zap className="w-3.5 h-3.5 text-scarlet-400" />
            GHOST AGENT AWAKE
          </span>
        );
      case 'Executed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyber-cyan" />
            ESTATE EXECUTED & DELIVERED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative bg-obsidian-900 border border-obsidian-700/60 rounded-2xl p-6 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Background glow ambient */}
      <div className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-colors duration-1000 ${
        status === 'GhostAwake' ? 'bg-scarlet-500/20' : status === 'Warning' ? 'bg-cyber-amber/15' : 'bg-cyber-cyan/10'
      }`}></div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        {/* Left: Ticker & Status */}
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="46"
                className="text-obsidian-800 stroke-current"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r="46"
                className={`stroke-current transition-all duration-300 ${
                  status === 'GhostAwake'
                    ? 'text-scarlet-500 shadow-scarlet-glow'
                    : status === 'Warning'
                    ? 'text-cyber-amber'
                    : 'text-cyber-emerald'
                }`}
                strokeWidth="7"
                strokeDasharray={289}
                strokeDashoffset={289 - (289 * progressPct) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-mono text-3xl font-bold tracking-tight text-white">
                {secondsLeft}s
              </span>
              <span className="text-[10px] tracking-wider uppercase text-slate-400 font-mono">
                {status === 'Executed' ? 'FINAL' : 'TIMER'}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              {getStatusBadge()}
            </div>
            <h2 className="text-xl font-bold tracking-wide text-white flex items-center gap-2">
              Cryptographic Proof-of-Life
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              While active, daily pings keep the Sovereign Executor locked. Zero response triggers the Post-Human Ghost Brain.
            </p>
          </div>
        </div>

        {/* Right: Actions & Vault Balance */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="bg-obsidian-800/80 border border-obsidian-700 rounded-xl px-4 py-2.5 text-right w-full sm:w-auto">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-mono">NEAR Treasury Escrow</span>
            <span className="text-lg font-mono font-bold text-white flex items-center justify-end gap-1.5">
              <span className="text-cyber-cyan">Ⓝ</span> {treasuryNear.toFixed(2)} NEAR
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onPingHeartbeat}
              disabled={isPinging || status === 'Executed'}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-scarlet-500 hover:bg-scarlet-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-medium px-5 py-2.5 rounded-xl transition-all shadow-scarlet-glow cursor-pointer text-sm"
            >
              <Activity className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? 'Pinging NEAR...' : 'Ping Heartbeat'}</span>
            </button>

            <button
              onClick={onResetDemo}
              title="Reset Demo to Alive (15s)"
              className="p-2.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 hover:text-white border border-obsidian-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
