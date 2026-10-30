import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, Sliders, Shield, Zap, Activity, 
  Clock, ArrowUpRight, ArrowDownRight, Layers, Target, AlertTriangle, 
  CheckCircle2, XCircle, Info, RefreshCw
} from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';

export interface Position {
  id: string;
  symbol: string;
  mode: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entry_price: number;
  mark_price: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnl_pct: number;
  stop_loss?: number;
  take_profit?: number;
  opened_at: number;
}

interface TradingTerminalProps {
  activePositions: Position[];
  tradeHistory: any[];
  traderDna: any;
  onTradeExecuted: (tradeData: any) => Promise<void>;
  onClosePosition: (positionId: string) => Promise<void>;
  status: string;
}

const TRADING_PAIRS = [
  { id: 'NEAR/USDC', tvSymbol: 'BINANCE:NEARUSDT', price: 5.24, change24h: '+4.18%', high: 5.42, low: 4.96, funding: '-0.0152%', oi: '$48.2M' },
  { id: 'BTC/USDT', tvSymbol: 'BINANCE:BTCUSDT', price: 68450.00, change24h: '+1.62%', high: 69120.00, low: 67200.00, funding: '+0.0084%', oi: '$840.5M' },
  { id: 'ETH/USDC', tvSymbol: 'BINANCE:ETHUSDT', price: 3154.50, change24h: '+2.45%', high: 3210.00, low: 3080.00, funding: '-0.0120%', oi: '$312.4M' },
  { id: 'SOL/USDC', tvSymbol: 'BINANCE:SOLUSDT', price: 182.20, change24h: '-0.85%', high: 188.40, low: 179.10, funding: '+0.0051%', oi: '$194.8M' },
];

export const TradingTerminal: React.FC<TradingTerminalProps> = ({
  activePositions,
  tradeHistory,
  traderDna,
  onTradeExecuted,
  onClosePosition,
  status
}) => {
  const [selectedPair, setSelectedPair] = useState(TRADING_PAIRS[0]);
  const [tradingMode, setTradingMode] = useState<'PERP' | 'SPOT' | 'FUTURES'>('PERP');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'TWAP'>('LIMIT');
  
  // Order Parameters
  const [leverage, setLeverage] = useState(3);
  const [marginMode, setMarginMode] = useState<'Cross' | 'Isolated'>('Cross');
  const [futuresExpiry, setFuturesExpiry] = useState('DEC-26 Quarterly');
  const [priceInput, setPriceInput] = useState(selectedPair.price.toString());
  const [sizeInput, setSizeInput] = useState('100');
  const [hasStopLoss, setHasStopLoss] = useState(true);
  const [stopLossPct, setStopLossPct] = useState('3.0');
  const [takeProfitPct, setTakeProfitPct] = useState('6.0');
  
  // UI Subtab below chart
  const [activeSubTab, setActiveSubTab] = useState<'positions' | 'telemetry' | 'history'>('positions');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Sync price when pair changes
  const handlePairChange = (pair: typeof TRADING_PAIRS[0]) => {
    setSelectedPair(pair);
    setPriceInput(pair.price.toString());
  };

  const handlePercentageClick = (pct: number) => {
    const calculatedSize = ((1000 * pct) / (parseFloat(priceInput) || selectedPair.price)).toFixed(2);
    setSizeInput(calculatedSize);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'Executed') return;

    setIsSubmitting(true);
    try {
      const orderPrice = orderType === 'MARKET' ? selectedPair.price : (parseFloat(priceInput) || selectedPair.price);
      const orderSize = parseFloat(sizeInput) || 10;
      
      const tradePayload = {
        symbol: selectedPair.id,
        mode: tradingMode,
        side: orderSide,
        order_type: orderType,
        size: orderSize,
        price: orderPrice,
        leverage: tradingMode === 'SPOT' ? 1.0 : leverage,
        has_stop_loss: hasStopLoss,
        stop_loss_pct: parseFloat(stopLossPct) || 2.5,
        take_profit_pct: parseFloat(takeProfitPct) || 5.0,
      };

      await onTradeExecuted(tradePayload);
    } catch (err) {
      console.error("Order submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async (posId: string) => {
    setClosingId(posId);
    try {
      await onClosePosition(posId);
    } catch (err) {
      console.error("Close position failed:", err);
    } finally {
      setClosingId(null);
    }
  };

  // Calculations
  const currentPrice = parseFloat(priceInput) || selectedPair.price;
  const currentSize = parseFloat(sizeInput) || 0;
  const orderValue = currentSize * currentPrice;
  const requiredMargin = tradingMode === 'SPOT' ? orderValue : (orderValue / (leverage || 1));
  const estLiqPrice = tradingMode === 'SPOT' ? 0 : (
    orderSide === 'BUY'
      ? Math.max(0, currentPrice * (1 - (0.9 / leverage)))
      : currentPrice * (1 + (0.9 / leverage))
  );

  const dna = traderDna?.trader_dna || {};
  const telemetry = dna.telemetry || {};
  const risk = dna.risk_vector || {};

  return (
    <div className="space-y-4">
      {/* Top Header Bar: Pair Selector & Live 24h Ticker Stats */}
      <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
        {/* Pair Pills */}
        <div className="flex items-center gap-1.5">
          {TRADING_PAIRS.map((pair) => (
            <button
              key={pair.id}
              onClick={() => handlePairChange(pair)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                selectedPair.id === pair.id
                  ? 'bg-obsidian-800 text-white border border-obsidian-700'
                  : 'bg-transparent text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              {pair.id}
            </button>
          ))}
        </div>

        {/* Live Ticker Stats */}
        <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Mark Price</span>
            <span className="text-white font-bold text-sm">${selectedPair.price.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">24h Change</span>
            <span className={`font-bold flex items-center gap-0.5 ${selectedPair.change24h.startsWith('+') ? 'text-cyber-emerald' : 'text-scarlet-400'}`}>
              {selectedPair.change24h.startsWith('+') ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {selectedPair.change24h}
            </span>
          </div>
          <div className="hidden sm:block">
            <span className="text-[10px] text-slate-500 uppercase block">24h High / Low</span>
            <span className="text-slate-300">${selectedPair.high} / ${selectedPair.low}</span>
          </div>
          <div className="hidden md:block">
            <span className="text-[10px] text-slate-500 uppercase block">Funding (8h)</span>
            <span className="text-cyber-cyan">{selectedPair.funding}</span>
          </div>
          <div className="hidden lg:block">
            <span className="text-[10px] text-slate-500 uppercase block">Open Interest</span>
            <span className="text-purple-400">{selectedPair.oi}</span>
          </div>
        </div>

        {/* Trading Mode Switcher */}
        <div className="flex bg-obsidian-950 p-1 rounded-xl border border-obsidian-800 text-xs font-mono">
          {(['PERP', 'SPOT', 'FUTURES'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTradingMode(mode)}
              className={`px-3 py-1 rounded-lg transition-all ${
                tradingMode === mode
                  ? 'bg-obsidian-800 text-white font-bold border border-obsidian-700 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Left Chart & Telemetry (65%), Right Order Form (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN (Chart & Bottom Tabs) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* TradingView Chart Container */}
          <div className="h-[460px] w-full rounded-xl overflow-hidden border border-obsidian-800 bg-obsidian-950">
            <TradingViewChart tvSymbol={selectedPair.tvSymbol} theme="dark" />
          </div>

          {/* Bottom Tabs: Positions vs Trader DNA Telemetry vs History */}
          <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-4">
            <div className="flex items-center justify-between border-b border-obsidian-800 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveSubTab('positions')}
                  className={`text-xs font-mono font-bold flex items-center gap-1.5 pb-1 border-b-2 transition-all ${
                    activeSubTab === 'positions'
                      ? 'border-scarlet-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-scarlet-400" />
                  <span>Active Positions ({activePositions.length})</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('telemetry')}
                  className={`text-xs font-mono font-bold flex items-center gap-1.5 pb-1 border-b-2 transition-all ${
                    activeSubTab === 'telemetry'
                      ? 'border-sky-400 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <span>Behavioral DNA Telemetry</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </button>

                <button
                  onClick={() => setActiveSubTab('history')}
                  className={`text-xs font-mono font-bold flex items-center gap-1.5 pb-1 border-b-2 transition-all ${
                    activeSubTab === 'history'
                      ? 'border-purple-400 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Order Log ({tradeHistory.length})</span>
                </button>
              </div>

              <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                Proof-of-Life: Auto-ping on trade
              </span>
            </div>

            {/* TAB 1: ACTIVE POSITIONS */}
            {activeSubTab === 'positions' && (
              <div className="overflow-x-auto">
                {activePositions.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs font-mono">
                    No active positions open. Place a Perp, Spot, or Futures trade on the right.
                  </div>
                ) : (
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-obsidian-800/80 pb-2">
                        <th className="pb-2 font-normal">MARKET</th>
                        <th className="pb-2 font-normal">SIDE</th>
                        <th className="pb-2 font-normal">SIZE</th>
                        <th className="pb-2 font-normal">ENTRY / MARK</th>
                        <th className="pb-2 font-normal">MARGIN</th>
                        <th className="pb-2 font-normal">PNL</th>
                        <th className="pb-2 font-normal">SL / TP</th>
                        <th className="pb-2 font-normal text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian-800/50">
                      {activePositions.map((pos) => {
                        const isProfit = pos.pnl >= 0;
                        return (
                          <tr key={pos.id} className="hover:bg-obsidian-800/30 transition-colors">
                            <td className="py-3">
                              <span className="font-bold text-white block">{pos.symbol}</span>
                              <span className="text-[10px] text-slate-500">{pos.mode} • {pos.leverage}x</span>
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                pos.side === 'LONG'
                                  ? 'bg-cyber-emerald/10 text-cyber-emerald border border-cyber-emerald/30'
                                  : 'bg-scarlet-500/10 text-scarlet-400 border border-scarlet-500/30'
                              }`}>
                                {pos.side}
                              </span>
                            </td>
                            <td className="py-3 text-slate-200">
                              {pos.size} {pos.symbol.split('/')[0]}
                            </td>
                            <td className="py-3">
                              <span className="text-slate-300 block">${pos.entry_price.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-500">${pos.mark_price.toFixed(2)}</span>
                            </td>
                            <td className="py-3 text-slate-300">
                              ${pos.margin.toFixed(2)}
                            </td>
                            <td className="py-3">
                              <span className={`font-bold block ${isProfit ? 'text-cyber-emerald' : 'text-scarlet-400'}`}>
                                {isProfit ? '+' : ''}${pos.pnl.toFixed(2)}
                              </span>
                              <span className={`text-[10px] ${isProfit ? 'text-cyber-emerald' : 'text-scarlet-400'}`}>
                                ({isProfit ? '+' : ''}{pos.pnl_pct.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="py-3 text-[11px] text-slate-400">
                              <div>SL: <span className="text-scarlet-400">${pos.stop_loss || 'None'}</span></div>
                              <div>TP: <span className="text-cyber-emerald">${pos.take_profit || 'None'}</span></div>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleClose(pos.id)}
                                disabled={closingId === pos.id || status === 'Executed'}
                                className="px-3 py-1 bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 hover:text-white rounded-lg border border-obsidian-700 text-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {closingId === pos.id ? 'Closing...' : 'Close'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB 2: BEHAVIORAL DNA TELEMETRY */}
            {activeSubTab === 'telemetry' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-obsidian-950/80 border border-cyber-cyan/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyber-cyan/10 text-cyber-cyan">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">Detected Living Persona</span>
                      <h4 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                        {dna.archetype || 'Patience-Disciplined Swing Hedger'}
                      </h4>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-cyber-emerald bg-cyber-emerald/10 border border-cyber-emerald/30 px-3 py-1 rounded-full">
                    LIVE CALIBRATED
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800">
                    <span className="text-[10px] text-slate-500 block mb-1">TOTAL TRADES</span>
                    <span className="text-base font-bold text-white">{telemetry.total_trades_recorded || tradeHistory.length}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">telemetry samples</span>
                  </div>

                  <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800">
                    <span className="text-[10px] text-slate-500 block mb-1">PATIENCE SCORE</span>
                    <span className="text-base font-bold text-cyber-emerald">
                      {Math.round((risk.patience_score || 0.85) * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Limit/TWAP ratio</span>
                  </div>

                  <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800">
                    <span className="text-[10px] text-slate-500 block mb-1">STOP-LOSS ADHERENCE</span>
                    <span className="text-base font-bold text-cyber-cyan">
                      {telemetry.stop_loss_adherence_pct || 90}%
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">discipline rating</span>
                  </div>

                  <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800">
                    <span className="text-[10px] text-slate-500 block mb-1">AVERAGE LEVERAGE</span>
                    <span className="text-base font-bold text-cyber-amber">
                      {telemetry.avg_leverage || leverage}x
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">appetite vector</span>
                  </div>
                </div>

                {/* Behavioral Tenets */}
                <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 text-xs font-mono">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2 font-bold">
                    Extracted Behavioral Tenets (Applied by Ghost Agent on Takeover):
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {(dna.personal_tenets || [
                      "Never market-sell into an oversold RSI (< 28).",
                      "Always execute unwinds via TWAP batches across 3 intervals.",
                      "Consolidate all peripheral LPs into USDC via NEAR Intents."
                    ]).map((tenet: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-scarlet-400 font-bold">›</span>
                        <span>{tenet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 3: ORDER HISTORY */}
            {activeSubTab === 'history' && (
              <div className="overflow-x-auto">
                {tradeHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs font-mono">
                    No trade telemetry recorded yet.
                  </div>
                ) : (
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-obsidian-800 pb-2">
                        <th className="pb-2 font-normal">TIME</th>
                        <th className="pb-2 font-normal">MARKET</th>
                        <th className="pb-2 font-normal">MODE / TYPE</th>
                        <th className="pb-2 font-normal">SIDE</th>
                        <th className="pb-2 font-normal">PRICE</th>
                        <th className="pb-2 font-normal">SIZE</th>
                        <th className="pb-2 font-normal">SL / TP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian-800/40">
                      {tradeHistory.map((tr, i) => (
                        <tr key={i} className="hover:bg-obsidian-800/30">
                          <td className="py-2.5 text-slate-400">
                            {new Date(tr.timestamp * 1000).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 text-white font-bold">{tr.symbol}</td>
                          <td className="py-2.5 text-slate-300">{tr.mode} • {tr.order_type}</td>
                          <td className="py-2.5">
                            <span className={tr.side === 'BUY' ? 'text-cyber-emerald' : 'text-scarlet-400'}>
                              {tr.side}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-300">${tr.price}</td>
                          <td className="py-2.5 text-slate-300">{tr.size}</td>
                          <td className="py-2.5 text-slate-400">
                            {tr.has_stop_loss ? `${tr.stop_loss_pct}% SL` : 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (Order Placement Form) */}
        <div className="lg:col-span-4">
          <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-4 sticky top-16">
            
            {/* Long / Short Action Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setOrderSide('BUY')}
                className={`py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-500 text-black'
                    : 'bg-obsidian-800 text-slate-400 hover:text-white border border-obsidian-700'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>BUY / LONG</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderSide('SELL')}
                className={`py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  orderSide === 'SELL'
                    ? 'bg-red-600 text-white'
                    : 'bg-obsidian-800 text-slate-400 hover:text-white border border-obsidian-700'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>SELL / SHORT</span>
              </button>
            </div>

            {/* Order Type Toggle */}
            <div className="flex bg-obsidian-950 p-1 rounded-xl border border-obsidian-800 mb-4 text-xs font-mono">
              {(['LIMIT', 'MARKET', 'TWAP'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    orderType === type
                      ? 'bg-obsidian-800 text-white font-bold border border-obsidian-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmitOrder} className="space-y-4">
              {/* Leverage Selector (for PERP & FUTURES) */}
              {tradingMode !== 'SPOT' && (
                <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800">
                  <div className="flex justify-between items-center text-xs font-mono mb-2">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-scarlet-400" />
                      Leverage & Margin
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMarginMode(marginMode === 'Cross' ? 'Isolated' : 'Cross')}
                        className="text-[10px] text-cyber-cyan border border-cyber-cyan/30 px-1.5 py-0.5 rounded"
                      >
                        {marginMode}
                      </button>
                      <span className="font-bold text-scarlet-400">{leverage}x</span>
                    </div>
                  </div>

                  <div className="flex gap-1.5 mb-2">
                    {[1, 2, 3, 5, 10, 20].map((lev) => (
                      <button
                        key={lev}
                        type="button"
                        onClick={() => setLeverage(lev)}
                        className={`flex-1 py-1 text-[11px] font-mono rounded border transition-all ${
                          leverage === lev
                            ? 'bg-scarlet-500/20 border-scarlet-500 text-white font-bold'
                            : 'border-obsidian-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>

                  {leverage >= 10 && (
                    <div className="flex items-center gap-1 text-[10px] text-cyber-amber font-mono">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>High leverage flags aggressive risk telemetry in Trader DNA.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Futures Expiry (if FUTURES mode) */}
              {tradingMode === 'FUTURES' && (
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">
                    FUTURES CONTRACT EXPIRY
                  </label>
                  <select
                    value={futuresExpiry}
                    onChange={(e) => setFuturesExpiry(e.target.value)}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-scarlet-500"
                  >
                    <option value="DEC-26 Quarterly">DEC-26 Quarterly (Basis +0.32%)</option>
                    <option value="MAR-27 Quarterly">MAR-27 Quarterly (Basis +0.68%)</option>
                  </select>
                </div>
              )}

              {/* Price Input (if LIMIT or TWAP) */}
              {orderType !== 'MARKET' ? (
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>LIMIT PRICE</span>
                    <button
                      type="button"
                      onClick={() => setPriceInput(selectedPair.price.toString())}
                      className="text-cyber-cyan hover:underline"
                    >
                      Use Mark (${selectedPair.price})
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-scarlet-500"
                  />
                </div>
              ) : (
                <div className="bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-800 text-xs font-mono flex justify-between">
                  <span className="text-slate-400">EXECUTION PRICE</span>
                  <span className="text-white font-bold">Market (~${selectedPair.price})</span>
                </div>
              )}

              {/* Size Input */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>ORDER SIZE ({selectedPair.id.split('/')[0]})</span>
                  <span className="text-slate-300">Val: ${orderValue.toFixed(2)}</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-scarlet-500"
                />

                {/* Percentage Pills */}
                <div className="flex gap-2 mt-2">
                  {[0.25, 0.50, 0.75, 1.0].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePercentageClick(p)}
                      className="flex-1 py-1 text-[10px] font-mono rounded bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 border border-obsidian-700"
                    >
                      {p * 100}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Stop Loss & Take Profit Settings */}
              <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={hasStopLoss}
                      onChange={(e) => setHasStopLoss(e.target.checked)}
                      className="rounded accent-scarlet-500"
                    />
                    <span>Attach Stop Loss / Take Profit</span>
                  </label>
                  <span className="text-[10px] text-cyber-emerald font-bold">DNA Discipline Factor</span>
                </div>

                {hasStopLoss && (
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">STOP LOSS %</span>
                      <input
                        type="number"
                        step="0.5"
                        value={stopLossPct}
                        onChange={(e) => setStopLossPct(e.target.value)}
                        className="w-full bg-obsidian-900 border border-obsidian-700 rounded-lg px-2.5 py-1 text-xs text-scarlet-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">TAKE PROFIT %</span>
                      <input
                        type="number"
                        step="0.5"
                        value={takeProfitPct}
                        onChange={(e) => setTakeProfitPct(e.target.value)}
                        className="w-full bg-obsidian-900 border border-obsidian-700 rounded-lg px-2.5 py-1 text-xs text-cyber-emerald focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Stats */}
              <div className="text-xs font-mono space-y-1.5 text-slate-400 border-t border-obsidian-800 pt-3">
                <div className="flex justify-between">
                  <span>Margin Required</span>
                  <span className="text-white font-bold">${requiredMargin.toFixed(2)}</span>
                </div>
                {tradingMode !== 'SPOT' && (
                  <div className="flex justify-between">
                    <span>Est. Liquidation Price</span>
                    <span className="text-scarlet-400">${estLiqPrice.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Settlement Rail</span>
                  <span className="text-cyber-cyan">NEAR Intents + MPC</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || status === 'Executed'}
                className={`w-full py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {isSubmitting ? 'Recording Trade & Pinging NEAR...' : (
                  orderSide === 'BUY'
                    ? `Open ${tradingMode} Long ${selectedPair.id.split('/')[0]}`
                    : `Open ${tradingMode} Short ${selectedPair.id.split('/')[0]}`
                )}
              </button>

              {/* Proof of Life Live Reminder */}
              <div className="flex items-start gap-2 text-[11px] font-mono text-slate-400 bg-obsidian-950/60 p-2.5 rounded-xl border border-obsidian-800/60">
                <Shield className="w-4 h-4 text-cyber-emerald flex-shrink-0 mt-0.5" />
                <span>
                  Placing an order triggers a signed <code className="text-cyber-cyan">ping_heartbeat()</code> on NEAR and recalibrates your Living Behavioral Twin.
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
