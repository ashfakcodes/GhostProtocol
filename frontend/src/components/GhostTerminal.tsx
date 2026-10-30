import React, { useRef, useEffect } from 'react';
import { Terminal, Copy, Check, Shield, Flame } from 'lucide-react';

interface GhostTerminalProps {
  logs: string[];
  status: string;
}

export const GhostTerminal: React.FC<GhostTerminalProps> = ({ logs, status }) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTagColor = (line: string) => {
    if (line.includes('[CRITICAL]') || line.includes('[GHOST_BRAIN]')) return 'text-scarlet-400 font-bold';
    if (line.includes('[WARNING]')) return 'text-cyber-amber font-bold';
    if (line.includes('[COMBAT_AI]') || line.includes('[REASONING]')) return 'text-cyber-cyan';
    if (line.includes('[SOLVER_BUS]') || line.includes('[INTENTS]')) return 'text-purple-400';
    if (line.includes('[SETTLEMENT]') || line.includes('[SUCCESS]')) return 'text-cyber-emerald font-bold';
    if (line.includes('[DNA_MIMIC]')) return 'text-amber-300';
    return 'text-slate-400';
  };

  return (
    <div className="bg-obsidian-950 border border-obsidian-800 rounded-xl overflow-hidden flex flex-col h-[380px]">
      {/* Terminal Top Bar */}
      <div className="bg-obsidian-900 border-b border-obsidian-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-mono text-slate-300">ghost-agent-daemon :: near-live-telemetry</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-obsidian-800 text-slate-400 uppercase">
            {status}
          </span>
          <button
            onClick={copyLogs}
            className="text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1 font-mono"
            title="Copy Terminal Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1.5 bg-obsidian-950 leading-relaxed">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">
            Connecting to GhostProtocol telemetry stream...
          </div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-obsidian-700 select-none">{String(idx + 1).padStart(2, '0')}</span>
              <span className={getTagColor(log)}>{log}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Status Bar Footer */}
      <div className="bg-obsidian-900 border-t border-obsidian-800 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            NEAR Testnet Live
          </span>
          <span>Solver Bus: Connected</span>
          <span className="hidden sm:inline text-sky-400">Engine: OpenRouter (ling-3.0-flash)</span>
        </div>
        <span className="text-slate-500">Target: USDC Settlement</span>
      </div>
    </div>
  );
};
