import React, { useState, useRef, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Sliders, Shield, Zap, Activity, 
  Clock, ArrowUpRight, ArrowDownRight, Layers, Target, AlertTriangle, 
  CheckCircle2, XCircle, Info, RefreshCw, ChevronDown, Search, Check, Coins,
  Fuel, ExternalLink, Key, Copy, Sparkles, Wallet
} from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';
import { 
  getOrCreateSessionAccount, 
  saveCustomAccount, 
  fetchLiveNearBalance, 
  requestTestnetFaucet, 
  executeAtomicBatchTrade, 
  resetSessionAccount,
  adjustLocalSessionBalance,
  setLocalSessionBalance,
  TESTNET_CONFIG 
} from '../lib/nearTestnet';
import {
  startLivePriceTicker,
  calculatePositionPnL,
  checkSLTPTrigger,
  INITIAL_PRICES
} from '../lib/priceFeed';

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
  tx_hash?: string;
  nearblocks_url?: string;
}

export interface SpotAsset {
  symbol: string;
  name: string;
  category: 'Native NEP-141' | 'Chain Signatures (MPC)' | 'NEAR Intents' | 'Settlement Stable';
  balance: number;
  contractId: string;
  change24h: string;
  iconBg: string;
  iconColor: string;
}

export const DEFAULT_SPOT_ASSETS: SpotAsset[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin (Settlement)',
    category: 'Settlement Stable',
    balance: 5000.00,
    contractId: 'usdc.fakes.testnet',
    change24h: '0.00%',
    iconBg: 'bg-blue-500/10 border-blue-500/30',
    iconColor: 'text-blue-400'
  },
  {
    symbol: 'NEAR',
    name: 'NEAR Protocol',
    category: 'Native NEP-141',
    balance: 145.80,
    contractId: 'wrap.testnet',
    change24h: '+4.18%',
    iconBg: 'bg-emerald-500/10 border-emerald-500/30',
    iconColor: 'text-emerald-400'
  },
  {
    symbol: 'AURORA',
    name: 'Aurora EVM Engine',
    category: 'Native NEP-141',
    balance: 1200.00,
    contractId: 'aurora.testnet',
    change24h: '+1.85%',
    iconBg: 'bg-emerald-500/10 border-emerald-500/30',
    iconColor: 'text-emerald-300'
  },
  {
    symbol: 'REF',
    name: 'Ref Finance DEX',
    category: 'Native NEP-141',
    balance: 650.00,
    contractId: 'ref.fakes.testnet',
    change24h: '+7.42%',
    iconBg: 'bg-cyan-500/10 border-cyan-500/30',
    iconColor: 'text-cyan-400'
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    category: 'Chain Signatures (MPC)',
    balance: 3.50,
    contractId: 'v1.signer (Ed25519)',
    change24h: '-0.85%',
    iconBg: 'bg-purple-500/10 border-purple-500/30',
    iconColor: 'text-purple-400'
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    category: 'Chain Signatures (MPC)',
    balance: 0.045,
    contractId: 'v1.signer (Secp256k1)',
    change24h: '+1.62%',
    iconBg: 'bg-amber-500/10 border-amber-500/30',
    iconColor: 'text-amber-400'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    category: 'NEAR Intents',
    balance: 0.75,
    contractId: 'solver-relay.testnet',
    change24h: '+2.45%',
    iconBg: 'bg-sky-500/10 border-sky-500/30',
    iconColor: 'text-sky-400'
  }
];

export const getSpotAssetPrice = (symbol: string, prices: Record<string, number>): number => {
  if (symbol === 'USDC' || symbol === 'USDT') return 1.0;
  if (prices[`${symbol}/USDC`]) return prices[`${symbol}/USDC`];
  if (prices[`${symbol}/USDT`]) return prices[`${symbol}/USDT`];
  if (prices[`${symbol}/NEAR`]) {
    const nearUsdc = prices['NEAR/USDC'] ?? 5.24;
    return prices[`${symbol}/NEAR`] * nearUsdc;
  }
  const fallbacks: Record<string, number> = {
    'NEAR': 5.24,
    'BTC': 68450.00,
    'ETH': 3154.50,
    'SOL': 182.20,
    'DOGE': 0.165,
    'XRP': 0.548,
    'ARB': 0.582,
    'REF': 0.185,
    'AURORA': 0.142,
    'SWEAT': 0.0078
  };
  return fallbacks[symbol] ?? 1.0;
};

export interface TradingPair {
  id: string;
  name: string;
  tvSymbol: string;
  price: number;
  change24h: string;
  high: number;
  low: number;
  funding: string;
  oi: string;
  category: 'Native NEP-141' | 'Chain Signatures (MPC)' | 'NEAR Intents';
  nearTestnetContract: string;
}

interface TradingTerminalProps {
  activePositions: Position[];
  tradeHistory: any[];
  traderDna: any;
  onTradeExecuted: (tradeData: any) => Promise<void>;
  onClosePosition: (positionId: string, exitPrice?: number) => Promise<void>;
  status: string;
}

const TRADING_PAIRS: TradingPair[] = [
  // 1. Native NEAR & NEP-141 Ecosystem (NEAR Testnet)
  {
    id: 'NEAR/USDC',
    name: 'NEAR Protocol',
    tvSymbol: 'BINANCE:NEARUSDT',
    price: 5.24,
    change24h: '+4.18%',
    high: 5.42,
    low: 4.96,
    funding: '-0.0152%',
    oi: '$48.2M',
    category: 'Native NEP-141',
    nearTestnetContract: 'wrap.testnet / usdc.fakes.testnet'
  },
  {
    id: 'REF/USDC',
    name: 'Ref Finance',
    tvSymbol: 'MEXC:REFUSDT',
    price: 0.185,
    change24h: '+7.42%',
    high: 0.198,
    low: 0.171,
    funding: '-0.0080%',
    oi: '$3.8M',
    category: 'Native NEP-141',
    nearTestnetContract: 'ref.fakes.testnet'
  },
  {
    id: 'AURORA/USDC',
    name: 'Aurora EVM Engine',
    tvSymbol: 'COINBASE:AURORAUSD',
    price: 0.142,
    change24h: '+1.85%',
    high: 0.150,
    low: 0.138,
    funding: '+0.0020%',
    oi: '$2.1M',
    category: 'Native NEP-141',
    nearTestnetContract: 'aurora.testnet'
  },
  {
    id: 'SWEAT/USDC',
    name: 'Sweat Economy',
    tvSymbol: 'BYBIT:SWEATUSDT',
    price: 0.0078,
    change24h: '-1.12%',
    high: 0.0082,
    low: 0.0075,
    funding: '+0.0015%',
    oi: '$4.5M',
    category: 'Native NEP-141',
    nearTestnetContract: 'token.sweat.testnet'
  },
  {
    id: 'LONK/NEAR',
    name: 'Lonk Meme',
    tvSymbol: 'BINANCE:NEARUSDT',
    price: 0.0000042,
    change24h: '+14.6%',
    high: 0.0000048,
    low: 0.0000037,
    funding: '0.0000%',
    oi: '$1.2M',
    category: 'Native NEP-141',
    nearTestnetContract: 'lonk.testnet'
  },
  {
    id: 'BLACKDRAGON/NEAR',
    name: 'Black Dragon',
    tvSymbol: 'BINANCE:NEARUSDT',
    price: 0.000085,
    change24h: '+9.3%',
    high: 0.000092,
    low: 0.000078,
    funding: '0.0000%',
    oi: '$890K',
    category: 'Native NEP-141',
    nearTestnetContract: 'blackdragon.testnet'
  },

  // 2. Multi-Chain Assets via NEAR Chain Signatures (v1.signer MPC)
  {
    id: 'BTC/USDT',
    name: 'Bitcoin (MPC)',
    tvSymbol: 'BINANCE:BTCUSDT',
    price: 68450.00,
    change24h: '+1.62%',
    high: 69120.00,
    low: 67200.00,
    funding: '+0.0084%',
    oi: '$840.5M',
    category: 'Chain Signatures (MPC)',
    nearTestnetContract: 'v1.signer (Root Secp256k1 MPC)'
  },
  {
    id: 'SOL/USDC',
    name: 'Solana (MPC)',
    tvSymbol: 'BINANCE:SOLUSDT',
    price: 182.20,
    change24h: '-0.85%',
    high: 188.40,
    low: 179.10,
    funding: '+0.0051%',
    oi: '$194.8M',
    category: 'Chain Signatures (MPC)',
    nearTestnetContract: 'v1.signer (Ed25519 MPC Curve)'
  },
  {
    id: 'DOGE/USDC',
    name: 'Dogecoin (MPC)',
    tvSymbol: 'BINANCE:DOGEUSDT',
    price: 0.165,
    change24h: '+3.14%',
    high: 0.172,
    low: 0.158,
    funding: '+0.0090%',
    oi: '$55.1M',
    category: 'Chain Signatures (MPC)',
    nearTestnetContract: 'v1.signer (UTXO Derivation)'
  },
  {
    id: 'XRP/USDC',
    name: 'XRP Ledger (MPC)',
    tvSymbol: 'BINANCE:XRPUSDT',
    price: 0.548,
    change24h: '+0.95%',
    high: 0.562,
    low: 0.539,
    funding: '-0.0045%',
    oi: '$68.2M',
    category: 'Chain Signatures (MPC)',
    nearTestnetContract: 'v1.signer (XRPL Secp256k1)'
  },

  // 3. Cross-Chain via NEAR Intents (Solver Bus NEP-413)
  {
    id: 'ETH/USDC',
    name: 'Ethereum (Rainbow/Intents)',
    tvSymbol: 'BINANCE:ETHUSDT',
    price: 3154.50,
    change24h: '+2.45%',
    high: 3210.00,
    low: 3080.00,
    funding: '-0.0120%',
    oi: '$312.4M',
    category: 'NEAR Intents',
    nearTestnetContract: 'solver-relay.testnet'
  },
  {
    id: 'ARB/USDC',
    name: 'Arbitrum (NEAR Intents)',
    tvSymbol: 'BINANCE:ARBUSDT',
    price: 0.562,
    change24h: '+5.20%',
    high: 0.585,
    low: 0.530,
    funding: '-0.0095%',
    oi: '$24.6M',
    category: 'NEAR Intents',
    nearTestnetContract: 'solver-relay.testnet'
  }
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
  const [activeSubTab, setActiveSubTab] = useState<'positions' | 'spot' | 'telemetry' | 'history'>('positions');
  const [spotAssets, setSpotAssets] = useState<SpotAsset[]>(DEFAULT_SPOT_ASSETS);
  const [spotFilter, setSpotFilter] = useState<'ALL' | 'NEP-141' | 'MPC' | 'INTENTS'>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Live Crypto Price Feed & Direction State
  const [livePrices, setLivePrices] = useState<Record<string, number>>(INITIAL_PRICES);
  const [priceDirections, setPriceDirections] = useState<Record<string, 'UP' | 'DOWN' | 'SAME'>>({});
  const [autoTriggeredNotice, setAutoTriggeredNotice] = useState<{
    posId: string;
    type: 'SL' | 'TP';
    symbol: string;
    price: number;
  } | null>(null);

  // Near Testnet Session & Live Balance State
  const [testnetAccount, setTestnetAccount] = useState<{
    accountId: string;
    publicKey: string;
    secretKey: string;
  }>(getOrCreateSessionAccount());
  const [liveNearBalance, setLiveNearBalance] = useState<string>('25.00');
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [isFundingFaucet, setIsFundingFaucet] = useState(false);
  const [faucetNotification, setFaucetNotification] = useState<{
    message: string;
    amount: string;
    txHash?: string;
    nearblocksUrl?: string;
  } | null>(null);
  const [faucetTimerProgress, setFaucetTimerProgress] = useState(100);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [customAccountInput, setCustomAccountInput] = useState('');
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [keyImportError, setKeyImportError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [lastAtomicTx, setLastAtomicTx] = useState<{
    txHash: string;
    nearblocksUrl: string;
    intentId: string;
    actionsExecuted: string[];
  } | null>(null);

  // Refresh live NEAR testnet balance
  const refreshBalance = async (accId = testnetAccount.accountId) => {
    setIsRefreshingBalance(true);
    try {
      const bal = await fetchLiveNearBalance(accId);
      setLiveNearBalance(bal);
    } catch (e) {
      // keep fallback
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  useEffect(() => {
    refreshBalance(testnetAccount.accountId);
  }, [testnetAccount.accountId]);

  // Handle Cool Testnet Faucet Fueling
  const handleFaucetRequest = async () => {
    setIsFundingFaucet(true);
    setFaucetNotification(null);
    try {
      const res = await requestTestnetFaucet(testnetAccount.accountId);
      
      setFaucetNotification({
        message: res.message,
        amount: res.amount || '+10.00 NEAR',
        txHash: res.txHash,
        nearblocksUrl: res.nearblocksUrl
      });
      setFaucetTimerProgress(100);

      // Optimistically update live NEAR balance immediately
      const newBal = adjustLocalSessionBalance(testnetAccount.accountId, 10.0);
      setLiveNearBalance(newBal);

      // Re-query real on-chain balance from NEAR RPC after testnet tx confirms
      setTimeout(async () => {
        await refreshBalance(testnetAccount.accountId);
      }, 1500);

      // Optimistically boost visible spot assets while RPC catches up
      setSpotAssets(prev => prev.map(a => a.symbol === 'NEAR' ? { ...a, balance: parseFloat((a.balance + 10.0).toFixed(2)) } : a));
    } catch (e) {
      console.error("Faucet request error:", e);
    } finally {
      setIsFundingFaucet(false);
    }
  };

  // 5-second countdown timer for the native faucet notification
  useEffect(() => {
    if (!faucetNotification) return;
    const startTime = Date.now();
    const duration = 5000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / duration) * 100);
      setFaucetTimerProgress(remainingPct);
      if (elapsed >= duration) {
        setFaucetNotification(null);
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [faucetNotification]);

  // Copy Public Key to Clipboard
  const handleCopyPublicKey = () => {
    navigator.clipboard.writeText(testnetAccount.publicKey);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Import Custom Testnet Account & Key
  const handleSaveCustomAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyImportError(null);
    if (!customAccountInput.trim() || !customKeyInput.trim()) {
      setKeyImportError("Both Account ID and Private Key are required.");
      return;
    }

    const success = saveCustomAccount(customAccountInput, customKeyInput);
    if (success) {
      const updated = getOrCreateSessionAccount();
      setTestnetAccount(updated);
      setIsAccountModalOpen(false);
      setCustomAccountInput('');
      setCustomKeyInput('');
      refreshBalance(updated.accountId);
    } else {
      setKeyImportError("Invalid Ed25519 NEAR private key format.");
    }
  };

  // Reset to fresh Session Key
  const handleResetSession = () => {
    const fresh = resetSessionAccount();
    setTestnetAccount(fresh);
    setIsAccountModalOpen(false);
    refreshBalance(fresh.accountId);
  };

  // Pair Dropdown States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside listener for pair dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter pairs
  const filteredPairs = TRADING_PAIRS.filter((pair) => {
    const matchesSearch = 
      pair.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pair.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pair.nearTestnetContract.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = 
      selectedCategory === 'ALL' ||
      (selectedCategory === 'NEP-141' && pair.category === 'Native NEP-141') ||
      (selectedCategory === 'MPC Signer' && pair.category === 'Chain Signatures (MPC)') ||
      (selectedCategory === 'Intents' && pair.category === 'NEAR Intents');

    return matchesSearch && matchesCategory;
  });

  // Sync price when pair changes
  const handlePairChange = (pair: typeof TRADING_PAIRS[0]) => {
    setSelectedPair(pair);
    setPriceInput(pair.price.toString());
  };

  // Split selected pair into Base and Quote assets
  const [baseSymbol, quoteSymbolRaw] = selectedPair.id.split('/');
  const quoteSymbol = quoteSymbolRaw === 'USDT' ? 'USDC' : quoteSymbolRaw;

  // Available asset balances for current market pair
  const quoteAsset = spotAssets.find(a => a.symbol === 'USDC' || a.symbol === quoteSymbol);
  const availableQuoteBalance = quoteAsset ? quoteAsset.balance : 0;
  const baseAsset = spotAssets.find(a => a.symbol === baseSymbol);
  const availableBaseBalance = baseAsset 
    ? baseAsset.balance 
    : (baseSymbol === 'NEAR' ? (parseFloat(liveNearBalance) || 0) : 0);

  // Dynamic order price and sizing
  const currentPrice = parseFloat(priceInput) || selectedPair.price;
  const currentSize = parseFloat(sizeInput) || 0;
  const orderValue = currentSize * currentPrice;
  const requiredMargin = tradingMode === 'SPOT' ? orderValue : (orderValue / (leverage || 1));
  const estLiqPrice = tradingMode === 'SPOT' ? 0 : (
    orderSide === 'BUY'
      ? Math.max(0, currentPrice * (1 - (0.9 / leverage)))
      : currentPrice * (1 + (0.9 / leverage))
  );

  // Institutional order validation guard: ensure balance coherence between Spot and Margin modes
  const getOrderValidationError = (): string | null => {
    if (isNaN(currentSize) || currentSize <= 0) {
      return 'Enter an order size greater than 0';
    }
    if (isNaN(currentPrice) || currentPrice <= 0) {
      return 'Enter a valid order price';
    }

    if (tradingMode === 'SPOT') {
      if (orderSide === 'BUY') {
        if (orderValue > availableQuoteBalance) {
          return `Insufficient USDC balance: requires $${orderValue.toFixed(2)}, available $${availableQuoteBalance.toFixed(2)}`;
        }
      } else {
        if (currentSize > availableBaseBalance) {
          return `Insufficient ${baseSymbol} balance: requires ${currentSize} ${baseSymbol}, available ${availableBaseBalance >= 1 ? availableBaseBalance.toFixed(2) : availableBaseBalance.toFixed(4)} ${baseSymbol}`;
        }
      }
    } else {
      // Margin mode (PERP / FUTURES)
      if (requiredMargin > availableQuoteBalance) {
        return `Insufficient USDC margin collateral: requires $${requiredMargin.toFixed(2)}, available $${availableQuoteBalance.toFixed(2)}`;
      }
      if (leverage > 20) {
        return 'Leverage exceeds maximum allowed terminal cap of 20x';
      }
    }
    return null;
  };

  const orderValidationError = getOrderValidationError();

  const handlePercentageClick = (pct: number) => {
    const price = parseFloat(priceInput) || selectedPair.price;
    if (price <= 0) return;

    if (tradingMode === 'SPOT') {
      if (orderSide === 'BUY') {
        const maxUnits = availableQuoteBalance / price;
        const target = maxUnits * pct;
        setSizeInput(target >= 1 ? target.toFixed(2) : target.toFixed(4));
      } else {
        const target = availableBaseBalance * pct;
        setSizeInput(target >= 1 ? target.toFixed(2) : target.toFixed(4));
      }
    } else {
      // PERP or FUTURES: max order value = availableQuoteBalance * leverage
      const maxOrderVal = availableQuoteBalance * (leverage || 1);
      const maxUnits = maxOrderVal / price;
      const target = maxUnits * pct;
      setSizeInput(target >= 1 ? target.toFixed(2) : target.toFixed(4));
    }
  };

  const handleQuickSpotTrade = (symbol: string, side: 'BUY' | 'SELL') => {
    if (status === 'Executed' || status === 'GhostAwake') return;
    let pair = TRADING_PAIRS.find(p => p.id === `${symbol}/USDC` || p.id === `${symbol}/USDT` || p.id === `${symbol}/NEAR`);
    if (!pair) {
      pair = TRADING_PAIRS.find(p => p.id.startsWith(`${symbol}/`));
    }
    if (pair) {
      setSelectedPair(pair);
      setPriceInput((livePrices[pair.id] ?? pair.price).toString());
      setTradingMode('SPOT');
      setOrderSide(side);
      const held = spotAssets.find(a => a.symbol === symbol)?.balance ?? 0;
      if (side === 'SELL') {
        const defaultSell = held > 0 ? (held >= 10 ? '10' : held.toString()) : '5';
        setSizeInput(defaultSell);
      } else {
        setSizeInput('10');
      }
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'Executed' || status === 'GhostAwake') return;
    if (orderValidationError) return;

    setIsSubmitting(true);
    try {
      const orderPrice = orderType === 'MARKET' ? selectedPair.price : (parseFloat(priceInput) || selectedPair.price);
      const orderSize = parseFloat(sizeInput) || 10;
      
      // 1. Build & Execute Real Atomic Batched Transaction on NEAR Testnet
      const atomicResult = await executeAtomicBatchTrade({
        symbol: selectedPair.id,
        side: orderSide,
        mode: tradingMode,
        size: orderSize,
        price: orderPrice,
        leverage: tradingMode === 'SPOT' ? 1.0 : leverage,
        orderType: orderType
      });

      setLastAtomicTx(atomicResult);

      // 2. Submit trade with real On-Chain Tx Hash & NearBlocks explorer link
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
        tx_hash: atomicResult.txHash,
        nearblocks_url: atomicResult.nearblocksUrl
      };

      await onTradeExecuted(tradePayload);

      // 3. Reactively update Spot balances if trade was in SPOT mode
      if (tradingMode === 'SPOT') {
        const [baseSym, quoteSym] = selectedPair.id.split('/');
        const currentOrderVal = orderSize * orderPrice;
        setSpotAssets(prevAssets => {
          const next = [...prevAssets];
          const quoteIndex = next.findIndex(a => a.symbol === (quoteSym === 'USDT' ? 'USDT' : 'USDC') || a.symbol === quoteSym);
          const baseIndex = next.findIndex(a => a.symbol === baseSym);
          
          if (orderSide === 'BUY') {
            if (quoteIndex >= 0) {
              next[quoteIndex] = {
                ...next[quoteIndex],
                balance: Math.max(0, parseFloat((next[quoteIndex].balance - currentOrderVal).toFixed(4)))
              };
            }
            if (baseIndex >= 0) {
              next[baseIndex] = {
                ...next[baseIndex],
                balance: parseFloat((next[baseIndex].balance + orderSize).toFixed(4))
              };
            } else {
              next.push({
                symbol: baseSym,
                name: selectedPair.name,
                category: selectedPair.category as any,
                balance: orderSize,
                contractId: selectedPair.nearTestnetContract,
                change24h: selectedPair.change24h,
                iconBg: 'bg-cyber-cyan/10 border-cyber-cyan/30',
                iconColor: 'text-cyber-cyan'
              });
            }
          } else {
            if (baseIndex >= 0) {
              next[baseIndex] = {
                ...next[baseIndex],
                balance: Math.max(0, parseFloat((next[baseIndex].balance - orderSize).toFixed(4)))
              };
            }
            if (quoteIndex >= 0) {
              next[quoteIndex] = {
                ...next[quoteIndex],
                balance: parseFloat((next[quoteIndex].balance + currentOrderVal).toFixed(4))
              };
            } else {
              next.push({
                symbol: quoteSym,
                name: `${quoteSym} Settlement`,
                category: 'Settlement Stable',
                balance: currentOrderVal,
                contractId: 'usdc.fakes.testnet',
                change24h: '0.00%',
                iconBg: 'bg-blue-500/10 border-blue-500/30',
                iconColor: 'text-blue-400'
              });
            }
          }
          return next;
        });
      }

      // If the trade involves NEAR as the base asset, adjust live NEAR balance
      const [baseAssetSymbol] = selectedPair.id.split('/');
      if (baseAssetSymbol === 'NEAR') {
        const delta = orderSide === 'BUY' ? orderSize : -orderSize;
        const updatedBal = adjustLocalSessionBalance(testnetAccount.accountId, delta);
        setLiveNearBalance(updatedBal);
      }

      refreshBalance(testnetAccount.accountId);
    } catch (err) {
      console.error("Order submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Concurrency Guard: prevent duplicate/rapid-fire SL/TP trigger loops on rapid price ticks
  const triggeredPositionsRef = useRef<Set<string>>(new Set());
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize triggeredPositionsRef with activePositions to prune closed positions
  useEffect(() => {
    const activeIds = new Set(activePositions.map((p) => p.id));
    for (const id of Array.from(triggeredPositionsRef.current)) {
      if (!activeIds.has(id)) {
        triggeredPositionsRef.current.delete(id);
      }
    }
  }, [activePositions]);

  const handleClose = async (posId: string, exitPrice?: number) => {
    setClosingId(posId);
    try {
      await onClosePosition(posId, exitPrice);
    } catch (err) {
      console.error("Close position failed:", err);
      // In case of close failure, remove from triggered set so it can retry
      triggeredPositionsRef.current.delete(posId);
    } finally {
      setClosingId(null);
    }
  };

  // Stable references for ticker loop to prevent subscription churn & re-render loops
  const activePositionsRef = useRef(activePositions);
  activePositionsRef.current = activePositions;
  const statusRef = useRef(status);
  statusRef.current = status;
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  // Real-Time Price Streamer & SL/TP Auto-Trigger Watcher with Clean Subscription Teardown
  useEffect(() => {
    const cleanup = startLivePriceTicker((prices, directions) => {
      setLivePrices(prices);
      setPriceDirections(directions);

      // Evaluate active positions for real-time SL / TP triggers with concurrency guard
      activePositionsRef.current.forEach((pos) => {
        // Concurrency guard: check if this position is already being triggered
        if (triggeredPositionsRef.current.has(pos.id)) {
          return;
        }

        const currentStatus = statusRef.current;
        if (currentStatus === 'Executed' || currentStatus === 'GhostAwake') {
          return;
        }

        const mark = prices[pos.symbol] ?? pos.mark_price ?? pos.entry_price;
        const trigger = checkSLTPTrigger(pos, mark);
        if (trigger.triggered) {
          // Atomically mark triggered before launching async close
          triggeredPositionsRef.current.add(pos.id);

          setAutoTriggeredNotice({
            posId: pos.id,
            type: trigger.type!,
            symbol: pos.symbol,
            price: trigger.triggerPrice!
          });

          if (noticeTimeoutRef.current) {
            clearTimeout(noticeTimeoutRef.current);
          }
          noticeTimeoutRef.current = setTimeout(() => {
            setAutoTriggeredNotice(null);
          }, 5000);

          handleCloseRef.current(pos.id, trigger.triggerPrice).catch((err) => {
            console.error("Auto SL/TP trigger execution error:", err);
            triggeredPositionsRef.current.delete(pos.id);
          });
        }
      });
    }, 1000);

    return () => {
      cleanup();
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  // Spot Portfolio Calculations
  const spotCalculations = spotAssets.map(asset => {
    const price = getSpotAssetPrice(asset.symbol, livePrices);
    const value = asset.balance * price;
    const tickDir = priceDirections[`${asset.symbol}/USDC`] || priceDirections[`${asset.symbol}/USDT`] || 'SAME';
    return {
      ...asset,
      currentPrice: price,
      usdValue: value,
      tickDir
    };
  });

  const totalSpotPortfolioValue = spotCalculations.reduce((acc, curr) => acc + curr.usdValue, 0);
  const liquidUsdcReserve = spotCalculations.find(a => a.symbol === 'USDC')?.usdValue ?? 0;
  const nonUsdcHoldingsValue = totalSpotPortfolioValue - liquidUsdcReserve;
  const activeTokenCount = spotAssets.filter(a => a.balance > 0).length;

  const filteredSpotAssets = spotCalculations.filter(asset => {
    if (spotFilter === 'ALL') return true;
    if (spotFilter === 'NEP-141') return asset.category === 'Native NEP-141';
    if (spotFilter === 'MPC') return asset.category === 'Chain Signatures (MPC)';
    if (spotFilter === 'INTENTS') return asset.category === 'NEAR Intents';
    return true;
  });

  const dna = traderDna?.trader_dna || {};
  const patterns = dna.trading_patterns || {
    execution_style: 'LIMIT_DISCIPLINED',
    time_horizon: 'SWING_TRADER (1h-24h)',
    limit_order_ratio_pct: 80.0,
    perp_ratio_pct: 65.0,
    spot_ratio_pct: 25.0,
    futures_ratio_pct: 10.0
  };
  const risk = dna.risk_tolerance || dna.risk_vector || {
    drawdown_tolerance: 0.35,
    volatility_affinity: 0.65,
    leverage_appetite: 0.25,
    patience_score: 0.88
  };
  const leveragePrefs = dna.leverage_preferences || {
    avg_leverage: 2.5,
    max_recorded_leverage: 3.0,
    leverage_discipline_grade: 'A (CONSERVATIVE)'
  };
  const stopLoss = dna.stop_loss_habits || {
    stop_loss_adherence_pct: 92.0,
    avg_stop_loss_pct: 3.2,
    hard_stop_enforcement: true
  };
  const profitTaking = dna.profit_taking_behavior || {
    realized_rr_ratio: 2.15,
    tp_target_adherence_pct: 85.0,
    profit_harvest_style: 'SCALE_OUT_TWAP',
    avg_take_profit_pct: 6.2,
    win_rate_pct: 66.7
  };
  const decisionTendencies = dna.decision_making_tendencies || {
    dip_buyer_vs_breakout_score: 0.82,
    panic_dump_resilience: 0.94,
    funding_rate_tolerance: 'DEFENSIVE_HEDGER',
    decision_speed: 'DELIBERATE (LIMIT_PLACED)'
  };
  const telemetry = dna.telemetry || {
    total_trades_recorded: tradeHistory.length,
    total_positions_closed: 0,
    avg_leverage: leveragePrefs.avg_leverage || 2.5,
    realized_rr_ratio: profitTaking.realized_rr_ratio || 2.15,
    panic_dump_resilience: decisionTendencies.panic_dump_resilience || 0.94,
    dip_buyer_score: decisionTendencies.dip_buyer_vs_breakout_score || 0.82,
    profit_harvest_style: profitTaking.profit_harvest_style || 'SCALE_OUT_TWAP',
    stop_loss_adherence_pct: stopLoss.stop_loss_adherence_pct || 92.0,
  };

  return (
    <div className="space-y-4">
      {/* REAL NEAR TESTNET HYBRID DESK HUD */}
      <div className="bg-obsidian-950/90 border border-obsidian-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Left: Account Identity & Session Signer Status */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-obsidian-900 border border-obsidian-800 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-cyber-emerald"></span>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase leading-none">Hybrid Testnet Signer</span>
              <span className="text-white font-bold text-xs">{testnetAccount.accountId}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              title="Manage Testnet Keys / Switch Account"
              className="ml-1 p-1 hover:bg-obsidian-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live Balance Pill */}
          <div className="flex items-center gap-2 bg-obsidian-900 border border-obsidian-800 px-3 py-1.5 rounded-lg">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase leading-none">Live Testnet Balance</span>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold text-xs">{liveNearBalance} NEAR</span>
                <span className="text-[10px] text-slate-400">≈ ${(parseFloat(liveNearBalance) * (livePrices['NEAR/USDC'] ?? 5.24)).toFixed(2)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshBalance()}
              disabled={isRefreshingBalance}
              title="Refresh Balance from RPC"
              className="p-1 hover:bg-obsidian-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Right: The Cool Faucet Button & Network Pill */}
        <div className="flex items-center gap-3">
          {/* Cool Testnet Faucet Button */}
          <button
            type="button"
            onClick={handleFaucetRequest}
            disabled={isFundingFaucet}
            className="group relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-obsidian-900 hover:bg-obsidian-850 border border-obsidian-700 hover:border-cyber-emerald/50 text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Request 10 Testnet NEAR from Testnet Faucet"
          >
            <Fuel className={`w-3.5 h-3.5 text-cyber-emerald transition-transform group-hover:scale-110 ${isFundingFaucet ? 'animate-spin' : ''}`} />
            <span className="font-mono text-xs font-medium">
              {isFundingFaucet ? 'Relaying Gas...' : 'Fund via Testnet Faucet'}
            </span>
            <span className="text-[10px] font-mono text-cyber-emerald bg-cyber-emerald/10 border border-cyber-emerald/30 px-1.5 py-0.2 rounded font-bold">
              +10 NEAR
            </span>
          </button>

          <div className="hidden md:flex items-center gap-1.5 text-[10px] text-slate-400 bg-obsidian-900 px-2.5 py-1 rounded-lg border border-obsidian-800">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan"></span>
            <span>rpc.testnet.near.org</span>
          </div>
        </div>
      </div>

      {/* Confirmation Banner for Atomic Batch Execution */}
      {lastAtomicTx && (
        <div className="p-3 bg-obsidian-950 border border-cyber-cyan/40 rounded-xl flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-cyber-cyan shrink-0" />
            <div>
              <span className="text-white font-bold block">
                Atomic Batch Execution Confirmed on NEAR Testnet
              </span>
              <span className="text-[11px] text-slate-400">
                Action 0: NEP-413 Intent Swap Escrow • Action 1: FunctionCall ghostprotocol.testnet::ping_heartbeat()
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={lastAtomicTx.nearblocksUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/30 text-cyber-cyan font-bold transition-colors cursor-pointer"
            >
              <span>NearBlocks ↗</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={() => setLastAtomicTx(null)}
              className="text-slate-500 hover:text-white text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 5-Second Native Designed Faucet Transaction Popup Notification (Top Overlay with 10px margin-top) */}
      {faucetNotification && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 mt-[10px] z-50 w-[95%] max-w-2xl overflow-hidden p-3.5 bg-obsidian-950/95 border border-cyber-emerald/50 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyber-emerald/15 border border-cyber-emerald/40 flex items-center justify-center shrink-0 text-cyber-emerald shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              <Fuel className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-[13px]">{faucetNotification.message}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyber-emerald/20 text-cyber-emerald font-bold border border-cyber-emerald/40">
                  {faucetNotification.amount}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>NEAR Testnet Registrar Action Confirmed</span>
                {faucetNotification.txHash && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 font-mono">
                      Tx: {faucetNotification.txHash.length > 16 
                        ? `${faucetNotification.txHash.slice(0, 8)}...${faucetNotification.txHash.slice(-8)}`
                        : faucetNotification.txHash}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
            {faucetNotification.nearblocksUrl ? (
              <a
                href={faucetNotification.nearblocksUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyber-emerald/15 hover:bg-cyber-emerald/25 border border-cyber-emerald/40 text-cyber-emerald font-bold transition-all cursor-pointer shadow-sm text-[11px] hover:scale-102"
              >
                <span>NearBlocks ↗</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => setFaucetNotification(null)}
              className="p-1 hover:bg-obsidian-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              title="Dismiss"
            >
              ✕
            </button>
          </div>

          {/* 5-Second Animated Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-obsidian-800">
            <div 
              className="h-full bg-gradient-to-r from-cyber-emerald to-cyber-cyan transition-all duration-75"
              style={{ width: `${faucetTimerProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Account & Session Key Management Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-obsidian-900 border border-obsidian-700 rounded-xl max-w-md w-full p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-obsidian-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Key className="w-4 h-4 text-cyber-cyan" />
                <span>NEAR Testnet Hybrid Signer</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Session Info */}
            <div className="space-y-2 bg-obsidian-950 p-3 rounded-lg border border-obsidian-800">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Active Testnet Account</span>
                <span className="text-white font-bold">{testnetAccount.accountId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Ed25519 Public Key</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-[11px] text-slate-300 truncate max-w-[280px]">{testnetAccount.publicKey}</span>
                  <button
                    type="button"
                    onClick={handleCopyPublicKey}
                    className="p-1 hover:bg-obsidian-800 rounded text-slate-400 hover:text-white cursor-pointer"
                    title="Copy Public Key"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5 text-cyber-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Import Custom Account */}
            <form onSubmit={handleSaveCustomAccount} className="space-y-3 pt-2 border-t border-obsidian-800">
              <span className="text-[11px] text-slate-300 font-bold block">Import Custom .testnet Key:</span>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">NEAR Testnet Account ID</label>
                <input
                  type="text"
                  value={customAccountInput}
                  onChange={(e) => setCustomAccountInput(e.target.value)}
                  placeholder="e.g. alice.testnet"
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Ed25519 Private Key</label>
                <input
                  type="password"
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  placeholder="ed25519:..."
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {keyImportError && (
                <div className="text-[10px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{keyImportError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetSession}
                  className="text-[10px] text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Generate Fresh Burner
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded transition-colors cursor-pointer"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Header Bar: Pair Selector & Live 24h Ticker Stats */}
      <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
        {/* Pair Dropdown Menu (NEAR Testnet Compatible Tokens) */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 bg-obsidian-950 border border-obsidian-700 hover:border-zinc-500 rounded-lg px-3 py-1.5 transition-colors cursor-pointer text-left"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-white tracking-wide">
                  {selectedPair.id}
                </span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-obsidian-800 text-slate-400 border border-obsidian-700">
                  {selectedPair.nearTestnetContract.split(' ')[0]}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedPair.name}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Panel */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 bg-obsidian-900 border border-obsidian-700 rounded-xl z-50 p-2.5 space-y-2">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search token or NEAR testnet contract..."
                  className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-zinc-500"
                  autoFocus
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-mono">
                {['ALL', 'NEP-141', 'MPC Signer', 'Intents'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Token List */}
              <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-obsidian-800/40">
                {filteredPairs.length === 0 ? (
                  <div className="text-center py-4 text-xs font-mono text-slate-500">
                    No matching NEAR testnet tokens found.
                  </div>
                ) : (
                  filteredPairs.map((pair) => (
                    <div
                      key={pair.id}
                      onClick={() => {
                        handlePairChange(pair);
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedPair.id === pair.id
                          ? 'bg-obsidian-800 text-white'
                          : 'hover:bg-obsidian-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-white">{pair.id}</span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-obsidian-950 text-slate-400 border border-obsidian-800">
                            {pair.category.includes('NEP-141') ? 'NEP-141' : pair.category.includes('MPC') ? 'Chain Sig' : 'Intent'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <span>{pair.name}</span>
                          <span className="text-obsidian-700">•</span>
                          <span className="text-slate-500 truncate max-w-[130px]">{pair.nearTestnetContract}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs">
                        <span className="block font-medium text-white">
                          ${(livePrices[pair.id] ?? pair.price) >= 1 ? (livePrices[pair.id] ?? pair.price).toLocaleString() : (livePrices[pair.id] ?? pair.price)}
                        </span>
                        <span className={`text-[10px] ${pair.change24h.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pair.change24h}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Ticker Stats */}
        <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Mark Price</span>
            <span className={`font-bold text-sm flex items-center gap-1 transition-colors ${
              priceDirections[selectedPair.id] === 'UP' ? 'text-cyber-emerald' : priceDirections[selectedPair.id] === 'DOWN' ? 'text-scarlet-400' : 'text-white'
            }`}>
              ${(livePrices[selectedPair.id] ?? selectedPair.price) >= 1 ? (livePrices[selectedPair.id] ?? selectedPair.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (livePrices[selectedPair.id] ?? selectedPair.price)}
              {priceDirections[selectedPair.id] === 'UP' && <ArrowUpRight className="w-3.5 h-3.5 text-cyber-emerald" />}
              {priceDirections[selectedPair.id] === 'DOWN' && <ArrowDownRight className="w-3.5 h-3.5 text-scarlet-400" />}
            </span>
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
          {tradingMode === 'SPOT' ? (
            <>
              <div className="hidden md:block">
                <span className="text-[10px] text-slate-500 uppercase block">Settlement Type</span>
                <span className="text-cyber-emerald font-semibold">Spot Swap (1x)</span>
              </div>
              <div className="hidden lg:block">
                <span className="text-[10px] text-slate-500 uppercase block">Execution Rail</span>
                <span className="text-cyber-cyan font-semibold">NEP-141 / Intents</span>
              </div>
            </>
          ) : (
            <>
              <div className="hidden md:block">
                <span className="text-[10px] text-slate-500 uppercase block">Funding (8h)</span>
                <span className="text-cyber-cyan">{selectedPair.funding}</span>
              </div>
              <div className="hidden lg:block">
                <span className="text-[10px] text-slate-500 uppercase block">Open Interest</span>
                <span className="text-purple-400">{selectedPair.oi}</span>
              </div>
            </>
          )}
        </div>

        {/* Trading Mode Switcher */}
        <div className="flex bg-obsidian-950 p-1 rounded-xl border border-obsidian-800 text-xs font-mono">
          {(['PERP', 'SPOT', 'FUTURES'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setTradingMode(mode);
                if (mode === 'SPOT') {
                  setActiveSubTab('spot');
                } else if (activeSubTab === 'spot') {
                  setActiveSubTab('positions');
                }
              }}
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

          {/* Bottom Tabs: Positions vs Spot Assets vs Trader DNA Telemetry vs History */}
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
                  onClick={() => setActiveSubTab('spot')}
                  className={`text-xs font-mono font-bold flex items-center gap-1.5 pb-1 border-b-2 transition-all ${
                    activeSubTab === 'spot'
                      ? 'border-cyber-emerald text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-cyber-emerald" />
                  <span>Spot Assets ({spotAssets.filter(a => a.balance > 0).length})</span>
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
                {activeSubTab === 'spot' ? 'Settlement Rails: NEP-141 • Chain Signatures MPC • Solver Bus' : 'Proof-of-Life: Auto-ping on trade'}
              </span>
            </div>

            {/* TAB 1: ACTIVE POSITIONS */}
            {activeSubTab === 'positions' && (
              <div className="overflow-x-auto space-y-3">
                {autoTriggeredNotice && (
                  <div className="p-2.5 rounded-lg bg-obsidian-950 border border-cyber-amber/40 flex items-center justify-between text-xs font-mono text-cyber-amber">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-cyber-amber shrink-0" />
                      <span>
                        <strong>{autoTriggeredNotice.type === 'SL' ? 'Stop-Loss' : 'Take-Profit'} Auto-Triggered:</strong> Closed {autoTriggeredNotice.symbol} position at ${autoTriggeredNotice.price.toFixed(2)}. Realized exit telemetry synchronized to Trader DNA.
                      </span>
                    </div>
                    <span className="text-[10px] bg-cyber-amber/10 border border-cyber-amber/30 px-2 py-0.5 rounded font-bold">
                      PROFIT-HARVEST SYNC
                    </span>
                  </div>
                )}

                {activePositions.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs font-mono space-y-2">
                    <p className="text-slate-400">No active leveraged positions open.</p>
                    <p className="text-[11px] text-slate-600">Open a Perp or Futures position on the right. Spot swaps settle directly into Spot Assets.</p>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('spot')}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-obsidian-800 hover:bg-obsidian-700 text-cyber-emerald border border-cyber-emerald/30 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>View Spot Holdings ({spotAssets.filter(a => a.balance > 0).length} Assets)</span>
                    </button>
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
                        const currentMark = livePrices[pos.symbol] ?? pos.mark_price ?? pos.entry_price;
                        const { pnl, pnlPct, isProfit } = calculatePositionPnL(pos, currentMark);
                        const tickDir = priceDirections[pos.symbol] || 'SAME';

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
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className={`font-mono transition-colors ${
                                  tickDir === 'UP' ? 'text-cyber-emerald font-bold' : tickDir === 'DOWN' ? 'text-red-400 font-bold' : 'text-slate-400'
                                }`}>
                                  ${currentMark >= 1 ? currentMark.toFixed(2) : currentMark}
                                </span>
                                {pos.nearblocks_url && (
                                  <a
                                    href={pos.nearblocks_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyber-cyan hover:underline flex items-center gap-0.5"
                                    title="View Atomic Batch on NearBlocks"
                                  >
                                    <span>Tx ↗</span>
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-slate-300">
                              ${pos.margin.toFixed(2)}
                            </td>
                            <td className="py-3">
                              <span className={`font-bold block transition-colors ${isProfit ? 'text-cyber-emerald' : 'text-scarlet-400'}`}>
                                {isProfit ? '+' : ''}${pnl.toFixed(2)}
                              </span>
                              <span className={`text-[10px] transition-colors ${isProfit ? 'text-cyber-emerald' : 'text-scarlet-400'}`}>
                                ({isProfit ? '+' : ''}{pnlPct.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="py-3 text-[11px] text-slate-400">
                              <div>SL: <span className="text-scarlet-400">${pos.stop_loss || 'None'}</span></div>
                              <div>TP: <span className="text-cyber-emerald">${pos.take_profit || 'None'}</span></div>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleClose(pos.id, currentMark)}
                                disabled={closingId === pos.id || status === 'Executed' || status === 'GhostAwake'}
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

            {/* TAB: SPOT ASSETS (NEP-141, Chain Signatures MPC & NEAR Intents) */}
            {activeSubTab === 'spot' && (
              <div className="space-y-4">
                {/* Spot Portfolio Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                  <div className="bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Total Spot Portfolio</span>
                    <span className="text-sm font-bold text-cyber-emerald">
                      ${totalSpotPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] text-slate-500 block">Mark-to-market value</span>
                  </div>

                  <div className="bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Liquid USDC Reserve</span>
                    <span className="text-sm font-bold text-white">
                      ${liquidUsdcReserve.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] text-cyber-cyan block">Ready for Instant Swap</span>
                  </div>

                  <div className="bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Ecosystem Holdings</span>
                    <span className="text-sm font-bold text-purple-400">
                      ${nonUsdcHoldingsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] text-slate-500 block">{activeTokenCount} active tokens</span>
                  </div>

                  <div className="bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Settlement Rails</span>
                      <span className="text-xs font-bold text-white flex items-center gap-1 mt-0.5">
                        <Sparkles className="w-3 h-3 text-cyber-emerald" /> NEAR Intents / MPC
                      </span>
                    </div>
                    <span className="text-[9px] text-cyber-emerald">Zero Slippage Solver Bus</span>
                  </div>
                </div>

                {/* Filter and Quick Faucet Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-obsidian-800/60 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-[10px] text-slate-500 uppercase mr-1">Filter:</span>
                    {(['ALL', 'NEP-141', 'MPC', 'INTENTS'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setSpotFilter(filter)}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          spotFilter === filter
                            ? 'bg-cyber-emerald/15 text-cyber-emerald border border-cyber-emerald/40'
                            : 'bg-obsidian-950 text-slate-400 hover:text-slate-200 border border-obsidian-800'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFaucetRequest}
                      disabled={isFundingFaucet}
                      className="px-2.5 py-1 bg-cyber-emerald/10 hover:bg-cyber-emerald/20 text-cyber-emerald border border-cyber-emerald/30 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Fuel className="w-3 h-3" />
                      <span>{isFundingFaucet ? 'Fueling...' : 'Claim Faucet (+10 NEAR)'}</span>
                    </button>
                  </div>
                </div>

                {/* Spot Assets Table */}
                {filteredSpotAssets.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs font-mono space-y-2">
                    <Coins className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
                    <p className="text-slate-400 font-bold">No assets found for selected filter.</p>
                    <p className="text-[11px] text-slate-600">Switch filter to "ALL" or execute a Spot Buy on the right.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-obsidian-800/80 pb-2">
                          <th className="pb-2 font-normal">ASSET</th>
                          <th className="pb-2 font-normal">RAIL / CONTRACT</th>
                          <th className="pb-2 font-normal">BALANCE</th>
                          <th className="pb-2 font-normal">MARK PRICE</th>
                          <th className="pb-2 font-normal">TOTAL VALUE (USD)</th>
                          <th className="pb-2 font-normal">ALLOCATION</th>
                          <th className="pb-2 font-normal text-right">QUICK TRADE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-obsidian-800/50">
                        {filteredSpotAssets.map((asset) => {
                          const allocationPct = totalSpotPortfolioValue > 0
                            ? ((asset.usdValue / totalSpotPortfolioValue) * 100).toFixed(1)
                            : '0.0';

                          return (
                            <tr key={asset.symbol} className="hover:bg-obsidian-800/30 transition-colors">
                              {/* Asset Column */}
                              <td className="py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-[10px] ${asset.iconBg} ${asset.iconColor}`}>
                                    {asset.symbol.slice(0, 3)}
                                  </div>
                                  <div>
                                    <span className="font-bold text-white block leading-tight">{asset.symbol}</span>
                                    <span className="text-[10px] text-slate-400">{asset.name}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Rail Column */}
                              <td className="py-3">
                                <div className="space-y-0.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-block ${
                                    asset.category === 'Native NEP-141'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : asset.category === 'Chain Signatures (MPC)'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : asset.category === 'NEAR Intents'
                                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  }`}>
                                    {asset.category}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[140px]" title={asset.contractId}>
                                    {asset.contractId}
                                  </span>
                                </div>
                              </td>

                              {/* Balance Column */}
                              <td className="py-3">
                                <span className="text-white font-bold block">
                                  {asset.balance >= 1 ? asset.balance.toLocaleString('en-US', { maximumFractionDigits: 4 }) : asset.balance.toFixed(4)} {asset.symbol}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {asset.balance > 0 ? 'Liquid In-Vault' : 'Zero Balance'}
                                </span>
                              </td>

                              {/* Mark Price Column */}
                              <td className="py-3">
                                <span className={`block font-bold transition-colors ${
                                  asset.tickDir === 'UP' ? 'text-cyber-emerald' : asset.tickDir === 'DOWN' ? 'text-red-400' : 'text-slate-200'
                                }`}>
                                  ${asset.currentPrice >= 1 ? asset.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : asset.currentPrice.toFixed(4)}
                                </span>
                                <span className={`text-[10px] ${
                                  asset.change24h.startsWith('+') ? 'text-cyber-emerald' : asset.change24h.startsWith('-') ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                  {asset.change24h}
                                </span>
                              </td>

                              {/* Total Value Column */}
                              <td className="py-3">
                                <span className="text-white font-bold block">
                                  ${asset.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  USD Net
                                </span>
                              </td>

                              {/* Allocation Column */}
                              <td className="py-3">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400">{allocationPct}%</span>
                                  </div>
                                  <div className="w-20 h-1.5 bg-obsidian-950 border border-obsidian-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-cyber-emerald to-cyber-cyan rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(100, Math.max(1, parseFloat(allocationPct)))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Actions Column */}
                              <td className="py-3 text-right">
                                {asset.symbol === 'USDC' ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={handleFaucetRequest}
                                      disabled={isFundingFaucet}
                                      className="px-2 py-1 bg-obsidian-800 hover:bg-obsidian-700 text-cyber-cyan rounded-lg border border-obsidian-700 text-xs transition-colors cursor-pointer flex items-center gap-1"
                                      title="Fuel testnet wallet"
                                    >
                                      <Fuel className="w-3 h-3" />
                                      <span>Refill</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleQuickSpotTrade(asset.symbol, 'BUY')}
                                      disabled={status === 'Executed' || status === 'GhostAwake'}
                                      className="px-2 py-1 bg-cyber-emerald/10 hover:bg-cyber-emerald/20 text-cyber-emerald border border-cyber-emerald/30 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                                      title={`Spot Buy ${asset.symbol}`}
                                    >
                                      Buy
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickSpotTrade(asset.symbol, 'SELL')}
                                      disabled={asset.balance <= 0 || status === 'Executed' || status === 'GhostAwake'}
                                      className="px-2 py-1 bg-scarlet-500/10 hover:bg-scarlet-500/20 text-scarlet-400 border border-scarlet-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                                      title={`Spot Sell ${asset.symbol}`}
                                    >
                                      Sell
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BEHAVIORAL DNA TELEMETRY (6 Core Behavioral Intelligence Dimensions) */}
            {activeSubTab === 'telemetry' && (
              <div className="space-y-4">
                {/* Persona Header Banner */}
                <div className="p-3.5 bg-obsidian-950/80 border border-cyber-cyan/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyber-cyan/10 text-cyber-cyan">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">6-Dimension Living Behavioral Twin</span>
                      <h4 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                        {dna.archetype || 'Patience-Disciplined Counter-Cyclical Hedger'}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                      Telemetry: <strong className="text-white">{telemetry.total_trades_recorded ?? tradeHistory.length}</strong> trades / <strong className="text-white">{telemetry.total_positions_closed ?? 0}</strong> closes
                    </span>
                    <span className="text-xs font-mono text-cyber-emerald bg-cyber-emerald/10 border border-cyber-emerald/30 px-2.5 py-0.5 rounded-full">
                      CALIBRATED
                    </span>
                  </div>
                </div>

                {/* 6 Behavioral Dimensions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
                  
                  {/* 1. TRADING PATTERNS */}
                  <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-cyber-cyan" /> 1. Trading Patterns
                        </span>
                        <span className="text-[10px] text-cyber-cyan bg-cyber-cyan/10 px-1.5 py-0.5 rounded border border-cyber-cyan/20">
                          {patterns.execution_style || 'LIMIT_DISCIPLINED'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Horizon:</span>
                          <span className="font-bold text-white">{patterns.time_horizon || 'SWING_TRADER (1h-24h)'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Limit vs Market:</span>
                          <span className="text-cyber-emerald font-bold">{patterns.limit_order_ratio_pct ?? 80}% Limit</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1.5 border-t border-obsidian-800/60">
                          <span>Mix: Perp {patterns.perp_ratio_pct ?? 65}%</span>
                          <span>Spot {patterns.spot_ratio_pct ?? 25}%</span>
                          <span>Fut {patterns.futures_ratio_pct ?? 10}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. RISK TOLERANCE */}
                  <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-cyber-emerald" /> 2. Risk Tolerance
                        </span>
                        <span className="text-[10px] text-cyber-emerald bg-cyber-emerald/10 px-1.5 py-0.5 rounded border border-cyber-emerald/20">
                          {Math.round((risk.patience_score ?? 0.88) * 100)}% PATIENCE
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Max Drawdown:</span>
                          <span className="font-bold text-white">{Math.round((risk.drawdown_tolerance ?? 0.35) * 100)}% Max</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Volatility Affinity:</span>
                          <span className="text-cyber-cyan font-bold">{((risk.volatility_affinity ?? 0.65) * 100).toFixed(0)}% Comfort</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1.5 border-t border-obsidian-800/60">
                          <span>Leverage Appetite: {((risk.leverage_appetite ?? 0.25) * 100).toFixed(0)}%</span>
                          <span className="text-cyber-emerald">Delta-Shielded</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. LEVERAGE PREFERENCES */}
                  <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-cyber-amber" /> 3. Leverage Preferences
                        </span>
                        <span className="text-[10px] text-cyber-amber bg-cyber-amber/10 px-1.5 py-0.5 rounded border border-cyber-amber/20">
                          {leveragePrefs.leverage_discipline_grade || 'A (CONSERVATIVE)'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Average Leverage:</span>
                          <span className="font-bold text-cyber-amber">{telemetry.avg_leverage ?? leveragePrefs.avg_leverage ?? 2.5}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Max Permitted Cap:</span>
                          <span className="text-white font-bold">{dna.max_leverage_limit ?? 3.0}x</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1.5 border-t border-obsidian-800/60">
                          <span>Recorded Peak: {leveragePrefs.max_recorded_leverage ?? 3.0}x</span>
                          <span className="text-slate-400">Margin: Isolated</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. STOP-LOSS HABITS */}
                  <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-red-400" /> 4. Stop-Loss Habits
                        </span>
                        <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20">
                          {telemetry.stop_loss_adherence_pct ?? stopLoss.stop_loss_adherence_pct ?? 92}% ADHERENCE
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Avg Stop Cushion:</span>
                          <span className="font-bold text-white">{stopLoss.avg_stop_loss_pct ?? 3.2}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Hard Stop Mode:</span>
                          <span className="text-cyber-emerald font-bold">{stopLoss.hard_stop_enforcement !== false ? 'ENFORCED' : 'MANUAL'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1.5 border-t border-obsidian-800/60">
                          <span>Discipline Status:</span>
                          <span className="text-cyber-cyan">Zero Naked Exposure</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. PROFIT-TAKING BEHAVIOR */}
                  <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-cyber-emerald" /> 5. Profit-Taking
                        </span>
                        <span className="text-[10px] text-cyber-emerald bg-cyber-emerald/10 px-1.5 py-0.5 rounded border border-cyber-emerald/20 font-bold">
                          {telemetry.realized_rr_ratio ?? profitTaking.realized_rr_ratio ?? 2.15}x R:R
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Harvest Style:</span>
                          <span className="font-bold text-cyber-cyan">{telemetry.profit_harvest_style ?? profitTaking.profit_harvest_style ?? 'SCALE_OUT_TWAP'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">TP Target Adherence:</span>
                          <span className="text-white font-bold">{profitTaking.tp_target_adherence_pct ?? 85}%</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1.5 border-t border-obsidian-800/60">
                          <span>Avg TP Cushion: {profitTaking.avg_take_profit_pct ?? 6.2}%</span>
                          <span className="text-cyber-emerald">Win Rate: {profitTaking.win_rate_pct ?? 66.7}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6. DECISION-MAKING TENDENCIES */}
                  <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-400" /> 6. Decision-Making
                        </span>
                        <span className="text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">
                          {decisionTendencies.funding_rate_tolerance || 'DEFENSIVE_HEDGER'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Panic Resilience:</span>
                          <span className="font-bold text-cyber-emerald">
                            {Math.round((telemetry.panic_dump_resilience ?? decisionTendencies.panic_dump_resilience ?? 0.94) * 100)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Dip-Buyer Index:</span>
                          <span className="text-cyber-cyan font-bold">
                            {telemetry.dip_buyer_score ?? decisionTendencies.dip_buyer_vs_breakout_score ?? 0.82} / 1.0 (RSI ≤ 38)
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1.5 border-t border-obsidian-800/60">
                          <span>Decision Velocity:</span>
                          <span className="text-slate-300">{decisionTendencies.decision_speed || 'DELIBERATE (LIMIT)'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Extracted Immutable Behavioral Tenets (Ghost Takeover Rules) */}
                <div className="bg-obsidian-950 p-3.5 rounded-xl border border-obsidian-800 text-xs font-mono">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      Extracted Immutable Tenets (Fed to OpenRouter ling-3.0-flash at Takeover):
                    </span>
                    <span className="text-[10px] text-slate-500">Autonomous Mimicry Constraints</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-300">
                    {(dna.personal_tenets || [
                      "Never market-sell into an oversold RSI (< 38).",
                      "Enforce minimum 2.15x Risk/Reward discipline before exiting profitable positions.",
                      "Unwind positions via SCALE_OUT_TWAP with max leverage cap of 3.0x.",
                      "Maintain 94% panic resilience holding through flash-crash spikes.",
                      "Consolidate all peripheral LPs into USDC via NEAR Intents."
                    ]).map((tenet: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-cyber-cyan font-bold">›</span>
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
                        <th className="pb-2 font-normal text-right">ON-CHAIN TX (NEARBLOCKS)</th>
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
                          <td className="py-2.5 text-right font-mono">
                            {tr.nearblocks_url || tr.tx_hash ? (
                              <a
                                href={tr.nearblocks_url || `https://testnet.nearblocks.io/txns/${tr.tx_hash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/30 text-cyber-cyan text-[10px] transition-colors"
                              >
                                <span>{(tr.tx_hash || 'Tx').substring(0, 10)}...</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className="text-slate-500 text-[10px]">On-Chain</span>
                            )}
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
            
            {/* Action Toggle (BUY / SELL for SPOT; BUY / LONG and SELL / SHORT for PERP & FUTURES) */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setOrderSide('BUY')}
                className={`py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : 'bg-obsidian-800 text-slate-400 hover:text-white border border-obsidian-700'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>{tradingMode === 'SPOT' ? 'BUY' : 'BUY / LONG'}</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderSide('SELL')}
                className={`py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  orderSide === 'SELL'
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                    : 'bg-obsidian-800 text-slate-400 hover:text-white border border-obsidian-700'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>{tradingMode === 'SPOT' ? 'SELL' : 'SELL / SHORT'}</span>
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
              {/* Leverage Selector (for PERP & FUTURES) vs Spot Notice */}
              {tradingMode !== 'SPOT' ? (
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
              ) : (
                <div className="bg-obsidian-950 px-3 py-2 rounded-xl border border-obsidian-800 text-[11px] font-mono flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5 text-cyber-emerald">
                    <Coins className="w-3.5 h-3.5" />
                    Spot Direct Settlement
                  </span>
                  <span className="text-slate-500">1x • Zero Liquidation Risk</span>
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

              {/* Size Input with Coherent Available Balance Indicator */}
              <div>
                <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-1">
                  <span>ORDER SIZE ({baseSymbol})</span>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-slate-500">Avail:</span>
                    <span className="text-cyber-cyan font-bold">
                      {tradingMode === 'SPOT'
                        ? (orderSide === 'BUY'
                            ? `$${availableQuoteBalance.toFixed(2)} USDC`
                            : `${availableBaseBalance >= 1 ? availableBaseBalance.toFixed(2) : availableBaseBalance.toFixed(4)} ${baseSymbol}`)
                        : `$${availableQuoteBalance.toFixed(2)} USDC`}
                    </span>
                  </div>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  className={`w-full bg-obsidian-950 border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors ${
                    orderValidationError && currentSize > 0
                      ? 'border-red-500/60 focus:border-red-500'
                      : 'border-obsidian-700 focus:border-scarlet-500'
                  }`}
                />

                {/* Percentage Pills */}
                <div className="flex gap-2 mt-2">
                  {[0.25, 0.50, 0.75, 1.0].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePercentageClick(p)}
                      className="flex-1 py-1 text-[10px] font-mono rounded bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 border border-obsidian-700 transition-colors cursor-pointer"
                    >
                      {p * 100}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Stop Loss & Take Profit Settings */}
              {tradingMode === 'SPOT' && orderSide === 'SELL' ? (
                <div className="bg-obsidian-950 p-2.5 rounded-xl border border-obsidian-800/80 text-[11px] font-mono text-slate-400 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-cyber-cyan flex-shrink-0" />
                  <span>Spot sell executes direct asset disposal into USDC. Bracket SL/TP applies to spot buys & perps.</span>
                </div>
              ) : (
                <div className="bg-obsidian-950 p-3 rounded-xl border border-obsidian-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={hasStopLoss}
                        onChange={(e) => setHasStopLoss(e.target.checked)}
                        className="rounded accent-scarlet-500"
                      />
                      <span>{tradingMode === 'SPOT' ? 'Attach Stop Loss / Take Profit Bracket' : 'Attach Stop Loss / Take Profit'}</span>
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
              )}

              {/* Summary Stats */}
              <div className="text-xs font-mono space-y-1.5 text-slate-400 border-t border-obsidian-800 pt-3">
                <div className="flex justify-between">
                  <span>{tradingMode === 'SPOT' ? (orderSide === 'BUY' ? 'Total Pay (USDC)' : 'Total Receive (Est.)') : 'Margin Required'}</span>
                  <span className="text-white font-bold">${requiredMargin.toFixed(2)}</span>
                </div>
                {tradingMode !== 'SPOT' ? (
                  <div className="flex justify-between">
                    <span>Est. Liquidation Price</span>
                    <span className="text-scarlet-400">${estLiqPrice.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Liquidation Risk</span>
                    <span className="text-cyber-emerald font-medium">None (Unleveraged Spot)</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Settlement Rail</span>
                  <span className="text-cyber-cyan">{tradingMode === 'SPOT' ? 'NEAR Intents NEP-413' : 'NEAR Intents + MPC'}</span>
                </div>
              </div>

              {/* Order Validation Error Banner */}
              {orderValidationError && currentSize > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-[11px] font-mono text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{orderValidationError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !!orderValidationError || status === 'Executed' || status === 'GhostAwake'}
                className={`w-full py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/10'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/10'
                }`}
              >
                {isSubmitting ? 'Recording Trade & Pinging NEAR...' : (
                  orderValidationError && currentSize > 0
                    ? 'Insufficient Available Balance'
                    : (tradingMode === 'SPOT'
                        ? `${orderSide === 'BUY' ? 'Buy' : 'Sell'} ${baseSymbol} (Spot)`
                        : (orderSide === 'BUY'
                            ? `Open ${tradingMode} Long ${baseSymbol}`
                            : `Open ${tradingMode} Short ${baseSymbol}`))
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
