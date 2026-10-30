import React, { useState, useEffect } from 'react';
import { Shield, Cpu, Terminal, KeyRound, Radio, ExternalLink, RefreshCw, BarChart2 } from 'lucide-react';
import { CountdownHUD } from './components/CountdownHUD';
import { TraderDNASetup } from './components/TraderDNASetup';
import { VaultEncryptor } from './components/VaultEncryptor';
import { GhostTerminal } from './components/GhostTerminal';
import { BeneficiaryClaim } from './components/BeneficiaryClaim';
import { TradingTerminal, Position } from './components/TradingTerminal';

const initialPositions: Position[] = [
  {
    id: "pos-near-01",
    symbol: "NEAR/USDC",
    mode: "PERP",
    side: "LONG",
    size: 500.0,
    entry_price: 5.15,
    mark_price: 5.24,
    leverage: 3.0,
    margin: 858.33,
    pnl: 45.00,
    pnl_pct: 5.24,
    stop_loss: 4.98,
    take_profit: 5.80,
    opened_at: Math.floor(Date.now() / 1000) - 3600
  },
  {
    id: "pos-eth-02",
    symbol: "ETH/USDC",
    mode: "PERP",
    side: "LONG",
    size: 1.5,
    entry_price: 3120.00,
    mark_price: 3154.50,
    leverage: 2.0,
    margin: 2340.00,
    pnl: 51.75,
    pnl_pct: 2.21,
    stop_loss: 3020.00,
    take_profit: 3350.00,
    opened_at: Math.floor(Date.now() / 1000) - 7200
  }
];

export function App() {
  const [activeTab, setActiveTab] = useState<'trade' | 'vault' | 'agent' | 'claim'>('trade');
  const [status, setStatus] = useState<string>('Alive');
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(15000);
  const [timeoutPeriodMs, setTimeoutPeriodMs] = useState<number>(15000);
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
    "[10:30:01] [STATE] Owner proof-of-life status: ALIVE. Countdown: 15s.",
    "[10:30:02] [DNA_MIMIC] Loaded Owner Trader DNA: Patience-Disciplined Swing Hedger.",
    "[10:30:02] [AI_ENGINE] Connected to OpenRouter :: Model: inclusionai/ling-3.0-flash.",
    "[10:30:03] [TELEGRAM] Telegram heartbeat userbot armed. Ready for pings."
  ]);
  const [isPinging, setIsPinging] = useState(false);

  // WebSocket / Polling bridge to Python Backend
  useEffect(() => {
    let ws: WebSocket | null = null;
    let fallbackInterval: any = null;

    try {
      ws = new WebSocket('ws://localhost:8000/ws');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStatus(data.status);
          setTimeRemainingMs(data.time_remaining_ms);
          setTimeoutPeriodMs(data.timeout_period_ms);
          setTreasuryNear(data.treasury_near);
          if (data.key_share_a) setKeyShareA(data.key_share_a);
          if (data.active_positions) setActivePositions(data.active_positions);
          if (data.trade_history) setTradeHistory(data.trade_history);
          if (data.trader_dna) setTraderDna(data.trader_dna);
          if (data.logs && data.logs.length > 0) {
            setLogs(data.logs);
          }
        } catch (e) {}
      };
      ws.onerror = () => {
        startFallbackTimer();
      };
    } catch (e) {
      startFallbackTimer();
    }

    function startFallbackTimer() {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        setTimeRemainingMs((prev) => {
          if (prev <= 1000) {
            setStatus('GhostAwake');
            setKeyShareA('SHARE_A_SEC_98a7cf28b');
            return 0;
          }
          if (prev <= 5000) {
            setStatus('Warning');
          }
          return prev - 1000;
        });
      }, 1000);
    }

    return () => {
      if (ws) ws.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  const handlePingHeartbeat = async () => {
    setIsPinging(true);
    try {
      await fetch('http://localhost:8000/api/heartbeat', { method: 'POST' });
    } catch (e) {}
    // Immediate UI update
    setTimeRemainingMs(15000);
    setStatus('Alive');
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [HEARTBEAT] Proof-of-Life verified. Expiration reset to 15s.`
    ]);
    setTimeout(() => setIsPinging(false), 600);
  };

  const handleResetDemo = async () => {
    try {
      await fetch('http://localhost:8000/api/reset_demo', { method: 'POST' });
    } catch (e) {}
    setTimeRemainingMs(15000);
    setStatus('Alive');
    setTreasuryNear(12.5);
    setKeyShareA(null);
    setActivePositions(initialPositions);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [SYSTEM] Demo reset to initial active state with default positions.`
    ]);
  };

  const handleTradeExecuted = async (tradePayload: any) => {
    setTimeRemainingMs(15000);
    setStatus('Alive');

    try {
      const resp = await fetch('http://localhost:8000/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradePayload)
      });
      if (resp.ok) {
        const resData = await resp.json();
        if (resData.position && tradePayload.mode !== 'SPOT') {
          setActivePositions((prev) => [resData.position, ...prev]);
        }
        if (resData.trader_dna) {
          setTraderDna({ trader_dna: resData.trader_dna });
        }
      }
    } catch (e) {
      // Optimistic fallback if backend is offline
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

    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [TRADE_TELEMETRY] Owner opened ${tradePayload.mode} ${tradePayload.side} ${tradePayload.size} ${tradePayload.symbol} (${tradePayload.leverage}x). Proof-of-Life verified on NEAR.`
    ]);
  };

  const handleClosePosition = async (posId: string) => {
    setTimeRemainingMs(15000);
    setStatus('Alive');

    try {
      await fetch('http://localhost:8000/api/close_position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_id: posId })
      });
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

  const handleVaultSealed = (shareA: string, ciphertextHash: string) => {
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [VAULT] Sealed with AES-256-GCM. Share A committed. Ciphertext: ${ciphertextHash}...`
    ]);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 flex flex-col font-sans">
      {/* Cyberpunk Header */}
      <header className="border-b border-obsidian-800 bg-obsidian-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-scarlet-500/10 border border-scarlet-500/30 flex items-center justify-center text-scarlet-500 shadow-scarlet-glow">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold tracking-tight text-white">GHOSTPROTOCOL</span>
                <span className="text-[10px] font-mono uppercase bg-scarlet-500/20 text-scarlet-400 border border-scarlet-500/30 px-2 py-0.5 rounded-full font-bold">
                  NEAR Track 13
                </span>
              </div>
              <span className="text-[10px] text-slate-400 tracking-wider font-mono block">
                Post-Human Sovereign Executor • Living Behavioral Twin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-obsidian-800/80 border border-obsidian-700 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-cyber-emerald animate-ping"></span>
              <span className="text-slate-300">NEAR Testnet</span>
              <span className="text-obsidian-700">|</span>
              <span className="text-cyber-cyan">Chain Signatures (MPC)</span>
            </div>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-obsidian-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-5">
        {/* Top: Countdown & Proof of Life HUD */}
        <CountdownHUD
          status={status}
          timeRemainingMs={timeRemainingMs}
          timeoutPeriodMs={timeoutPeriodMs}
          treasuryNear={treasuryNear}
          onPingHeartbeat={handlePingHeartbeat}
          onResetDemo={handleResetDemo}
          isPinging={isPinging}
        />

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-obsidian-800 pb-2">
          <button
            onClick={() => setActiveTab('trade')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
              activeTab === 'trade'
                ? 'bg-obsidian-800 text-white border border-scarlet-500/50 shadow-scarlet-glow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-scarlet-400" />
            <span>1. Trade & Behavioral Profiler</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-cyber-emerald/20 text-cyber-emerald rounded">Live TV</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
              activeTab === 'vault'
                ? 'bg-obsidian-800 text-white border border-scarlet-500/50 shadow-scarlet-glow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>2. Sovereign Vault & Keys</span>
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
              activeTab === 'agent'
                ? 'bg-obsidian-800 text-white border border-scarlet-500/50 shadow-scarlet-glow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>3. Ghost Agent Combat Feed</span>
          </button>

          <button
            onClick={() => setActiveTab('claim')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
              activeTab === 'claim'
                ? 'bg-obsidian-800 text-white border border-scarlet-500/50 shadow-scarlet-glow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-cyber-emerald" />
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
      <footer className="border-t border-obsidian-800/80 bg-obsidian-900/40 py-4 text-center text-xs font-mono text-slate-500">
        GhostProtocol • Autonomous Post-Human Sovereign Executor • Powered by NEAR Intents & Chain Signatures
      </footer>
    </div>
  );
}

export default App;
