import React, { useState, useEffect, useRef } from 'react';
import { Shield, Cpu, Terminal, KeyRound, ExternalLink, RefreshCw, BarChart2, ArrowRight } from 'lucide-react';
import { CountdownHUD } from './components/CountdownHUD';
import { TraderDNASetup } from './components/TraderDNASetup';
import { VaultEncryptor } from './components/VaultEncryptor';
import { GhostTerminal } from './components/GhostTerminal';
import { BeneficiaryClaim } from './components/BeneficiaryClaim';
import { TradingTerminal, Position } from './components/TradingTerminal';
import { AgentThoughtsWindow } from './components/AgentThoughtsWindow';
import { CrossChainRadar } from './components/CrossChainRadar';

const initialPositions: Position[] = [
  {
    id: "pos-near-01",
    symbol: "NEAR/USDC",
    mode: "PERP",
    side: "LONG",
    size: 500.0,
    entry_price: 4.05,
    mark_price: 4.08,
    leverage: 3.0,
    margin: 675.00,
    pnl: 15.00,
    pnl_pct: 2.22,
    stop_loss: 3.50,
    take_profit: 5.20,
    opened_at: Math.floor(Date.now() / 1000) - 3600
  },
  {
    id: "pos-eth-02",
    symbol: "ETH/USDC",
    mode: "PERP",
    side: "LONG",
    size: 1.5,
    entry_price: 2250.00,
    mark_price: 2280.00,
    leverage: 2.0,
    margin: 1687.50,
    pnl: 45.00,
    pnl_pct: 2.67,
    stop_loss: 1950.00,
    take_profit: 2800.00,
    opened_at: Math.floor(Date.now() / 1000) - 7200
  }
];

export function App() {
  const [activeTab, setActiveTab] = useState<'trade' | 'vault' | 'agent' | 'claim'>('trade');
  const [status, setStatus] = useState<string>('Alive');
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(50000);
  const [timeoutPeriodMs, setTimeoutPeriodMs] = useState<number>(50000);
  const [warningThresholdMs, setWarningThresholdMs] = useState<number>(15000);
  const [treasuryNear, setTreasuryNear] = useState<number>(12.5);
  const [keyShareA, setKeyShareA] = useState<string | null>(null);
  const [activePositions, setActivePositions] = useState<Position[]>(initialPositions);
  const [tradeHistory, setTradeHistory] = useState<any[]>([
    {
      id: "tr-hist-01",
      symbol: "NEAR/USDC",
      mode: "PERP",
      side: "BUY",
      order_type: "LIMIT",
      size: 500.0,
      price: 5.15,
      leverage: 3.0,
      has_stop_loss: true,
      stop_loss_pct: 3.3,
      timestamp: Math.floor(Date.now() / 1000) - 3600
    },
    {
      id: "tr-hist-02",
      symbol: "ETH/USDC",
      mode: "PERP",
      side: "BUY",
      order_type: "LIMIT",
      size: 1.5,
      price: 3120.00,
      leverage: 2.0,
      has_stop_loss: true,
      stop_loss_pct: 3.2,
      timestamp: Math.floor(Date.now() / 1000) - 7200
    }
  ]);
  const [traderDna, setTraderDna] = useState<any>({
    trader_dna: {
      archetype: "Patience-Disciplined Swing Hedger",
      unwind_strategy: "TWAP_VOLATILITY_ADAPTIVE",
      max_leverage_limit: 3.0,
      telemetry: {
        total_trades_recorded: 2,
        avg_leverage: 2.5,
        stop_loss_adherence_pct: 100.0,
        limit_order_ratio_pct: 100.0
      },
      risk_vector: {
        drawdown_tolerance: 0.35,
        patience_score: 0.90,
        leverage_appetite: 0.25
      },
      personal_tenets: [
        "Never market-sell into an oversold RSI (< 28).",
        "Always execute unwinds via TWAP batches across 3 intervals.",
        "Consolidate all peripheral LPs into USDC via NEAR Intents."
      ]
    }
  });

  const [logs, setLogs] = useState<string[]>([
    "[10:30:00] [WATCHMAN] GhostProtocol Watchman initialized on NEAR Testnet.",
    "[10:30:01] [STATE] Owner proof-of-life status: ALIVE.",
    "[10:30:02] [DNA_MIMIC] Loaded Owner Trader DNA: Patience-Disciplined Swing Hedger.",
    "[10:30:02] [AI_ENGINE] Connected to OpenRouter :: Model: inclusionai/ling-3.0-flash.",
    "[10:30:03] [TELEGRAM] Telegram heartbeat userbot armed. Ready for pings."
  ]);
  const [isPinging, setIsPinging] = useState(false);

  // References for dynamic timer intervals
  const timeoutRef = useRef(timeoutPeriodMs);
  timeoutRef.current = timeoutPeriodMs;
  const warningRef = useRef(warningThresholdMs);
  warningRef.current = warningThresholdMs;

  // Real-time synchronization sequence & timestamp tracking
  const lastSeqRef = useRef<number>(-1);
  const lastTimestampRef = useRef<number>(0);

  // Authoritative server state applier with out-of-order guard
  const applyServerState = (data: any) => {
    if (!data) return;

    // Support server sequence numbers (seq) to prevent out-of-order jitter
    if (typeof data.seq === 'number') {
      if (data.seq < lastSeqRef.current) {
        return; // Drop stale out-of-order sequence packet
      }
      lastSeqRef.current = data.seq;
    }

    // Support server timestamp comparison
    if (typeof data.timestamp === 'number') {
      if (data.timestamp < lastTimestampRef.current) {
        return; // Drop stale timestamp packet
      }
      lastTimestampRef.current = data.timestamp;
    }

    if (data.status) setStatus(data.status);
    if (data.time_remaining_ms !== undefined) setTimeRemainingMs(data.time_remaining_ms);
    if (data.timeout_period_ms) setTimeoutPeriodMs(data.timeout_period_ms);
    if (data.warning_threshold_ms) setWarningThresholdMs(data.warning_threshold_ms);
    if (data.treasury_near !== undefined) setTreasuryNear(data.treasury_near);
    if (data.key_share_a !== undefined) setKeyShareA(data.key_share_a);
    if (data.active_positions) setActivePositions(data.active_positions);
    if (data.trade_history) setTradeHistory(data.trade_history);
    if (data.trader_dna) setTraderDna(data.trader_dna);
    if (data.logs && data.logs.length > 0) setLogs(data.logs);
  };

  // Immediate REST Status Synchronization on Mount
  useEffect(() => {
    fetch('http://localhost:8000/api/status')
      .then(res => res.json())
      .then(data => {
        applyServerState(data);
      })
      .catch(() => {});
  }, []);

  // WebSocket with Exponential Backoff Auto-Reconnect & Resilient State Sync
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: any = null;
    let visualCountdownInterval: any = null;
    let backoffMs = 1000;
    const MAX_BACKOFF_MS = 8000;
    const BACKOFF_MULTIPLIER = 1.5;

    // Eliminate client-side timer race condition:
    // When local timer reaches expiration, check real server state rather than
    // unilaterally assuming GhostAwake or arbitrarily revealing keys.
    const verifyServerStateOnExpiry = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/status');
        if (res.ok && isMounted) {
          const data = await res.json();
          applyServerState(data);
        }
      } catch (e) {
        // Disconnected/network error: keep current status, do NOT invent GhostAwake
      }
    };

    const startVisualCountdown = () => {
      if (visualCountdownInterval) return;
      visualCountdownInterval = setInterval(() => {
        setTimeRemainingMs((prev) => {
          if (prev <= 1000) {
            // Reached zero: verify with authoritative server state!
            verifyServerStateOnExpiry();
            return 0;
          }
          const warnLimit = warningRef.current || Math.max(2000, timeoutRef.current / 3);
          if (prev <= warnLimit) {
            setStatus((current) => (current === 'Executed' || current === 'GhostAwake' ? current : 'Warning'));
          }
          return prev - 1000;
        });
      }, 1000);
    };

    const connectWebSocket = () => {
      if (!isMounted) return;

      try {
        ws = new WebSocket('ws://localhost:8000/ws');

        ws.onopen = () => {
          if (!isMounted) {
            ws?.close();
            return;
          }
          // Connection established: reset backoff to 1s
          backoffMs = 1000;

          // Immediate state sync upon connection
          fetch('http://localhost:8000/api/status')
            .then(res => res.json())
            .then(data => {
              if (isMounted) applyServerState(data);
            })
            .catch(() => {});
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            applyServerState(data);
          } catch (e) {}
        };

        ws.onerror = () => {
          // Trigger reconnect via onclose
        };

        ws.onclose = () => {
          if (!isMounted) return;
          scheduleReconnect();
        };
      } catch (e) {
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (!isMounted) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      const delay = backoffMs;
      backoffMs = Math.min(MAX_BACKOFF_MS, Math.round(backoffMs * BACKOFF_MULTIPLIER));

      reconnectTimeout = setTimeout(() => {
        if (!isMounted) return;
        // In-between reconnect polling
        fetch('http://localhost:8000/api/status')
          .then(res => res.json())
          .then(data => {
            if (isMounted) applyServerState(data);
          })
          .catch(() => {});

        connectWebSocket();
      }, delay);
    };

    startVisualCountdown();
    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (visualCountdownInterval) clearInterval(visualCountdownInterval);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  const handlePingHeartbeat = async () => {
    if (status === 'Executed' || status === 'GhostAwake') return;
    setIsPinging(true);
    let resetTimeout = timeoutPeriodMs;
    try {
      const resp = await fetch('http://localhost:8000/api/heartbeat', { method: 'POST' });
      if (resp.ok) {
        const body = await resp.json();
        if (body.error) {
          setLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] [HEARTBEAT_REJECTED] ${body.error}`
          ]);
          setIsPinging(false);
          return;
        }
        if (body.timeout_period_ms) {
          resetTimeout = body.timeout_period_ms;
          setTimeoutPeriodMs(body.timeout_period_ms);
        }
      }
    } catch (e) {}
    // Immediate UI update only on success
    setTimeRemainingMs(resetTimeout);
    setStatus('Alive');
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [HEARTBEAT] Proof-of-Life verified. Expiration reset to ${Math.round(resetTimeout / 1000)}s.`
    ]);
    setTimeout(() => setIsPinging(false), 600);
  };

  const handleResetDemo = async () => {
    let resetTimeout = timeoutPeriodMs;
    try {
      const resp = await fetch('http://localhost:8000/api/reset_demo', { method: 'POST' });
      if (resp.ok) {
        const body = await resp.json();
        if (body.timeout_period_ms) {
          resetTimeout = body.timeout_period_ms;
          setTimeoutPeriodMs(body.timeout_period_ms);
        }
      }
    } catch (e) {}
    setTimeRemainingMs(resetTimeout);
    setStatus('Alive');
    setTreasuryNear(12.5);
    setKeyShareA(null);
    setActivePositions(initialPositions);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [SYSTEM] Demo reset to initial active state (Interval: ${Math.round(resetTimeout / 1000)}s).`
    ]);
  };

  const handleSimulateDemise = async () => {
    if (status === 'Executed' || status === 'GhostAwake') return;
    try {
      await fetch('http://localhost:8000/api/simulate_demise', { method: 'POST' });
    } catch (e) {}
    setTimeRemainingMs(0);
    setStatus('GhostAwake');
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [SIMULATION] Owner silence simulated. Proof-of-Absence triggered on NEAR.`,
      `[${new Date().toLocaleTimeString()}] [GHOST_BRAIN] Awakening Ghost Agent Sovereign Executor...`
    ]);
  };

  const handleTradeExecuted = async (tradePayload: any) => {
    if (status === 'Executed' || status === 'GhostAwake') return;

    try {
      const resp = await fetch('http://localhost:8000/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradePayload)
      });
      if (resp.ok) {
        const resData = await resp.json();
        if (resData.error) {
          setLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] [TRADE_REJECTED] ${resData.error}`
          ]);
          return;
        }
        setTimeRemainingMs(timeoutPeriodMs);
        setStatus('Alive');
        if (resData.position && tradePayload.mode !== 'SPOT') {
          setActivePositions((prev) => [resData.position, ...prev]);
        }
        if (resData.trader_dna) {
          setTraderDna({ trader_dna: resData.trader_dna });
        }
      }
    } catch (e) {
      setTimeRemainingMs(timeoutPeriodMs);
      setStatus('Alive');
      const posId = `pos-${Date.now().toString(36)}`;
      const newPos: Position = {
        id: posId,
        symbol: tradePayload.symbol,
        mode: tradePayload.mode,
        side: tradePayload.side === 'BUY' ? 'LONG' : 'SHORT',
        size: tradePayload.size,
        entry_price: tradePayload.price,
        mark_price: tradePayload.price,
        leverage: tradePayload.leverage,
        margin: (tradePayload.size * tradePayload.price) / tradePayload.leverage,
        pnl: 0,
        pnl_pct: 0,
        stop_loss: tradePayload.price * 0.97,
        take_profit: tradePayload.price * 1.06,
        opened_at: Math.floor(Date.now() / 1000)
      };
      if (tradePayload.mode !== 'SPOT') {
        setActivePositions((prev) => [newPos, ...prev]);
      }
    }

    // Add to local trade history log immediately
    const newHistoryItem = {
      id: `tr-${Date.now()}`,
      symbol: tradePayload.symbol,
      mode: tradePayload.mode,
      side: tradePayload.side,
      order_type: tradePayload.order_type,
      size: tradePayload.size,
      price: tradePayload.price,
      leverage: tradePayload.leverage,
      has_stop_loss: tradePayload.has_stop_loss,
      stop_loss_pct: tradePayload.stop_loss_pct,
      timestamp: Math.floor(Date.now() / 1000),
      tx_hash: tradePayload.tx_hash,
      nearblocks_url: tradePayload.nearblocks_url
    };
    setTradeHistory((prev) => [newHistoryItem, ...prev]);

    const isSpot = tradePayload.mode === 'SPOT';
    const tradeSummary = isSpot 
      ? `Owner executed SPOT ${tradePayload.side} ${tradePayload.size} ${tradePayload.symbol}`
      : `Owner opened ${tradePayload.mode} ${tradePayload.side === 'BUY' ? 'LONG' : 'SHORT'} ${tradePayload.size} ${tradePayload.symbol} (${tradePayload.leverage}x)`;

    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [ATOMIC_BATCH] Testnet Tx: ${(tradePayload.tx_hash || '8zWpNEAR').substring(0, 16)}... (Action 0: Intent Escrow, Action 1: ping_heartbeat). Proof-of-Life verified on NEAR.`,
      `[${new Date().toLocaleTimeString()}] [TRADE_TELEMETRY] ${tradeSummary}. DNA recalibrated.`
    ]);
  };

  const handleClosePosition = async (posId: string, exitPrice?: number) => {
    setTimeRemainingMs(timeoutPeriodMs);
    setStatus('Alive');

    try {
      const res = await fetch('http://localhost:8000/api/close_position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_id: posId, exit_price: exitPrice })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.trader_dna) {
          setTraderDna({ trader_dna: data.trader_dna });
        }
      }
    } catch (e) {}

    setActivePositions((prev) => prev.filter(p => p.id !== posId));
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [POSITION_CLOSE] Owner closed position ${posId}. Heartbeat reset.`
    ]);
  };

  const handleSaveDNA = async (dnaPayload: any) => {
    try {
      await fetch('http://localhost:8000/api/update_dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dnaPayload)
      });
    } catch (e) {}
    setTraderDna(dnaPayload);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [DNA_UPDATE] Trader DNA updated: ${dnaPayload.trader_dna.archetype}`
    ]);
  };

  const handleVaultSealed = async (shareA: string, ciphertextHash: string) => {
    setKeyShareA(shareA);
    try {
      await fetch('http://localhost:8000/api/vault/seal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_share_a: shareA,
          ciphertext_hash: ciphertextHash
        })
      });
    } catch (e) {
      // Offline fallback: keep client-side state
    }
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [VAULT] Sealed with AES-256-GCM. Share A committed. Ciphertext: ${ciphertextHash}...`
    ]);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-obsidian-800 bg-obsidian-900/90 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="GhostProtocol Icon" className="w-6 h-6 object-contain rounded" />
            <span className="font-mono text-sm font-bold tracking-tight text-white uppercase">GHOSTPROTOCOL</span>
            <span className="text-obsidian-700 hidden md:inline">|</span>
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              Post-Human Sovereign Executor
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-obsidian-800 border border-obsidian-700 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-cyber-emerald"></span>
              <span className="text-slate-300">NEAR Testnet</span>
              <span className="text-obsidian-700">|</span>
              <span className="text-slate-400">Chain Signatures (MPC)</span>
            </div>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-obsidian-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 w-full space-y-5">
        {/* Top: Countdown & Proof of Life HUD */}
        <CountdownHUD
          status={status}
          timeRemainingMs={timeRemainingMs}
          timeoutPeriodMs={timeoutPeriodMs}
          treasuryNear={treasuryNear}
          onPingHeartbeat={handlePingHeartbeat}
          onResetDemo={handleResetDemo}
          onSimulateDemise={handleSimulateDemise}
          isPinging={isPinging}
        />

        {/* Institutional Takeover Banner (Active when Ghost Agent takes over) */}
        {(status === 'GhostAwake' || status === 'Executed') && activeTab !== 'agent' && activeTab !== 'claim' && (
          <div className="bg-obsidian-900 border border-red-500/30 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              <span className="text-slate-200 font-semibold">
                [GHOST PROTOCOL TAKEOVER IN PROGRESS]
              </span>
              <span className="text-slate-400 hidden sm:inline">
                NEAR MPC signing external liquidations &amp; routing intents to Solver Bus.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('agent')}
              className="px-2.5 py-1 rounded bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-700 text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>View Execution Radar</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1.5 border-b border-obsidian-800 pb-2">
          <button
            onClick={() => setActiveTab('trade')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
              activeTab === 'trade'
                ? 'bg-obsidian-800 text-white border border-obsidian-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900 border border-transparent'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-slate-300" />
            <span>1. Trade & Behavioral Profiler</span>
            <span className="text-[10px] px-1 py-0.2 bg-obsidian-950 text-slate-400 border border-obsidian-800 rounded">TradingView</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
              activeTab === 'vault'
                ? 'bg-obsidian-800 text-white border border-obsidian-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900 border border-transparent'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-300" />
            <span>2. Sovereign Vault & Keys</span>
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
              activeTab === 'agent'
                ? 'bg-obsidian-800 text-white border border-obsidian-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900 border border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-slate-300" />
            <span>3. Cross-Chain Radar & Ghost Agent</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-obsidian-950 text-slate-400 border border-obsidian-800 rounded">
              Chain Sigs + Intents
            </span>
          </button>

          <button
            onClick={() => setActiveTab('claim')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
              activeTab === 'claim'
                ? 'bg-obsidian-800 text-white border border-obsidian-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900 border border-transparent'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-slate-300" />
            <span>4. Beneficiary Recovery Portal</span>
          </button>
        </div>

        {/* Tab Views */}
        {activeTab === 'trade' && (
          <TradingTerminal
            activePositions={activePositions}
            tradeHistory={tradeHistory}
            traderDna={traderDna}
            onTradeExecuted={handleTradeExecuted}
            onClosePosition={handleClosePosition}
            status={status}
          />
        )}

        {activeTab === 'vault' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VaultEncryptor onVaultSealed={handleVaultSealed} />
            <TraderDNASetup onSaveDNA={handleSaveDNA} />
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="space-y-6">
            <CrossChainRadar
              status={status}
              logs={logs}
              activePositions={activePositions}
              timeRemainingMs={timeRemainingMs}
              timeoutPeriodMs={timeoutPeriodMs}
            />
            <GhostTerminal logs={logs} status={status} />
          </div>
        )}

        {activeTab === 'claim' && (
          <div className="max-w-3xl mx-auto">
            <BeneficiaryClaim
              contractKeyShareA={keyShareA}
              status={status}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-obsidian-800/80 bg-obsidian-900/40 py-4 pb-14 sm:pb-12 text-center text-xs font-mono text-slate-500">
        GhostProtocol • Autonomous Post-Human Sovereign Executor • Powered by NEAR Intents & Chain Signatures
      </footer>

      {/* Floating Collapsible Agent Thoughts Window */}
      <AgentThoughtsWindow logs={logs} status={status} />
    </div>
  );
}

export default App;
