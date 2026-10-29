import React, { useState, useEffect, useRef } from 'react';
import { Shield, Cpu, Terminal, KeyRound, Radio, ExternalLink, RefreshCw } from 'lucide-react';
import { CountdownHUD } from './components/CountdownHUD';
import { TraderDNASetup } from './components/TraderDNASetup';
import { VaultEncryptor } from './components/VaultEncryptor';
import { GhostTerminal } from './components/GhostTerminal';
import { BeneficiaryClaim } from './components/BeneficiaryClaim';

export function App() {
  const [activeTab, setActiveTab] = useState<'vault' | 'agent' | 'claim'>('vault');
  const [status, setStatus] = useState<string>('Alive');
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(15000);
  const [timeoutPeriodMs, setTimeoutPeriodMs] = useState<number>(15000);
  const [treasuryNear, setTreasuryNear] = useState<number>(12.5);
  const [keyShareA, setKeyShareA] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[10:30:00] [WATCHMAN] GhostProtocol Watchman initialized on NEAR Testnet.",
    "[10:30:01] [STATE] Owner proof-of-life status: ALIVE. Countdown: 15s.",
    "[10:30:02] [DNA_MIMIC] Loaded Owner Trader DNA: Patience-Disciplined Swing Hedger.",
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
          if (data.logs && data.logs.length > 0) {
            setLogs(data.logs);
          }
        } catch (e) {}
      };
      ws.onerror = () => {
        // Fallback to client-side timer if Python daemon not active
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
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [SYSTEM] Demo reset to initial active state.`
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
                Post-Human Sovereign Executor
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
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
        <div className="flex gap-2 border-b border-obsidian-800 pb-2">
          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
              activeTab === 'vault'
                ? 'bg-obsidian-800 text-white border border-scarlet-500/50 shadow-scarlet-glow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-scarlet-400" />
            <span>1. Sovereign Vault & DNA</span>
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
              activeTab === 'agent'
                ? 'bg-obsidian-800 text-white border border-scarlet-500/50 shadow-scarlet-glow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>2. Ghost Agent Combat Feed</span>
          </button>

          <button
            onClick={() => setActiveTab('claim')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
              activeTab === 'claim'
                ? 'bg-obsidian-800 text-white border border-scarlet-500/50 shadow-scarlet-glow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>3. Beneficiary Recovery Portal</span>
          </button>
        </div>

        {/* Tab Views */}
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
