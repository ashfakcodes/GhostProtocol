import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronUp, ChevronDown, Cpu, Terminal, Copy, Check, 
  Sparkles, Maximize2, Minimize2, Filter, Activity
} from 'lucide-react';

interface AgentThoughtsWindowProps {
  logs: string[];
  status: string;
}

export const AgentThoughtsWindow: React.FC<AgentThoughtsWindowProps> = ({ logs, status }) => {
  // Collapsed by default as requested
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [filterThoughtsOnly, setFilterThoughtsOnly] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter logs: either thoughts/reasoning only, or all telemetry
  const isThoughtLine = (line: string) => {
    return (
      line.includes('[REASONING]') ||
      line.includes('[COMBAT_AI]') ||
      line.includes('[GHOST_BRAIN]') ||
      line.includes('[DNA_MIMIC]') ||
      line.includes('[INTENTS]') ||
      line.includes('[SOLVER_BUS]') ||
      line.includes('[CRITICAL]') ||
      line.includes('[WARNING]')
    );
  };

  const displayedLogs = filterThoughtsOnly 
    ? logs.filter(isThoughtLine)
    : logs;

  // Auto-scroll when new logs arrive if expanded
  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded, filterThoughtsOnly]);

  // Latest thought for the collapsed preview bar
  const thoughtLogs = logs.filter(isThoughtLine);
  const latestThought = thoughtLogs.length > 0 ? thoughtLogs[thoughtLogs.length - 1] : (logs[logs.length - 1] || 'Agent standby. Awaiting telemetry or proof-of-life status...');

  // Clean the preview text for the compact bar
  const cleanPreview = latestThought.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*(\[[A-Z_]+\])?\s*/i, '');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(displayedLogs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTagBadge = (line: string) => {
    if (line.includes('[REASONING]')) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">REASONING</span>;
    }
    if (line.includes('[COMBAT_AI]')) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">COMBAT_AI</span>;
    }
    if (line.includes('[GHOST_BRAIN]') || line.includes('[CRITICAL]')) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">GHOST_BRAIN</span>;
    }
    if (line.includes('[DNA_MIMIC]')) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">DNA_MIMIC</span>;
    }
    if (line.includes('[INTENTS]') || line.includes('[SOLVER_BUS]')) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">INTENTS</span>;
    }
    if (line.includes('[WARNING]')) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">WARNING</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-obsidian-800 border border-obsidian-700">AGENT</span>;
  };

  const getTextColor = (line: string) => {
    if (line.includes('[CRITICAL]') || line.includes('[GHOST_BRAIN]')) return 'text-red-300';
    if (line.includes('[WARNING]')) return 'text-amber-300';
    if (line.includes('[REASONING]')) return 'text-sky-200';
    if (line.includes('[COMBAT_AI]')) return 'text-cyan-200';
    if (line.includes('[DNA_MIMIC]')) return 'text-amber-200';
    if (line.includes('[INTENTS]') || line.includes('[SOLVER_BUS]')) return 'text-purple-200';
    if (line.includes('[SETTLEMENT]') || line.includes('[SUCCESS]')) return 'text-emerald-300';
    return 'text-slate-300';
  };

  return (
    <div className="fixed bottom-3 right-4 sm:right-6 z-50 max-w-2xl w-[calc(100%-2rem)] sm:w-[560px] md:w-[620px] transition-all duration-300 ease-in-out font-sans shadow-2xl">
      <div className="bg-obsidian-900/95 backdrop-blur-md border border-obsidian-700/80 rounded-xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.6)]">
        {/* Header Bar - Always visible, acts as toggle when collapsed */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3.5 py-2.5 bg-obsidian-950/80 hover:bg-obsidian-800/90 cursor-pointer flex items-center justify-between gap-3 border-b border-obsidian-800/80 transition-colors select-none"
        >
          {/* Left Title & Status Indicator */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              {status !== 'Executed' && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  status === 'GhostAwake' ? 'bg-red-400' : (status === 'Warning' ? 'bg-amber-400' : 'bg-cyber-cyan')
                }`}></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                status === 'Executed'
                  ? 'bg-sky-400'
                  : status === 'GhostAwake'
                  ? 'bg-red-500'
                  : status === 'Warning'
                  ? 'bg-amber-500'
                  : 'bg-cyber-cyan'
              }`}></span>
            </span>

            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-200 tracking-tight flex-shrink-0">
              <Cpu className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>Agent Thoughts</span>
            </div>

            {/* Collapsed Snippet */}
            {!isExpanded && (
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[260px] sm:max-w-[340px] hidden xs:inline border-l border-obsidian-800 pl-2">
                {cleanPreview}
              </span>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isExpanded && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterThoughtsOnly(!filterThoughtsOnly);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                    filterThoughtsOnly 
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' 
                      : 'bg-obsidian-800 text-slate-400 border-obsidian-700 hover:text-white'
                  }`}
                  title="Toggle Thoughts Only vs All Telemetry"
                >
                  {filterThoughtsOnly ? '🧠 Thoughts Only' : '📋 All Logs'}
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-obsidian-800 text-slate-400 hover:text-white transition-colors"
                  title="Copy Agent Thoughts"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </>
            )}

            <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase border ${
              status === 'Executed'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : status === 'GhostAwake'
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : status === 'Warning'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-obsidian-800 border-obsidian-700 text-slate-300'
            }`}>
              {status}
            </span>

            <button 
              type="button"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-obsidian-800 transition-colors"
              title={isExpanded ? "Collapse Window" : "Expand Thoughts Window"}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content Body */}
        {isExpanded && (
          <div className="flex flex-col h-64 sm:h-72 bg-obsidian-950/95 font-mono text-xs">
            {/* Scrollable Thoughts Stream */}
            <div 
              ref={scrollRef}
              className="flex-1 p-3.5 overflow-y-auto space-y-2 leading-relaxed"
            >
              {displayedLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-[11px] gap-2">
                  <Cpu className="w-5 h-5 text-slate-600 animate-pulse" />
                  <span>Awaiting agent thoughts & market combat reasoning...</span>
                </div>
              ) : (
                displayedLogs.map((log, idx) => {
                  const cleanedText = log.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*(\[[A-Z_]+\])?\s*/i, '');
                  const timeMatch = log.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
                  const timestamp = timeMatch ? timeMatch[1] : '';

                  return (
                    <div 
                      key={idx} 
                      className="flex items-start gap-2 bg-obsidian-900/40 hover:bg-obsidian-900/80 p-1.5 rounded transition-colors border border-transparent hover:border-obsidian-800"
                    >
                      <span className="text-obsidian-600 text-[10px] select-none pt-0.5">
                        {timestamp || String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-shrink-0 pt-0.5">
                        {getTagBadge(log)}
                      </div>
                      <p className={`flex-1 text-[11px] leading-relaxed break-words ${getTextColor(log)}`}>
                        {cleanedText || log}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Telemetry Status */}
            <div className="px-3.5 py-1.5 bg-obsidian-900 border-t border-obsidian-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  OpenRouter (ling-3.0-flash)
                </span>
                <span className="hidden sm:inline text-obsidian-600">|</span>
                <span className="hidden sm:inline">NEAR Intent Solver Bus</span>
              </div>
              <span className="text-slate-500 font-mono">
                {displayedLogs.length} events logged
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
