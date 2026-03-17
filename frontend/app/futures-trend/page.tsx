'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Position {
  symbol: string; pair: string; side: string; direction: string;
  entryPrice: number; currentPrice: number; qty: number; quantity: number;
  sl: number; tp: number; margin: number; leverage: number;
  unrealizedPnl: number; unrealizedPnlPct: number;
  durationMin: number; progressPct: number; openTime: string;
}

interface PerfData {
  totalTrades: number; wins: number; losses: number; winRate: number;
  totalPnlUsdt: number; totalPnL: number; avgWin: number; avgLoss: number;
  profitFactor: number; peakEquity: number;
  maxDrawdown?: number; maxDrawdownPct?: number;
  equityCurve?: { time: string; equity: number }[];
  lastTradeAt?: string;
  [key: string]: any;
}

interface StatusData {
  state: string; scannerRunning: boolean | null; dryRun: boolean;
  leverage: number; currentBalance: number; totalEquity: number;
  unrealizedPnlAccount: number; availableBalance: number;
  regime: string; btcTrend: string; btcRegime: string;
  btcAtrPct: number; btcAdx: number; btcRangePct: number;
  btcFlipPause: boolean;
  openPositionsCount: number; openPositions: Position[];
  longCount: number; shortCount: number;
  dailyPnl: number; dailyTrades: number;
  performance: PerfData;
  pairs: number;
  exposureAlert?: { active: boolean; message?: string };
  institutional?: {
    regime: { regime: string; regimeConfidence: number; bias4h: string; bias1h: string };
    session: { session: string; label: string; quality: number; multiplier: number };
    riskState: { lossStreak: number; drawdownPct: number; macroMode: string };
    protection: { consecutiveLosses: number; dailyPnl: number; isPaused: boolean; killSwitches: any; hourlyTrades: number; dailyTradeCount: number };
    health: { health: number; level: string; components: any };
    macroMode: string; readiness: string; dubaiTime: string;
  };
  macroFilter?: { canTrade: boolean; riskMultiplier: number; regime: string; reason: string };
  [key: string]: any;
}

interface TradeRecord {
  pair: string; side: string; entryPrice: number; exitPrice: number;
  qty: number; pnlUsdt: number; pnlPct: number; reason: string;
  openTime: string; closeTime: string;
  fees?: number; netPnl?: number; pnl?: number; isMaker?: boolean;
}

interface SignalData {
  pair: string; signal: string; price: number;
  ema20: number; ema50: number; ema200: number;
  rsi: number; atr?: number; atrAvg14?: number;
  adx?: number; reason: string;
  htf1hTrend?: string; scannedAt?: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const fmt = (n: number, d = 2) => (n ?? 0).toFixed(d);
const fmtPct = (n: number) => `${(n ?? 0).toFixed(1)}%`;
const fmtUsd = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const pnlColor = (n: number) => n > 0 ? '#4ade80' : n < 0 ? '#f87171' : '#94a3b8';
const pnlSign = (n: number) => n > 0 ? '+' : '';

const API = '/futures-pro-api';
const PRO_API = '/futures-pro-api';

const ALL_PAIRS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT',
  'LINKUSDT','DOTUSDT','NEARUSDT','ATOMUSDT','LTCUSDT','BCHUSDT','INJUSDT',
  'APTUSDT','SUIUSDT','ARBUSDT','OPUSDT','SEIUSDT','STXUSDT','DOGEUSDT',
  '1000PEPEUSDT','WIFUSDT','1000BONKUSDT','1000FLOKIUSDT','FETUSDT','RENDERUSDT','AGIXUSDT'
];

/* ─── TradingView Chart Component ───────────────────────────────────────── */
function TradingViewChart({ symbol, interval }: { symbol: string; interval: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${symbol}.P`,
      interval: interval,
      timezone: 'Asia/Dubai',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#0f1629',
      gridColor: '#1a2540',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: [
        { id: 'MAExp@tv-basicstudies', inputs: { length: 20 } },
        { id: 'MAExp@tv-basicstudies', inputs: { length: 50 } },
        { id: 'MAExp@tv-basicstudies', inputs: { length: 200 } },
        { id: 'RSI@tv-basicstudies' },
      ],
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container__widget';
    wrapper.style.height = '100%';
    wrapper.style.width = '100%';

    containerRef.current.appendChild(wrapper);
    containerRef.current.appendChild(script);
  }, [symbol, interval]);

  return (
    <div className="tradingview-widget-container" ref={containerRef}
      style={{ height: '100%', width: '100%' }}
    />
  );
}

/* ─── Signal Scanner Table ──────────────────────────────────────────────── */
type SortKey = 'pair' | 'price' | 'rsi' | 'adx' | 'signal' | 'atrPct' | 'confidence';
type SortDir = 'asc' | 'desc';

function getSignalLabel(sig: SignalData): string {
  if (!sig.signal || sig.signal === 'NONE') {
    // Check reason for more info
    if (sig.reason?.includes('LONG')) return 'LONG READY';
    if (sig.reason?.includes('SHORT')) return 'SHORT READY';
    return 'NO SIGNAL';
  }
  if (sig.signal === 'LONG') return 'LONG READY';
  if (sig.signal === 'SHORT') return 'SHORT READY';
  return sig.signal.toUpperCase();
}

function getSignalColor(label: string): string {
  if (label.includes('LONG')) return '#4ade80';
  if (label.includes('SHORT')) return '#f87171';
  if (label === 'NEUTRAL') return '#fbbf24';
  return '#475569';
}

function getRegimeFromSignal(sig: SignalData): string {
  const reason = sig.reason || '';
  if (reason.includes('VOLATILE') || reason.includes('HIGH_VOL')) return 'VOLATILE';
  if (reason.includes('DEAD') || reason.includes('LOW_ADX')) return 'DEAD';
  if (reason.includes('RANGE') || reason.includes('RANGING')) return 'RANGE';
  if ((sig.adx || 0) > 25) return 'TREND';
  if ((sig.adx || 0) < 15) return 'DEAD';
  return 'RANGE';
}

function getRegimeColor(regime: string): string {
  if (regime === 'TREND') return '#d4a843';
  if (regime === 'RANGE') return '#94a3b8';
  if (regime === 'VOLATILE') return '#f87171';
  return '#475569';
}

function getStatusFromSignal(sig: SignalData): { label: string; color: string } {
  const signalLabel = getSignalLabel(sig);
  if (signalLabel.includes('LONG') || signalLabel.includes('SHORT'))
    return { label: 'READY', color: '#4ade80' };
  const reason = sig.reason || '';
  if (reason.includes('LOW_ADX') || reason.includes('DEAD') || reason.includes('VOLATILE'))
    return { label: 'BLOCKED', color: '#f87171' };
  if (reason.includes('NO_ALIGN') || reason.includes('HTF'))
    return { label: 'CAUTION', color: '#fbbf24' };
  return { label: 'NEUTRAL', color: '#64748b' };
}

function getConfidence(sig: SignalData): number {
  let score = 50;
  // ADX strength
  const adx = sig.adx || 0;
  if (adx > 30) score += 15;
  else if (adx > 25) score += 10;
  else if (adx < 15) score -= 20;
  // RSI extremes
  const rsi = sig.rsi || 50;
  if (rsi > 65 || rsi < 35) score += 10;
  if (rsi > 75 || rsi < 25) score += 10;
  // EMA alignment
  if (sig.ema20 && sig.ema50 && sig.ema200) {
    if (sig.ema20 > sig.ema50 && sig.ema50 > sig.ema200) score += 15; // full bull alignment
    else if (sig.ema20 < sig.ema50 && sig.ema50 < sig.ema200) score += 15; // full bear alignment
  }
  // Signal present
  const label = getSignalLabel(sig);
  if (label.includes('LONG') || label.includes('SHORT')) score += 10;
  return Math.max(0, Math.min(100, score));
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function formatEma(val: number): string {
  if (!val) return '—';
  if (val >= 1000) return val.toFixed(1);
  if (val >= 1) return val.toFixed(3);
  return val.toFixed(5);
}

function SignalScanner({ signals, onSelectPair }: { signals: Record<string, SignalData>; onSelectPair: (pair: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('confidence');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedSignals = useMemo(() => {
    const entries = Object.values(signals);
    return entries.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'pair': return sortDir === 'asc' ? a.pair.localeCompare(b.pair) : b.pair.localeCompare(a.pair);
        case 'price': av = a.price || 0; bv = b.price || 0; break;
        case 'rsi': av = a.rsi || 0; bv = b.rsi || 0; break;
        case 'adx': av = a.adx || 0; bv = b.adx || 0; break;
        case 'atrPct': av = a.atr ? (a.atr / a.price * 100) : 0; bv = b.atr ? (b.atr / b.price * 100) : 0; break;
        case 'signal':
          const al = getSignalLabel(a), bl = getSignalLabel(b);
          const rank = (l: string) => l.includes('LONG') || l.includes('SHORT') ? 2 : l === 'NEUTRAL' ? 1 : 0;
          av = rank(al); bv = rank(bl); break;
        case 'confidence': av = getConfidence(a); bv = getConfidence(b); break;
        default: av = 0; bv = 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [signals, sortKey, sortDir]);

  const SortHeader = ({ label, sKey, width }: { label: string; sKey: SortKey; width?: string }) => (
    <th onClick={() => toggleSort(sKey)} style={{
      textAlign: 'left', padding: '10px 6px', color: sortKey === sKey ? '#d4a843' : '#475569',
      fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px',
      borderBottom: '1px solid #1a2540', cursor: 'pointer', userSelect: 'none',
      width: width || 'auto', whiteSpace: 'nowrap',
    }}>
      {label} {sortKey === sKey ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <SortHeader label="Pair" sKey="pair" width="90px" />
            <SortHeader label="Price" sKey="price" width="85px" />
            <th style={{ textAlign: 'left', padding: '10px 6px', color: '#475569', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a2540' }}>EMA 20</th>
            <th style={{ textAlign: 'left', padding: '10px 6px', color: '#475569', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a2540' }}>EMA 50</th>
            <th style={{ textAlign: 'left', padding: '10px 6px', color: '#475569', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a2540' }}>EMA 200</th>
            <SortHeader label="RSI" sKey="rsi" width="55px" />
            <SortHeader label="ATR %" sKey="atrPct" width="60px" />
            <SortHeader label="ADX" sKey="adx" width="55px" />
            <SortHeader label="Signal" sKey="signal" width="100px" />
            <th style={{ textAlign: 'left', padding: '10px 6px', color: '#475569', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a2540' }}>Regime</th>
            <th style={{ textAlign: 'left', padding: '10px 6px', color: '#475569', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a2540' }}>Status</th>
            <SortHeader label="Conf" sKey="confidence" width="55px" />
          </tr>
        </thead>
        <tbody>
          {sortedSignals.map((sig) => {
            const signalLabel = getSignalLabel(sig);
            const signalColor = getSignalColor(signalLabel);
            const regime = getRegimeFromSignal(sig);
            const regimeColor = getRegimeColor(regime);
            const status = getStatusFromSignal(sig);
            const confidence = getConfidence(sig);
            const atrPct = sig.atr && sig.price ? (sig.atr / sig.price * 100) : (sig.atrAvg14 && sig.price ? (sig.atrAvg14 / sig.price * 100) : 0);
            const isReady = signalLabel.includes('LONG') || signalLabel.includes('SHORT');
            const rsiColor = (sig.rsi || 50) > 70 ? '#f87171' : (sig.rsi || 50) < 30 ? '#4ade80' : '#94a3b8';

            return (
              <tr key={sig.pair}
                onClick={() => onSelectPair(sig.pair)}
                style={{
                  borderBottom: '1px solid #111b30',
                  cursor: 'pointer',
                  background: isReady ? '#10b98108' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = isReady ? '#10b98115' : '#1a254020')}
                onMouseLeave={e => (e.currentTarget.style.background = isReady ? '#10b98108' : 'transparent')}
              >
                <td style={{ padding: '8px 6px', fontWeight: 700, color: '#e2e8f0', fontSize: 12 }}>
                  {sig.pair.replace('USDT', '')}
                  <span style={{ color: '#475569', fontWeight: 400, fontSize: 10 }}>/USDT</span>
                </td>
                <td style={{ padding: '8px 6px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11 }}>{formatPrice(sig.price || 0)}</td>
                <td style={{ padding: '8px 6px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{formatEma(sig.ema20)}</td>
                <td style={{ padding: '8px 6px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{formatEma(sig.ema50)}</td>
                <td style={{ padding: '8px 6px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{formatEma(sig.ema200)}</td>
                <td style={{ padding: '8px 6px', color: rsiColor, fontWeight: 600, fontFamily: 'monospace', fontSize: 11 }}>{(sig.rsi || 0).toFixed(1)}</td>
                <td style={{ padding: '8px 6px', color: atrPct > 1 ? '#fbbf24' : '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{atrPct.toFixed(2)}%</td>
                <td style={{ padding: '8px 6px', color: (sig.adx || 0) > 25 ? '#d4a843' : '#475569', fontWeight: 600, fontFamily: 'monospace', fontSize: 11 }}>{(sig.adx || 0).toFixed(1)}</td>
                <td style={{ padding: '8px 6px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
                    background: signalColor + '18', color: signalColor,
                    border: `1px solid ${signalColor}40`,
                  }}>
                    {signalLabel}
                  </span>
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: 600,
                    background: regimeColor + '18', color: regimeColor,
                  }}>
                    {regime}
                  </span>
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 4,
                    fontSize: 10, fontWeight: 600,
                    background: status.color + '18', color: status.color,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: status.color }} />
                    {status.label}
                  </span>
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ background: '#1a2540', borderRadius: 3, height: 6, width: 40, position: 'relative' }}>
                      <div style={{
                        background: confidence >= 70 ? '#4ade80' : confidence >= 50 ? '#fbbf24' : '#f87171',
                        borderRadius: 3, height: '100%', width: `${confidence}%`,
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: confidence >= 70 ? '#4ade80' : confidence >= 50 ? '#fbbf24' : '#f87171', fontWeight: 600, fontFamily: 'monospace' }}>
                      {confidence}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sortedSignals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#334155' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📡</div>
          <div style={{ fontSize: 13 }}>Waiting for signal data...</div>
        </div>
      )}
    </div>
  );
}

/* ─── Equity Curve Component ────────────────────────────────────────────── */
function EquityCurve({ data }: { data: { time: string; equity: number }[] }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
        Equity curve builds as trades close
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const W = 700, H = 180, PAD = 30;
  const vals = sorted.map(d => d.equity);
  const min = Math.min(...vals) * 0.999;
  const max = Math.max(...vals) * 1.001;
  const range = max - min || 1;

  const points = sorted.map((d, i) => ({
    x: PAD + (i / (sorted.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (d.equity - min) / range) * (H - PAD * 2),
  }));

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${line} L${points[points.length - 1].x},${H - PAD} L${points[0].x},${H - PAD} Z`;

  const isPositive = vals[vals.length - 1] >= vals[0];
  const color = isPositive ? '#4ade80' : '#f87171';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => {
        const y = PAD + f * (H - PAD * 2);
        const val = max - f * range;
        return (
          <g key={f}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#1e293b" strokeWidth="1" />
            <text x={PAD - 4} y={y + 4} fill="#475569" fontSize="9" textAnchor="end">${val.toFixed(0)}</text>
          </g>
        );
      })}
      <path d={area} fill="url(#eqGrad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill={color} />
    </svg>
  );
}

/* ─── Main Dashboard ────────────────────────────────────────────────────── */
export default function FuturesTrendPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [signals, setSignals] = useState<Record<string, SignalData>>({});
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [chartInterval, setChartInterval] = useState('60');
  const [showChart, setShowChart] = useState(true);
  // Trade history: sorting, filtering, pagination
  const [tradeSortKey, setTradeSortKey] = useState<'closeTime'|'pair'|'pnlUsdt'|'pnlPct'|'side'|'fees'>('closeTime');
  const [tradeSortDir, setTradeSortDir] = useState<'asc'|'desc'>('desc');
  const [tradeFilter, setTradeFilter] = useState<'all'|'wins'|'losses'>('all');
  const [tradePairFilter, setTradePairFilter] = useState<string>('all');
  const [tradeDateFilter, setTradeDateFilter] = useState<string>('all');
  const [tradePage, setTradePage] = useState(0);
  const TRADES_PER_PAGE = 25;

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, tRes, sigRes] = await Promise.all([
        fetch(`${API}/status`),
        fetch(`${API}/trades`),
        fetch(`${PRO_API}/signals`).catch(() => null),
      ]);
      if (sRes.ok) setStatus(await sRes.json());
      if (tRes.ok) setTrades(await tRes.json());
      if (sigRes && sigRes.ok) {
        const sigData = await sigRes.json();
        setSignals(sigData);
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 10000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const doAction = async (endpoint: string, label: string) => {
    setActionMsg(`${label}...`);
    try {
      await fetch(`${API}/${endpoint}`, { method: 'POST' });
      setActionMsg(`✓ ${label}`);
      setTimeout(fetchAll, 2000);
    } catch { setActionMsg('Error'); }
    setTimeout(() => setActionMsg(''), 4000);
  };

  if (loading) return (
    <div style={{ background: '#0b1022', color: '#e2e8f0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
        <div style={{ fontSize: 16, color: '#94a3b8' }}>Connecting to trading bot...</div>
      </div>
    </div>
  );

  if (!status) return (
    <div style={{ background: '#0b1022', color: '#f87171', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div>Failed to connect to trading bot</div>
      </div>
    </div>
  );

  const perf = status.performance || {} as PerfData;
  const inst = status.institutional;
  const isRunning = status.scannerRunning === true;
  const regime = inst?.regime?.regime || status.btcRegime || status.regime || 'RANGING';
  const bias = inst?.regime?.bias4h || status.btcTrend || 'NEUTRAL';
  const readiness = inst?.readiness || (isRunning ? 'READY' : 'STOPPED');
  const healthLevel = inst?.health?.level || 'YELLOW';
  const healthScore = inst?.health?.health ?? 50;
  const macroMode = inst?.macroMode || status.macroFilter?.regime || 'NORMAL';
  const equityCurve = perf.equityCurve || [];

  // Alert conditions
  const alerts: { type: 'warning' | 'danger' | 'info'; msg: string }[] = [];
  if (status.btcFlipPause) alerts.push({ type: 'warning', msg: '⏸ BTC trend flipped — new entries paused' });
  if (status.exposureAlert?.active) alerts.push({ type: 'danger', msg: `🚫 ${status.exposureAlert.message || 'Exposure limit reached'}` });
  if (macroMode === 'RED_ALERT') alerts.push({ type: 'danger', msg: '🔴 Macro RED ALERT — trading restricted' });
  else if (macroMode === 'CAUTION') alerts.push({ type: 'warning', msg: '🟡 Macro caution — reduced position sizes' });
  if (inst?.protection?.isPaused) alerts.push({ type: 'danger', msg: '🔒 Capital protection triggered — bot paused' });
  if (regime === 'DEAD' || regime === 'VOLATILE') alerts.push({ type: 'warning', msg: `⚠️ Market regime: ${regime} — entries may be blocked` });

  const regimeColor = regime === 'TRENDING' || regime === 'TREND' ? '#d4a843' : regime === 'RANGING' || regime === 'RANGE' ? '#94a3b8' : regime === 'VOLATILE' ? '#f87171' : '#475569';
  const biasIcon = bias === 'BULLISH' ? '↗' : bias === 'BEARISH' ? '↘' : '→';
  const biasColor = bias === 'BULLISH' ? '#4ade80' : bias === 'BEARISH' ? '#f87171' : '#94a3b8';

  const readyCount = Object.values(signals).filter(s => {
    const l = getSignalLabel(s);
    return l.includes('LONG') || l.includes('SHORT');
  }).length;

  const timeframes = [
    { label: '15m', value: '15' },
    { label: '1H', value: '60' },
    { label: '4H', value: '240' },
    { label: '1D', value: 'D' },
  ];

  return (
    <div style={{ background: '#0b1022', color: '#e2e8f0', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* ═══════ STATUS BAR ═══════ */}
      <div style={{ background: '#0f1629', borderBottom: '1px solid #1a2540', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#d4a843' }}>Futures Pro</span>
        </div>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', background: isRunning ? '#10b98118' : '#ef444418', color: isRunning ? '#4ade80' : '#f87171', border: `1px solid ${isRunning ? '#10b98140' : '#ef444440'}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRunning ? '#4ade80' : '#f87171' }} />
          {isRunning ? 'RUNNING' : 'STOPPED'}
        </span>

        {status.dryRun ? (
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f59e0b18', color: '#fbbf24', border: '1px solid #f59e0b40' }}>DRY RUN</span>
        ) : (
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#3b82f618', color: '#60a5fa', border: '1px solid #3b82f640' }}>LIVE</span>
        )}

        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: regimeColor + '18', color: regimeColor, border: `1px solid ${regimeColor}40` }}>{regime}</span>
        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: biasColor + '18', color: biasColor, border: `1px solid ${biasColor}40` }}>{biasIcon} BTC {bias}</span>
        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: readiness === 'READY' ? '#10b98118' : readiness === 'PAUSED' ? '#ef444418' : '#f59e0b18', color: readiness === 'READY' ? '#4ade80' : readiness === 'PAUSED' ? '#f87171' : '#fbbf24', border: `1px solid ${readiness === 'READY' ? '#10b98140' : readiness === 'PAUSED' ? '#ef444440' : '#f59e0b40'}` }}>
          {readiness === 'READY' ? '✓' : readiness === 'PAUSED' ? '🔒' : '⚠'} {readiness.replace(/_/g, ' ')}
        </span>
        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (healthLevel === 'GREEN' ? '#10b981' : healthLevel === 'YELLOW' ? '#f59e0b' : '#ef4444') + '18', color: healthLevel === 'GREEN' ? '#4ade80' : healthLevel === 'YELLOW' ? '#fbbf24' : '#f87171', border: `1px solid ${(healthLevel === 'GREEN' ? '#10b981' : healthLevel === 'YELLOW' ? '#f59e0b' : '#ef4444')}40` }}>
          ♥ {healthScore}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#475569' }}>
            {inst?.dubaiTime || ''} · {status.pairs || Object.keys(signals).length} pairs · {status.leverage}×
          </span>
          {isRunning ? (
            <button onClick={() => doAction('pause', 'Pausing bot')} style={{ background: '#f59e0b22', color: '#fbbf24', border: '1px solid #f59e0b40', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>⏸ PAUSE</button>
          ) : (
            <button onClick={() => doAction('resume', 'Starting bot')} style={{ background: '#10b98122', color: '#4ade80', border: '1px solid #10b98140', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>▶ START</button>
          )}
          <button onClick={fetchAll} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11 }}>↻</button>
        </div>
      </div>

      {actionMsg && (
        <div style={{ background: '#d4a84315', color: '#d4a843', padding: '8px 24px', fontSize: 13, textAlign: 'center', borderBottom: '1px solid #d4a84330' }}>{actionMsg}</div>
      )}

      {/* ═══════ ALERT BANNER ═══════ */}
      {alerts.length > 0 && (
        <div style={{ padding: '8px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {alerts.map((a, i) => (
            <div key={i} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: a.type === 'danger' ? '#ef444415' : a.type === 'warning' ? '#f59e0b15' : '#3b82f615',
              color: a.type === 'danger' ? '#fca5a5' : a.type === 'warning' ? '#fde68a' : '#93c5fd',
              border: `1px solid ${a.type === 'danger' ? '#ef444430' : a.type === 'warning' ? '#f59e0b30' : '#3b82f630'}`,
              flex: '1 1 auto',
            }}>{a.msg}</div>
          ))}
        </div>
      )}

      <div style={{ padding: '16px 24px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ═══════ 5 KPI CARDS ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px 16px', border: '1px solid #1a2540' }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Total Trades</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>{perf.totalTrades || 0}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
              <span style={{ color: '#4ade80' }}>{perf.wins || 0}W</span> · <span style={{ color: '#f87171' }}>{perf.losses || 0}L</span> · PF: {fmt(perf.profitFactor)}
            </div>
          </div>

          <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px 16px', border: '1px solid #1a2540' }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Win Rate</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: (perf.winRate || 0) >= 50 ? '#4ade80' : (perf.winRate || 0) >= 35 ? '#fbbf24' : '#f87171', lineHeight: 1 }}>{fmtPct(perf.winRate || 0)}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Avg W: {fmtUsd(perf.avgWin || 0)} · L: {fmtUsd(perf.avgLoss || 0)}</div>
          </div>

          <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px 16px', border: '1px solid #1a2540' }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Wallet Balance</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#d4a843', lineHeight: 1 }}>{fmtUsd(status.currentBalance)}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
              Equity: {fmtUsd(status.totalEquity)} · Unreal: <span style={{ color: pnlColor(status.unrealizedPnlAccount) }}>{pnlSign(status.unrealizedPnlAccount)}{fmtUsd(status.unrealizedPnlAccount)}</span>
            </div>
          </div>

          <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px 16px', border: '1px solid #1a2540' }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Daily P&L</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: pnlColor(status.dailyPnl), lineHeight: 1 }}>{pnlSign(status.dailyPnl)}{fmtUsd(status.dailyPnl)}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
              {status.dailyTrades || 0} trades today · Total: <span style={{ color: pnlColor(perf.totalPnlUsdt || perf.totalPnL || 0) }}>{pnlSign(perf.totalPnlUsdt || perf.totalPnL || 0)}{fmtUsd(perf.totalPnlUsdt || perf.totalPnL || 0)}</span>
            </div>
          </div>

          <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px 16px', border: '1px solid #1a2540' }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Positions</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: status.openPositionsCount > 0 ? '#60a5fa' : '#475569', lineHeight: 1 }}>{status.openPositionsCount || 0}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
              <span style={{ color: '#4ade80' }}>↑{status.longCount || 0}</span> · <span style={{ color: '#f87171' }}>↓{status.shortCount || 0}</span> · Max: {(status as any).maxPerDir ?? 2}/dir
            </div>
          </div>
        </div>

        {/* ═══════ LIVE CHART SECTION ═══════ */}
        <div style={{ background: '#0f1629', borderRadius: 12, border: '1px solid #1a2540', marginBottom: 16, overflow: 'hidden' }}>
          {/* Chart Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a2540', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#d4a843', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📊 Live Chart
              </h3>
              <button onClick={() => setShowChart(!showChart)} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }}>
                {showChart ? '▼' : '▶'}
              </button>
            </div>

            {showChart && (
              <>
                {/* Timeframe buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {timeframes.map(tf => (
                    <button key={tf.value} onClick={() => setChartInterval(tf.value)}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: chartInterval === tf.value ? '#d4a84325' : 'transparent',
                        color: chartInterval === tf.value ? '#d4a843' : '#64748b',
                        border: `1px solid ${chartInterval === tf.value ? '#d4a84340' : '#1a2540'}`,
                      }}>
                      {tf.label}
                    </button>
                  ))}
                </div>

                {/* Pair selector */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 700 }}>
                  {ALL_PAIRS.slice(0, 14).map(p => (
                    <button key={p} onClick={() => setSelectedPair(p)}
                      style={{
                        padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        background: selectedPair === p ? '#3b82f620' : 'transparent',
                        color: selectedPair === p ? '#60a5fa' : '#475569',
                        border: `1px solid ${selectedPair === p ? '#3b82f640' : 'transparent'}`,
                      }}>
                      {p.replace('USDT', '')}
                    </button>
                  ))}
                  <select
                    value={selectedPair}
                    onChange={e => setSelectedPair(e.target.value)}
                    style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      background: '#1a2540', color: '#94a3b8', border: '1px solid #334155',
                    }}>
                    {ALL_PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Chart Body */}
          {showChart && (
            <div style={{ height: 500 }}>
              <TradingViewChart symbol={selectedPair} interval={chartInterval} />
            </div>
          )}
        </div>

        {/* ═══════ SIGNAL SCANNER ═══════ */}
        <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px', border: '1px solid #1a2540', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#d4a843', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📡 Signal Scanner
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#475569' }}>
                {Object.keys(signals).length} pairs scanned
              </span>
              {readyCount > 0 && (
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#10b98118', color: '#4ade80', border: '1px solid #10b98140' }}>
                  {readyCount} READY
                </span>
              )}
              <span style={{ fontSize: 10, color: '#334155' }}>Auto-refresh 10s</span>
            </div>
          </div>
          <SignalScanner signals={signals} onSelectPair={(pair) => { setSelectedPair(pair); setShowChart(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>

        {/* ═══════ TWO-COLUMN: EQUITY + MARKET OVERVIEW ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px', border: '1px solid #1a2540' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#d4a843', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📈 Equity Curve</h3>
              <span style={{ fontSize: 11, color: '#475569' }}>{equityCurve.length} points</span>
            </div>
            <EquityCurve data={equityCurve} />
          </div>

          <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px', border: '1px solid #1a2540' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#d4a843', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🌐 Market Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
              {[
                { label: 'BTC Regime', value: regime, color: regimeColor },
                { label: '4H Bias', value: bias, color: biasColor },
                { label: 'Session', value: inst?.session?.label || 'OFF_PEAK', color: '#60a5fa' },
                { label: 'Macro', value: macroMode, color: macroMode === 'NORMAL' || macroMode === 'CLEAR' ? '#4ade80' : macroMode === 'CAUTION' ? '#fbbf24' : '#f87171' },
                { label: 'Drawdown', value: fmtPct(inst?.riskState?.drawdownPct ?? 0), color: (inst?.riskState?.drawdownPct ?? 0) < 3 ? '#4ade80' : '#fbbf24' },
                { label: 'Loss Streak', value: `${inst?.protection?.consecutiveLosses ?? 0}`, color: (inst?.protection?.consecutiveLosses ?? 0) < 3 ? '#4ade80' : '#f87171' },
                { label: 'Range %', value: fmtPct(status.btcRangePct ?? 0), color: '#94a3b8' },
                { label: 'ATR %', value: fmtPct(status.btcAtrPct ?? 0), color: '#94a3b8' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a2540' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════ OPEN POSITIONS TABLE ═══════ */}
        <div style={{ background: '#0f1629', borderRadius: 12, padding: '18px', border: '1px solid #1a2540', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#d4a843', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Open Positions</h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              <span style={{ color: '#4ade80' }}>↑{status.longCount || 0}L</span> · <span style={{ color: '#f87171' }}>↓{status.shortCount || 0}S</span>
            </span>
          </div>

          {(status.openPositions || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#334155' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🔍</div>
              <div style={{ fontSize: 13 }}>No open positions — scanner is looking for setups</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Pair', 'Side', 'Entry', 'Current', 'SL', 'TP', 'Qty', 'P&L', 'P&L%', 'Time', 'Progress', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 8px', color: '#475569', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a2540' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(status.openPositions || []).map((pos: Position) => {
                    const pnl = pos.unrealizedPnl || 0;
                    const side = pos.side || pos.direction;
                    const isLong = side === 'LONG';
                    return (
                      <tr key={pos.symbol || pos.pair} style={{ borderBottom: '1px solid #111b30' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 600, color: '#e2e8f0' }}>{pos.symbol || pos.pair}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: isLong ? '#10b98118' : '#ef444418', color: isLong ? '#4ade80' : '#f87171' }}>{side}</span>
                        </td>
                        <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{fmt(pos.entryPrice, 4)}</td>
                        <td style={{ padding: '10px 8px', color: '#e2e8f0' }}>{fmt(pos.currentPrice, 4)}</td>
                        <td style={{ padding: '10px 8px', color: '#f87171' }}>{fmt(pos.sl || 0, 4)}</td>
                        <td style={{ padding: '10px 8px', color: '#4ade80' }}>{fmt(pos.tp || 0, 4)}</td>
                        <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{fmt(pos.qty || pos.quantity, 4)}</td>
                        <td style={{ padding: '10px 8px', color: pnlColor(pnl), fontWeight: 700 }}>{pnlSign(pnl)}{fmtUsd(pnl)}</td>
                        <td style={{ padding: '10px 8px', color: pnlColor(pos.unrealizedPnlPct) }}>{pnlSign(pos.unrealizedPnlPct)}{fmtPct(pos.unrealizedPnlPct)}</td>
                        <td style={{ padding: '10px 8px', color: '#475569', fontSize: 11 }}>{pos.durationMin}m</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ background: '#1a2540', borderRadius: 3, height: 6, width: 50, position: 'relative' }}>
                            <div style={{ background: (pos.progressPct || 0) > 0 ? '#4ade80' : '#f87171', borderRadius: 3, height: '100%', width: `${Math.min(100, Math.abs(pos.progressPct || 0))}%` }} />
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <button onClick={() => doAction(`close/${pos.symbol || pos.pair}`, `Closing ${pos.symbol || pos.pair}`)} style={{ background: '#ef444420', color: '#f87171', border: '1px solid #ef444440', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════ TRADE HISTORY (collapsible, sortable, filterable) ═══════ */}
        {(() => {
          // Computed: net PnL helper
          const tPnl = (t: TradeRecord) => t.netPnl !== undefined ? t.netPnl : t.pnlUsdt || 0;
          // Filter trades
          let filtered = [...trades];
          if (tradeFilter === 'wins') filtered = filtered.filter(t => tPnl(t) > 0);
          if (tradeFilter === 'losses') filtered = filtered.filter(t => tPnl(t) <= 0);
          if (tradePairFilter !== 'all') filtered = filtered.filter(t => t.pair === tradePairFilter);
          if (tradeDateFilter !== 'all') filtered = filtered.filter(t => (t.closeTime || '').startsWith(tradeDateFilter));
          // Sort
          filtered.sort((a, b) => {
            let av: any, bv: any;
            switch (tradeSortKey) {
              case 'closeTime': av = a.closeTime || ''; bv = b.closeTime || ''; break;
              case 'pair': av = a.pair; bv = b.pair; break;
              case 'pnlUsdt': av = tPnl(a); bv = tPnl(b); break;
              case 'pnlPct': av = a.pnlPct || 0; bv = b.pnlPct || 0; break;
              case 'side': av = a.side; bv = b.side; break;
              case 'fees': av = a.fees || 0; bv = b.fees || 0; break;
              default: av = a.closeTime || ''; bv = b.closeTime || '';
            }
            if (typeof av === 'string') return tradeSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return tradeSortDir === 'asc' ? av - bv : bv - av;
          });
          // Pagination
          const totalPages = Math.ceil(filtered.length / TRADES_PER_PAGE);
          const pageStart = tradePage * TRADES_PER_PAGE;
          const pageEnd = pageStart + TRADES_PER_PAGE;
          const paginated = filtered.slice(pageStart, pageEnd);
          // Unique pairs/dates for filters
          const uniquePairs = [...new Set(trades.map(t => t.pair))].sort();
          const uniqueDates = [...new Set(trades.map(t => (t.closeTime || '').slice(0, 10)))].sort().reverse();
          // Filtered stats
          const fWins = filtered.filter(t => tPnl(t) > 0).length;
          const fLosses = filtered.filter(t => tPnl(t) <= 0).length;
          const fPnl = filtered.reduce((s, t) => s + tPnl(t), 0);
          const fFees = filtered.reduce((s, t) => s + (t.fees || 0), 0);
          // Sort toggle
          const toggleTradeSort = (key: typeof tradeSortKey) => {
            if (tradeSortKey === key) setTradeSortDir(d => d === 'asc' ? 'desc' : 'asc');
            else { setTradeSortKey(key); setTradeSortDir('desc'); }
            setTradePage(0);
          };
          const SortTH = ({ label, sKey, w }: { label: string; sKey: typeof tradeSortKey; w?: string }) => (
            <th onClick={() => toggleTradeSort(sKey)} style={{ textAlign: 'left', padding: '8px 6px', color: tradeSortKey === sKey ? '#d4a843' : '#475569', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a2540', cursor: 'pointer', width: w, userSelect: 'none' }}>
              {label} {tradeSortKey === sKey ? (tradeSortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
          );

          return (
            <div style={{ background: '#0f1629', borderRadius: 12, border: '1px solid #1a2540', overflow: 'hidden' }}>
              <button onClick={() => setShowHistory(!showHistory)} style={{ width: '100%', background: 'transparent', border: 'none', color: '#d4a843', padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span>📋 Trade History ({trades.length} trades)</span>
                <span style={{ color: '#475569', fontSize: 16 }}>{showHistory ? '▲' : '▼'}</span>
              </button>

              {showHistory && (
                <div style={{ padding: '0 18px 18px' }}>
                  {/* Filters Row */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Win/Loss filter */}
                    {(['all', 'wins', 'losses'] as const).map(f => (
                      <button key={f} onClick={() => { setTradeFilter(f); setTradePage(0); }} style={{ background: tradeFilter === f ? (f === 'wins' ? '#10b98130' : f === 'losses' ? '#ef444430' : '#1e293b') : '#0d1320', color: tradeFilter === f ? (f === 'wins' ? '#4ade80' : f === 'losses' ? '#f87171' : '#94a3b8') : '#475569', border: `1px solid ${tradeFilter === f ? '#334155' : '#1a2540'}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize' }}>
                        {f === 'all' ? `All (${trades.length})` : f === 'wins' ? `Wins (${trades.filter(t => tPnl(t) > 0).length})` : `Losses (${trades.filter(t => tPnl(t) <= 0).length})`}
                      </button>
                    ))}
                    {/* Pair filter */}
                    <select value={tradePairFilter} onChange={e => { setTradePairFilter(e.target.value); setTradePage(0); }} style={{ background: '#0d1320', color: '#94a3b8', border: '1px solid #1a2540', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                      <option value="all">All Pairs</option>
                      {uniquePairs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {/* Date filter */}
                    <select value={tradeDateFilter} onChange={e => { setTradeDateFilter(e.target.value); setTradePage(0); }} style={{ background: '#0d1320', color: '#94a3b8', border: '1px solid #1a2540', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                      <option value="all">All Dates</option>
                      {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {/* Filter stats */}
                    <span style={{ fontSize: 11, color: '#475569', marginLeft: 'auto' }}>
                      Showing {filtered.length} trades · {fWins}W / {fLosses}L · WR {filtered.length > 0 ? ((fWins/filtered.length)*100).toFixed(1) : '0'}% · PnL <span style={{ color: pnlColor(fPnl), fontWeight: 600 }}>{pnlSign(fPnl)}{fmtUsd(fPnl)}</span>
                      {fFees > 0 && <> · Fees {fmtUsd(fFees)}</>}
                    </span>
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <SortTH label="Time" sKey="closeTime" w="130px" />
                          <SortTH label="Pair" sKey="pair" w="100px" />
                          <SortTH label="Side" sKey="side" w="60px" />
                          <th style={{ textAlign: 'left', padding: '8px 6px', color: '#475569', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1a2540' }}>Entry</th>
                          <th style={{ textAlign: 'left', padding: '8px 6px', color: '#475569', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1a2540' }}>Exit</th>
                          <th style={{ textAlign: 'left', padding: '8px 6px', color: '#475569', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1a2540' }}>Qty</th>
                          <SortTH label="Net P&L" sKey="pnlUsdt" w="85px" />
                          <SortTH label="P&L%" sKey="pnlPct" w="65px" />
                          <SortTH label="Fees" sKey="fees" w="65px" />
                          <th style={{ textAlign: 'left', padding: '8px 6px', color: '#475569', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1a2540' }}>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((t, i) => {
                          const netPnl = tPnl(t);
                          const durMs = t.closeTime && t.openTime ? new Date(t.closeTime).getTime() - new Date(t.openTime).getTime() : 0;
                          const durMin = Math.round(durMs / 60000);
                          const durStr = durMin >= 60 ? `${Math.floor(durMin/60)}h ${durMin%60}m` : `${durMin}m`;
                          return (
                            <tr key={pageStart + i} style={{ borderBottom: '1px solid #111b30', background: i % 2 === 0 ? 'transparent' : '#0a1020' }}>
                              <td style={{ padding: '8px 6px', color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>{(t.closeTime || t.openTime || '').slice(0, 16).replace('T', ' ')}</td>
                              <td style={{ padding: '8px 6px', fontWeight: 600, color: '#e2e8f0' }}>{t.pair.replace('USDT','')}</td>
                              <td style={{ padding: '8px 6px' }}>
                                <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: t.side === 'LONG' ? '#10b98118' : '#ef444418', color: t.side === 'LONG' ? '#4ade80' : '#f87171' }}>{t.side}</span>
                              </td>
                              <td style={{ padding: '8px 6px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{fmt(t.entryPrice, t.entryPrice > 100 ? 2 : 4)}</td>
                              <td style={{ padding: '8px 6px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{fmt(t.exitPrice, t.exitPrice > 100 ? 2 : 4)}</td>
                              <td style={{ padding: '8px 6px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{fmt(t.qty, t.qty > 10 ? 0 : 4)}</td>
                              <td style={{ padding: '8px 6px', color: pnlColor(netPnl), fontWeight: 700, fontFamily: 'monospace' }}>{pnlSign(netPnl)}{fmtUsd(netPnl)}</td>
                              <td style={{ padding: '8px 6px', color: pnlColor(t.pnlPct), fontFamily: 'monospace', fontSize: 11 }}>{pnlSign(t.pnlPct)}{fmtPct(t.pnlPct)}</td>
                              <td style={{ padding: '8px 6px', color: '#475569', fontFamily: 'monospace', fontSize: 11 }}>{t.fees ? fmtUsd(t.fees) : '—'}</td>
                              <td style={{ padding: '8px 6px', color: '#475569', fontSize: 11 }}>{durStr}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 0' }}>
                      <button disabled={tradePage === 0} onClick={() => setTradePage(0)} style={{ background: '#0d1320', color: tradePage === 0 ? '#1e293b' : '#94a3b8', border: '1px solid #1a2540', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: tradePage === 0 ? 'default' : 'pointer' }}>«</button>
                      <button disabled={tradePage === 0} onClick={() => setTradePage(p => p - 1)} style={{ background: '#0d1320', color: tradePage === 0 ? '#1e293b' : '#94a3b8', border: '1px solid #1a2540', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: tradePage === 0 ? 'default' : 'pointer' }}>‹</button>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Page {tradePage + 1} of {totalPages}</span>
                      <button disabled={tradePage >= totalPages - 1} onClick={() => setTradePage(p => p + 1)} style={{ background: '#0d1320', color: tradePage >= totalPages - 1 ? '#1e293b' : '#94a3b8', border: '1px solid #1a2540', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: tradePage >= totalPages - 1 ? 'default' : 'pointer' }}>›</button>
                      <button disabled={tradePage >= totalPages - 1} onClick={() => setTradePage(totalPages - 1)} style={{ background: '#0d1320', color: tradePage >= totalPages - 1 ? '#1e293b' : '#94a3b8', border: '1px solid #1a2540', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: tradePage >= totalPages - 1 ? 'default' : 'pointer' }}>»</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div style={{ textAlign: 'center', padding: '20px 0 30px', color: '#1e293b', fontSize: 11 }}>
        Astraterra Futures Pro · Institutional engines active · All systems monitored
      </div>
    </div>
  );
}
