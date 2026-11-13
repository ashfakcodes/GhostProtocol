import React from 'react';
import { Activity, Zap, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CountdownHUDProps {
  status: string;
  timeRemainingMs: number;
  timeoutPeriodMs: number;
  treasuryNear: number;
  onPingHeartbeat: () => void;
  onResetDemo: () => void;
  onSimulateDemise?: () => void;
  isPinging: boolean;
}

export const CountdownHUD: React.FC<CountdownHUDProps> = ({
  status,
  timeRemainingMs,
  timeoutPeriodMs,
  treasuryNear,
  onPingHeartbeat,
  onResetDemo,
  onSimulateDemise,
  isPinging
}) => {
  const secondsLeft = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const progressPct = Math.min(100, Math.max(0, (timeRemainingMs / timeoutPeriodMs) * 100));

  const getStatusBadge = () => {
    switch (status) {
      case 'Alive':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            ACTIVE GUARDIAN (ALIVE)
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            GRACE PERIOD EXPIRING
          </span>
        );
      case 'GhostAwake':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/30">
            <Zap className="w-3 h-3 text-red-400" />
            GHOST AGENT AWAKE
          </span>
        );
      case 'Executed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CheckCircle2 className="w-3 h-3 text-sky-400" />
            ESTATE EXECUTED & DELIVERED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-5">
      <div className="flex flex-col md:flex-row items-center justify-between gap-5">
        {/* Left: Ticker & Status */}
        <div className="flex items-center gap-5">
          <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                className="text-obsidian-800 stroke-current"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                className={`stroke-current transition-all duration-300 ${
                  status === 'Executed'
                    ? 'text-sky-500'
                    : status === 'GhostAwake'
                    ? 'text-red-500'
                    : status === 'Warning'
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }`}
                strokeWidth="5"
                strokeDasharray={251.3}
                strokeDashoffset={251.3 - (251.3 * progressPct) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-mono text-2xl font-bold tracking-tight text-white">
                {secondsLeft}s
              </span>
              <span className="text-[9px] tracking-wider uppercase text-slate-500 font-mono">
                {status === 'Executed' ? 'FINAL' : 'COUNTDOWN'}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {getStatusBadge()}
            </div>
            <h2 className="text-base font-bold tracking-tight text-white">
              Cryptographic Proof-of-Life
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
              While active, trades & heartbeat pings keep the Sovereign Executor locked. Zero response triggers the Post-Human Ghost Brain.
            </p>
          </div>
        </div>

        {/* Right: Actions & Vault Balance */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="bg-obsidian-950 border border-obsidian-800 rounded-lg px-3.5 py-2 text-right w-full sm:w-auto">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">NEAR Escrow Treasury</span>
            <span className="text-sm font-mono font-bold text-white flex items-center justify-end gap-1.5">
              <span className="text-slate-400">Ⓝ</span> {treasuryNear.toFixed(2)} NEAR
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {status === 'Executed' ? (
              <button
                onClick={onResetDemo}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-mono text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-500/20 cursor-pointer animate-pulse"
                title="Re-arm protocol and revive demo scenario"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-arm Protocol (Reset Demo)</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onPingHeartbeat}
                  disabled={isPinging || status === 'GhostAwake'}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-mono text-xs font-medium px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>{isPinging ? 'Pinging NEAR...' : 'Ping Heartbeat'}</span>
                </button>

                {onSimulateDemise && (
                  <button
                    onClick={onSimulateDemise}
                    disabled={status === 'GhostAwake'}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 active:scale-95 text-slate-300 hover:text-white border border-obsidian-700 font-mono text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                    title="Simulate sudden absence to test autonomous takeover & cross-chain radar immediately"
                  >
                    <span>Simulate Absence</span>
                  </button>
                )}
              </>
            )}

            <button
              onClick={onResetDemo}
              title={`Reset Demo to Alive (${Math.round(timeoutPeriodMs / 1000)}s)`}
              className="p-2.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 text-slate-400 hover:text-white border border-obsidian-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
