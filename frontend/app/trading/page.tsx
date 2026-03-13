'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers, RefreshCw, TrendingUp, TrendingDown, Activity,
  DollarSign, BarChart2, Zap, AlertCircle,
  ExternalLink, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';

// ── Responsive hook ──────────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    setWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return width;
}

// ── TypeScript Interfaces ────────────────────────────────────────────────────
interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  crypto: boolean;
  gold: boolean;
}

interface ActivityEvent {
  ts: number;
  strategy: string;
  event: string;
  pnl: string;
}

// Matches real /pro/status flat API shape
interface FuturesProStatus {
  state?: string;           // 'RUNNING' | 'PAUSED'
  scanCount?: number;
  longCount?: number;
  shortCount?: number;
  currentBalance?: number;
  riskTier?: string;
  riskPerTrade?: number;
  riskPct?: number;
  btcTrend?: string;        // direction: 'BEARISH' | 'BULLISH'
  btcRegime?: string;       // regime: 'RANGING' | 'TRENDING'
  btcRangePct?: number;
  btcFlipPause?: boolean;
  exposureAlert?: { active: boolean; message?: string };
  lastScanAt?: string;
  dryRun?: boolean;
  openPositions?: Array<{
    symbol: string;
    side: string;
    entryPrice: number;
    currentPrice?: number;
    pnl?: number;
    netPnl?: number;
    openedAt?: string;
  }>;
  performance?: {
    totalTrades?: number;
    wins?: number;
    losses?: number;
    winRate?: number;        // already 0-100 (percentage)
    profitFactor?: number;
    totalPnl?: number;
    totalPnlGross?: number;
    totalFees?: number;
    dailyPnl?: number;
    dailyPnlGross?: number;
    dailyFees?: number;
    dailyTrades?: number;
    maxDrawdown?: number;
  };
  macroFilter?: {
    canTrade?: boolean;
    riskMultiplier?: number;
    regime?: string;
    reason?: string;
  };
}

// Matches real /pro/analytics flat API shape
interface FuturesProAnalytics {
  makerTrades?: number;
  takerTrades?: number;
  unknownTrades?: number;
  fillRate?: number;
  feesSaved?: number;
  pnlByPair?: Array<{pair: string; netPnl: number; fees: number; trades: number; winRate: number}>;
  recent20?: { winRate?: number; netPnl?: number; fees?: number; trades?: number; wins?: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  anomalies?: any[];
}

// Matches real funding-rate v5.0 API shape
interface FundingApiData {
  mode?: string;
  version?: string;
  scanCount?: number;
  opportunitiesFound?: number;
  readyToEnter?: number;
  opportunities?: Array<{
    symbol: string;
    aprPct: number;
    aprAbs?: number;
    fundingRate?: number;
    trend?: string;
    trendVelocity?: number;
    predicted8hYield?: number;
    betterExchange?: string | null;
    betterExchangeApr?: number | null;
    crossExchangeSignal?: boolean;
  }>;
  topOpportunity?: {
    symbol: string;
    aprPct: number;
    fundingRate?: number;
    trend?: string;
    predicted8hYield?: number;
  } | null;
  performance?: {
    totalFundingReceived?: number;
    totalFees?: number;
    netPnl?: number;
    tradesCompleted?: number;
    avgAPRCaptured?: number;
    capitalUtilization?: number;
  };
  capitalStatus?: {
    total?: number;
    deployed?: number;
    available?: number;
  };
  openPositions?: Array<{ symbol: string; aprPct?: number }>;
}

interface GoldScalperApiData {
  mode?: string;
  version?: string;
  status?: string;
  equity?: number;
  dailyPnL?: number;
  totalTrades?: number;
  paperTrades?: number;
  killSwitch?: boolean;
  consecutiveLosses?: number;
  currentSignal?: {
    action: string;
    confidence: number;
    reason: string;
    trend: string;
    rsi: number;
    currentPrice: number;
    inSession: boolean;
    sessionName: string;
  };
  openPositions?: Array<{
    symbol: string;
    side: string;
    entryPrice: number;
    size: number;
    pnl: number;
  }>;
  sessionActive?: boolean;
  sessionName?: string;
  paperStats?: {
    canGoLive: boolean;
    reason: string;
    totalPaperTrades: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// Fix React error #31: API may return anomaly objects {type,message,severity} instead of strings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anomalyStr = (a: any): string => {
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object') return a.message ?? a.type ?? JSON.stringify(a);
  return String(a ?? '');
};

const fmt$ = (n: number | null | undefined) =>
  `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function modeBadge(mode: string) {
  const isLive = mode === 'live';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
      isLive
        ? 'bg-green-500/15 text-green-400 border-green-500/20'
        : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
      {isLive ? 'LIVE' : 'DRY RUN'}
    </span>
  );
}

function statusChip(status: string) {
  const isRunning = status === 'RUNNING';
  const isPaused = status === 'PAUSED';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border" style={{
      background: isRunning ? 'rgba(74,222,128,0.1)' : isPaused ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
      borderColor: isRunning ? 'rgba(74,222,128,0.25)' : isPaused ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)',
      color: isRunning ? '#4ade80' : isPaused ? '#fbbf24' : '#f87171',
    }}>
      {status}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function MasterTradingDashboard() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;
  const isTablet = w < 1100;

  const [futuresData, setFuturesData] = useState<FuturesProStatus | null>(null);
  const [futuresAnalytics, setFuturesAnalytics] = useState<FuturesProAnalytics | null>(null);
  const [goldData, setGoldData] = useState<GoldScalperApiData | null>(null);
  const [fundingData, setFundingData] = useState<FundingApiData | null>(null);

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const role = localStorage.getItem('userRole') || 'agent';
    if (role !== 'owner') router.push('/dashboard');
  }, [router]);

  const fetchAll = useCallback(async () => {
    const newErrors: Record<string, boolean> = {};
    const ts = Date.now();

    const safe = async <T,>(url: string, key: string): Promise<T | null> => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) { newErrors[key] = true; return null; }
        return res.json() as Promise<T>;
      } catch {
        newErrors[key] = true;
        return null;
      }
    };

    const [futuresPro, futuresAn, gold, funding] = await Promise.all([
      safe<FuturesProStatus>('/futures-pro-api/status', 'futures'),
      safe<FuturesProAnalytics>('/futures-pro-api/status', 'futures_analytics'),
      safe<GoldScalperApiData>('/gold-scalper-api', 'gold'),
      safe<FundingApiData>('/funding-api/health', 'funding'),
    ]);

    setFuturesData(futuresPro);
    setFuturesAnalytics(futuresAn);
    setGoldData(gold);
    setFundingData(funding);
    setErrors(newErrors);

    // Build activity feed
    const events: ActivityEvent[] = [];

    // Inject anomaly at top if any
    if (futuresAn?.anomalies?.length) {
      events.push({
        ts,
        strategy: 'Futures Pro',
        event: '⚠️ ' + anomalyStr(futuresAn.anomalies[0]),
        pnl: 'ALERT',
      });
    }

    if (gold?.currentSignal) {
      const sig = gold.currentSignal;
      events.push({
        ts: ts - 100,
        strategy: 'Gold Scalper',
        event: `Signal: ${sig.action} · ${sig.reason ?? 'indicator confluence'}`,
        pnl: `${(sig.confidence ?? 0).toFixed(1)}% conf`,
      });
    }

    if (futuresPro?.openPositions?.length) {
      futuresPro.openPositions.forEach((pos, i) => {
        events.push({
          ts: ts - (i + 1) * 300,
          strategy: 'Futures Pro',
          event: `Open ${pos.side}: ${pos.symbol} @ ${fmt$(pos.entryPrice)}`,
          pnl: fmt$(pos.pnl ?? pos.netPnl ?? 0),
        });
      });
    }

    if (funding?.opportunities?.length) {
      const top = funding.topOpportunity ?? funding.opportunities[0];
      events.push({
        ts: ts - 1500,
        strategy: 'Funding Rate',
        event: `${top.symbol} ${(top.aprPct ?? 0).toFixed(0)}% APR detected`,
        pnl: `${(top.aprPct ?? 0).toFixed(1)}% APR`,
      });
      if (funding.opportunitiesFound && funding.opportunitiesFound > 1) {
        events.push({
          ts: ts - 2000,
          strategy: 'Funding Rate',
          event: `${funding.opportunitiesFound} opportunities found · simulated positions`,
          pnl: funding.performance?.netPnl ? fmt$(funding.performance.netPnl) : '$0.00',
        });
      }
    }

    events.sort((a, b) => b.ts - a.ts);
    setActivityFeed(events.slice(0, 8));
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch('/api/economic-calendar', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.events) setCalendarEvents(data.events);
      }
    } catch { /* silent */ } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);
  useEffect(() => {
    const t = setInterval(fetchCalendar, 30 * 60 * 1000); // refresh every 30 min
    return () => clearInterval(t);
  }, [fetchCalendar]);

  // ── Derived values — mapped from real flat API shape ─────────────────────
  const perf = futuresData?.performance;
  const btcTrend = futuresData?.btcRegime ?? '—';          // RANGING | TRENDING
  const btcDirection = futuresData?.btcTrend ?? '';        // BEARISH | BULLISH
  const liveBalance = futuresData?.currentBalance ?? 0;
  const riskTier = futuresData?.riskTier ?? 'MICRO';
  const riskTierEmoji: Record<string, string> = { MICRO: '🌱', SMALL: '📈', STANDARD: '🚀', GROWTH: '💰', SCALE: '🏦' };
  const riskEmoji = riskTierEmoji[riskTier] ?? '🌱';
  const openPositions = futuresData?.openPositions ?? [];
  const scanCount = futuresData?.scanCount ?? 0;
  const futuresStatus = futuresData?.state ?? 'UNKNOWN';
  const futuresMode = futuresData?.dryRun === false ? 'live' : 'dry-run';
  const riskPerTrade = futuresData?.riskPerTrade ?? 0;
  const riskPct = futuresData?.riskPct ?? 0;

  // Performance from nested performance object
  const totalPnlNet = perf?.totalPnl ?? 0;
  const winRate = perf?.winRate ?? 0;           // 0-100 percentage — do NOT multiply by 100
  const profitFactor = perf?.profitFactor ?? 0;
  const dailyPnl = perf?.dailyPnl ?? 0;
  const totalFees = perf?.totalFees ?? 0;
  const totalPnlGross = perf?.totalPnlGross ?? 0;
  const maxDrawdown = perf?.maxDrawdown ?? 0;
  const totalTrades = perf?.totalTrades ?? 0;

  // Daily loss computed from dailyPnl (negative means loss) + 5% limit
  const dailyLoss = Math.min(0, dailyPnl);
  const dailyLossLimit = liveBalance > 0 ? liveBalance * 0.05 : 0;

  // Anomalies from analytics (objects with {type,message,severity})
  const anomalies = futuresAnalytics?.anomalies ?? [];

  const goldMode = goldData?.mode ?? 'dry-run';
  const fundingMode = fundingData?.mode ?? 'live';
  const topFunding = fundingData?.topOpportunity ?? fundingData?.opportunities?.[0];
  const paperCount = goldData?.paperStats?.totalPaperTrades ?? goldData?.paperTrades ?? 0;
  const paperProgress = Math.min(100, (paperCount / 30) * 100);
  const canGoLive = goldData?.paperStats?.canGoLive ?? false;

  const longCount = openPositions.filter(p => p.side === 'LONG').length;
  const shortCount = openPositions.filter(p => p.side === 'SHORT').length;
  const btcTrendColor = btcTrend === 'TRENDING' ? '#4ade80' : btcTrend === 'RANGING' ? '#C9A96E' : 'rgba(255,255,255,0.5)';
  const lossPct = dailyLossLimit > 0 ? Math.min(100, (Math.abs(dailyLoss) / dailyLossLimit) * 100) : 0;

  const futuresOnline = !errors['futures'];
  const goldOnline = !errors['gold'];
  const fundingOnline = !errors['funding'];

  const lastSyncTime = lastRefresh.toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai', hour12: true, hour: '2-digit', minute: '2-digit' });

  const weekday = lastRefresh.toLocaleDateString('en-US', { timeZone: 'Asia/Dubai', weekday: 'long' });
  const isSunday = weekday === 'Sunday';
  const isSaturday = weekday === 'Saturday';
  const isWeekend = isSunday || isSaturday;
  const goldSessionActive = goldData?.sessionActive ?? false;

  // ── KPI cards data ─────────────────────────────────────────────────────────
  const kpiCards = [
    {
      label: 'Net P&L Today',
      value: fmt$(dailyPnl),
      sub: 'Futures pro net of fees',
      color: dailyPnl >= 0 ? '#4ade80' : '#f87171',
    },
    {
      label: 'Live Balance',
      value: fmt$(liveBalance),
      sub: `${riskEmoji} ${riskTier} tier`,
      color: '#C9A96E',
    },
    {
      label: 'Open Positions',
      value: String(openPositions.length),
      sub: `${shortCount} shorts / ${longCount} longs`,
      color: 'rgba(255,255,255,0.9)',
    },
    {
      label: 'Best APR',
      value: topFunding ? `${(topFunding.aprPct ?? 0).toFixed(0)}%` : '—',
      sub: topFunding?.symbol ?? '—',
      color: '#C9A96E',
    },
    {
      label: 'BTC Regime',
      value: btcTrend,
      sub: btcDirection ? `${btcDirection} · regime filter` : 'regime filter',
      color: btcTrendColor,
    },
  ];

  // ── Top 3 funding opps ─────────────────────────────────────────────────────
  const top3Funding = (fundingData?.opportunities ?? [])
    .slice()
    .sort((a, b) => (b.aprPct ?? 0) - (a.aprPct ?? 0))
    .slice(0, 3);

  const trendIcon = (trend?: string) => {
    if (!trend) return '';
    if (trend === 'UP' || trend === 'RISING') return '📈';
    if (trend === 'DOWN' || trend === 'FALLING') return '📉';
    return '➡️';
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4" style={{
      background: '#0F1623',
      fontFamily: 'Josefin Sans, sans-serif',
      paddingLeft: isMobile ? '12px' : '24px',
      paddingRight: isMobile ? '12px' : '24px',
      paddingTop: isMobile ? '12px' : '24px',
      overflowX: 'hidden',
      width: '100%',
      boxSizing: 'border-box',
    }}>

      {/* ── SECTION 1: Header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'flex-start',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {/* Left: Title */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <Layers style={{ width: 28, height: 28, color: '#C9A96E', flexShrink: 0 }} />
            <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              ⚡ Master Trading Dashboard
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginBottom: '12px' }}>
            Astraterra · 3-Bot Automated System
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>
              Last updated: {lastSyncTime}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '2px 10px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
              background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.25)', color: '#C9A96E',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              ↻ Auto 30s
            </span>
            <button
              onClick={fetchAll}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer',
                background: 'rgba(201,169,110,0.1)', color: '#C9A96E',
                border: '1px solid rgba(201,169,110,0.2)', fontFamily: 'Josefin Sans, sans-serif',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.1)')}
            >
              <RefreshCw style={{ width: 12, height: 12 }} /> Refresh Now
            </button>
          </div>
        </div>

        {/* Right: System Status Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.04))',
          border: '1px solid rgba(201,169,110,0.35)',
          borderRadius: '12px',
          padding: '14px 18px',
          flexShrink: 0,
          minWidth: isMobile ? '100%' : '200px',
        }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(201,169,110,0.7)', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'Cinzel, serif' }}>
            System Status
          </p>
          {[
            { icon: '🔺', name: 'Futures Pro', mode: futuresMode },
            { icon: '🥇', name: 'Gold Scalper', mode: goldMode },
            { icon: '💰', name: 'Funding Rate', mode: fundingMode },
          ].map(({ icon, name, mode }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>{icon} {name}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 700,
                color: mode === 'live' ? '#4ade80' : '#fbbf24',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: mode === 'live' ? '#4ade80' : '#fbbf24', display: 'inline-block' }} />
                {mode === 'live' ? 'LIVE' : 'DRY'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 2: KPI Strip ──────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {kpiCards.map(({ label, value, sub, color }) => (
          <div key={label} style={{
            background: '#141C2B', border: '1px solid rgba(201,169,110,0.12)',
            borderRadius: '12px', padding: '14px',
          }}>
            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color, fontFamily: 'Cinzel, serif', marginBottom: '4px', lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── SECTION 3: Strategy Grid (2×2) ────────────────────────────────── */}
      <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(201,169,110,0.7)', textTransform: 'uppercase', fontFamily: 'Cinzel, serif', marginBottom: '12px' }}>
        Strategy Status
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>

        {/* Card 1: Futures Pro Bot */}
        <div style={{ background: '#141C2B', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🔺</span>
              <h3 style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#fff', fontSize: '0.85rem', margin: 0 }}>Futures Pro Bot</h3>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {modeBadge(futuresMode)}
              {futuresStatus !== 'UNKNOWN' && statusChip(futuresStatus)}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: 'BTC Regime', value: btcTrend, color: btcTrendColor },
              { label: 'Positions', value: `${openPositions.length}/2`, color: '#fff' },
              { label: 'Daily P&L', value: fmt$(dailyPnl), color: dailyPnl >= 0 ? '#4ade80' : '#f87171' },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px' }}>
                <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: c, fontFamily: 'Cinzel, serif' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Performance row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginBottom: '10px' }}>
            <span>Trades: <b style={{ color: '#fff' }}>{totalTrades}</b></span>
            <span>Win: <b style={{ color: '#4ade80' }}>{winRate ? `${winRate.toFixed(1)}%` : '—'}</b></span>
            <span>PF: <b style={{ color: profitFactor >= 1 ? '#4ade80' : '#f87171' }}>{profitFactor ? profitFactor.toFixed(2) : '—'}</b></span>
            <span>Fees: <b style={{ color: '#fbbf24' }}>{fmt$(totalFees)}</b></span>
            <span>Scans: <b style={{ color: '#fff' }}>{scanCount.toLocaleString()}</b></span>
          </div>

          {/* Risk row */}
          {liveBalance > 0 && (
            <div style={{ marginBottom: '10px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
              <div style={{ marginBottom: '4px' }}>
                <span>Balance: <b style={{ color: '#C9A96E' }}>{fmt$(liveBalance)}</b></span>
                <span style={{ margin: '0 8px' }}>·</span>
                <span>{riskEmoji} <b style={{ color: '#fff' }}>{riskTier}</b></span>
                {riskPerTrade > 0 && (
                  <>
                    <span style={{ margin: '0 8px' }}>·</span>
                    <span>Risk/trade: <b style={{ color: '#fff' }}>{fmt$(riskPerTrade)} ({riskPct ? `${riskPct}%` : '—'})</b></span>
                  </>
                )}
              </div>
              {dailyLossLimit > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>Daily loss: {fmt$(dailyLoss)} / {fmt$(dailyLossLimit)} limit</span>
                    <span style={{ color: lossPct > 70 ? '#f87171' : '#fbbf24' }}>{lossPct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${lossPct}%`, background: lossPct > 70 ? '#f87171' : '#fbbf24', transition: 'width 0.5s' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {anomalies.map((a, idx) => (
                <span key={idx} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                  ⚠️ {anomalyStr(a)}
                </span>
              ))}
            </div>
          )}

          {/* Open positions mini-table */}
          {openPositions.length > 0 && (
            <div style={{ border: '1px solid rgba(201,169,110,0.12)', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ padding: '6px 12px', background: 'rgba(201,169,110,0.07)' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(201,169,110,0.7)' }}>
                  Open Positions ({openPositions.length})
                </span>
              </div>
              {openPositions.map((pos, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 12px', fontSize: '0.72rem',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                }}>
                  <span style={{ fontFamily: 'monospace', color: '#fff', fontWeight: 600 }}>{pos.symbol}</span>
                  <span style={{
                    fontWeight: 700, padding: '1px 7px', borderRadius: '4px', fontSize: '0.65rem',
                    color: pos.side === 'LONG' ? '#4ade80' : '#f87171',
                    background: pos.side === 'LONG' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                  }}>{pos.side}</span>
                  <span style={{ color: (pos.pnl ?? pos.netPnl ?? 0) >= 0 ? '#4ade80' : '#f87171', fontFamily: 'monospace' }}>
                    {fmt$(pos.pnl ?? pos.netPnl ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <a href="/futures-trend" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#C9A96E', textDecoration: 'none' }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#e8c585')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#C9A96E')}>
            <ExternalLink style={{ width: 12, height: 12 }} /> Open Full Dashboard →
          </a>
        </div>

        {/* Card 2: Gold Scalper */}
        <div style={{
          background: 'linear-gradient(135deg, #141C2B 0%, rgba(201,169,110,0.06) 100%)',
          border: '1px solid rgba(201,169,110,0.4)', borderRadius: '14px', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🥇</span>
              <h3 style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#fff', fontSize: '0.85rem', margin: 0 }}>Gold Scalper</h3>
            </div>
            {modeBadge(goldMode)}
          </div>

          {/* Market status chip */}
          {(isWeekend || !goldSessionActive) && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '10px',
              padding: '4px 12px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171',
            }}>
              🔴 XAU/USD Market: CLOSED {isWeekend ? `(${weekday})` : '(Outside Session)'}
            </div>
          )}

          {/* Paper stats in 3 boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: 'Win Rate', value: goldData?.paperStats?.winRate != null ? `${(goldData.paperStats.winRate * 100).toFixed(1)}%` : '—', color: '#4ade80' },
              { label: 'Profit Factor', value: goldData?.paperStats?.profitFactor?.toFixed(2) ?? '—', color: (goldData?.paperStats?.profitFactor ?? 0) >= 1 ? '#4ade80' : '#fbbf24' },
              { label: 'Max DD', value: goldData?.paperStats?.maxDrawdown ? `${(goldData.paperStats.maxDrawdown * 100).toFixed(1)}%` : '—', color: '#f87171' },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px' }}>
                <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: c, fontFamily: 'Cinzel, serif' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Current signal */}
          {goldData?.currentSignal && (
            <div style={{ background: 'rgba(201,169,110,0.07)', borderLeft: '3px solid #C9A96E', borderRadius: '0 8px 8px 0', padding: '10px 12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Current Signal</span>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>{(goldData.currentSignal.confidence ?? 0).toFixed(1)}% conf</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>{goldData.currentSignal.action}</span>
                {goldData.currentSignal.inSession && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: '#C9A96E' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                    {goldData.currentSignal.sessionName}
                  </span>
                )}
              </div>
              {goldData.currentSignal.reason && (
                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>{goldData.currentSignal.reason}</p>
              )}
            </div>
          )}

          {/* Paper trade progress */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.72rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{paperCount}/30 paper trades ({paperProgress.toFixed(0)}%)</span>
              <span style={{ color: canGoLive ? '#4ade80' : '#fbbf24', fontWeight: 700 }}>
                Live gate: {canGoLive ? 'YES ✓' : 'NO'}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, width: `${paperProgress}%`, transition: 'width 0.5s',
                background: canGoLive ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#C9A96E,#8A6F2F)',
              }} />
            </div>
            <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', marginTop: '3px' }}>
              {goldData?.paperStats?.reason ?? `${Math.max(0, 30 - paperCount)} more trades needed`}
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginBottom: '12px' }}>
            <span>Session: <b style={{ color: '#fff' }}>{goldData?.sessionActive ? goldData.sessionName ?? 'Active' : 'Outside Hours'}</b></span>
            <span>Equity: <b style={{ color: '#C9A96E' }}>{fmt$(goldData?.equity ?? 1000)}</b></span>
            <span>Version: <b style={{ color: '#C9A96E' }}>{goldData?.version ?? 'v2.0'}</b></span>
          </div>

          <a href="/gold-binance" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#C9A96E', textDecoration: 'none' }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#e8c585')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#C9A96E')}>
            <ExternalLink style={{ width: 12, height: 12 }} /> Open Full Dashboard →
          </a>
        </div>

        {/* Card 3: Funding Rate Arb */}
        <div style={{ background: '#141C2B', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>💰</span>
              <h3 style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#fff', fontSize: '0.85rem', margin: 0 }}>Funding Rate Arb</h3>
            </div>
            {modeBadge(fundingMode)}
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px', marginBottom: '14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px' }}>
              <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Best APR Today</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#C9A96E', fontFamily: 'Cinzel, serif' }}>
                {topFunding ? `${(topFunding.aprPct ?? 0).toFixed(1)}%` : '—'}
              </p>
              <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{topFunding?.symbol ?? '—'}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px' }}>
              <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Opportunities</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', fontFamily: 'Cinzel, serif' }}>
                {fundingData?.opportunitiesFound ?? 0} found
              </p>
              <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Net PnL: {fmt$(fundingData?.performance?.netPnl ?? 0)}</p>
            </div>
          </div>

          {/* Top 3 opportunities */}
          {top3Funding.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(201,169,110,0.5)', marginBottom: '8px' }}>Top Opportunities</p>
              {top3Funding.map((opp, i) => (
                <div key={opp.symbol} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', fontSize: '0.72rem',
                  background: i === 0 ? 'rgba(201,169,110,0.07)' : 'transparent',
                  borderRadius: '6px', marginBottom: '4px',
                }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>{opp.symbol}</span>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>{(opp.aprPct ?? 0).toFixed(2)}%</span>
                  <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '999px', fontWeight: 600,
                    background: (opp.aprPct ?? 0) > 5 ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
                    color: (opp.aprPct ?? 0) > 5 ? '#4ade80' : '#fbbf24',
                  }}>
                    {(opp.aprPct ?? 0) > 5 ? '●WATCH' : '●LOW'}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{opp.trend ? trendIcon(opp.trend) : ''} {opp.predicted8hYield ? `8h: ${((opp.predicted8hYield ?? 0) * 100).toFixed(4)}%` : `${(opp.aprPct ?? 0).toFixed(1)}% APR`}</span>
                </div>
              ))}
            </div>
          )}

          <a href="/funding-rate" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#C9A96E', textDecoration: 'none' }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#e8c585')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#C9A96E')}>
            <ExternalLink style={{ width: 12, height: 12 }} /> Open Full Dashboard →
          </a>
        </div>

        {/* Card 4: System Health */}
        <div style={{ background: '#141C2B', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>🖥️</span>
            <h3 style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#fff', fontSize: '0.85rem', margin: 0 }}>System Health</h3>
          </div>

          {/* Bot health indicators */}
          <div style={{ marginBottom: '16px' }}>
            {[
              { name: 'Futures Pro Bot', online: futuresOnline },
              { name: 'Gold Scalper', online: goldOnline },
              { name: 'Funding Rate Arb', online: fundingOnline },
              { name: 'CRM Backend', online: true },
            ].map(({ name, online }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', background: online ? '#4ade80' : '#f87171', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{name}</span>
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: online ? '#4ade80' : '#f87171' }}>
                  {online ? '✅ ONLINE' : '⚠️ ERROR'}
                </span>
              </div>
            ))}
          </div>

          {/* Active Alerts */}
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(201,169,110,0.5)', marginBottom: '8px' }}>Active Alerts</p>
            {anomalies.length === 0 && !Object.keys(errors).length ? (
              <p style={{ fontSize: '0.72rem', color: '#4ade80' }}>✓ No active alerts</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {anomalies.map((a, idx) => (
                  <span key={idx} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', display: 'inline-block' }}>
                    ⚠️ {anomalyStr(a)}
                  </span>
                ))}
                {Object.keys(errors).map(k => (
                  <span key={k} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', display: 'inline-block' }}>
                    ❌ {k} API error
                  </span>
                ))}
              </div>
            )}
          </div>

          <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)' }}>Last full sync: {lastSyncTime} Dubai</p>
        </div>

      </div>{/* end Strategy Grid */}

      {/* ── SECTION 4: Two-column Activity + Performance ───────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '60% 1fr',
        gap: '16px',
        marginBottom: '24px',
      }}>

        {/* Left: Live Activity Feed */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(201,169,110,0.7)', textTransform: 'uppercase', fontFamily: 'Cinzel, serif' }}>
              Live Activity Feed
            </p>
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>↻ Refreshes every 30s</span>
          </div>
          <div style={{ background: '#141C2B', border: '1px solid rgba(201,169,110,0.12)', borderRadius: '12px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                <RefreshCw style={{ width: 20, height: 20, color: '#C9A96E', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : activityFeed.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px' }}>
                <Clock style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.2)' }} />
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>No events yet — bots are warming up</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '280px', overflowY: 'auto' }}>
                <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0F1623' }}>
                      {['Time', 'Strategy', 'Event', 'Value'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activityFeed.map((ev, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '8px 14px', fontSize: '0.65rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(ev.ts).toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600,
                            background: ev.strategy.includes('Futures') ? 'rgba(99,102,241,0.12)' : ev.strategy.includes('Gold') ? 'rgba(201,169,110,0.15)' : 'rgba(234,179,8,0.12)',
                            color: ev.strategy.includes('Futures') ? '#818cf8' : ev.strategy.includes('Gold') ? '#C9A96E' : '#fbbf24',
                          }}>{ev.strategy}</span>
                        </td>
                        <td style={{ padding: '8px 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>{ev.event}</td>
                        <td style={{ padding: '8px 14px', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700,
                          color: ev.pnl === 'ALERT' ? '#f87171' : ev.pnl.startsWith('$') && ev.pnl.includes('-') ? '#f87171' : ev.pnl.startsWith('$') ? '#4ade80' : '#C9A96E',
                        }}>{ev.pnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Performance Summary */}
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(201,169,110,0.7)', textTransform: 'uppercase', fontFamily: 'Cinzel, serif', marginBottom: '10px' }}>
            Performance Summary
          </p>
          <div style={{ background: '#141C2B', border: '1px solid rgba(201,169,110,0.12)', borderRadius: '12px', padding: '16px' }}>
            {/* Futures Pro */}
            <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔺 Futures Pro (net of fees)</p>
            {[
              { label: 'Total P&L', value: fmt$(totalPnlNet), color: totalPnlNet >= 0 ? '#4ade80' : '#f87171' },
              { label: 'Total Fees', value: fmt$(totalFees), color: '#fbbf24' },
              { label: 'Gross P&L', value: fmt$(totalPnlGross), color: 'rgba(255,255,255,0.8)' },
              { label: 'Max Drawdown', value: maxDrawdown ? `${fmt$(maxDrawdown)} (${liveBalance > 0 ? ((maxDrawdown/liveBalance)*100).toFixed(1) : '0'}%)` : '—', color: maxDrawdown > 1.5 ? '#f87171' : 'rgba(255,255,255,0.6)' },
              { label: 'Profit Factor', value: profitFactor ? profitFactor.toFixed(2) : '—', color: profitFactor > 1 ? '#4ade80' : '#f87171' },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '5px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                <span style={{ color: c, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
              </div>
            ))}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

            {/* Funding Rate */}
            <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>💰 Funding Rate</p>
            {[
              { label: 'Avg APR Captured', value: fundingData?.performance?.avgAPRCaptured ? `${(fundingData.performance.avgAPRCaptured).toFixed(1)}%` : '—', color: '#4ade80' },
              { label: 'Net PnL', value: fmt$(fundingData?.performance?.netPnl ?? 0), color: (fundingData?.performance?.netPnl ?? 0) >= 0 ? '#4ade80' : '#f87171' },
              { label: 'Trades Done', value: `${fundingData?.performance?.tradesCompleted ?? 0}`, color: '#fff' },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '5px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                <span style={{ color: c, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
              </div>
            ))}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

            {/* Gold Scalper */}
            <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🥇 Gold Scalper</p>
            {[
              { label: 'Paper Trades', value: `${paperCount}/30`, color: '#fff' },
              { label: 'Can Go Live', value: canGoLive ? 'YES ✓' : 'NO', color: canGoLive ? '#4ade80' : '#f87171' },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '5px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                <span style={{ color: c, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 5: Quick Navigation ────────────────────────────────────── */}
      <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(201,169,110,0.7)', textTransform: 'uppercase', fontFamily: 'Cinzel, serif', marginBottom: '12px' }}>
        Quick Navigation
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
        gap: '12px',
        marginBottom: '32px',
      }}>
        {[
          { icon: '🔺', label: 'Futures Pro Details', href: '/futures-trend', sub: 'Open positions · performance · risk' },
          { icon: '🥇', label: 'Gold Scalper Details', href: '/gold-binance', sub: 'Paper trades · signal engine · session' },
          { icon: '💰', label: 'Funding Rate Details', href: '/funding-rate', sub: 'Opportunities · APR scanner · simulator' },
          { icon: '📊', label: 'Business Analytics', href: '/reports', sub: 'Revenue · clients · property reports' },
        ].map(({ icon, label, href, sub }) => (
          <a key={label} href={href} style={{
            display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px 16px',
            borderRadius: '12px', border: '1px solid rgba(201,169,110,0.25)',
            background: 'transparent', color: '#C9A96E', textDecoration: 'none', transition: 'all 0.2s',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(201,169,110,0.08)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(201,169,110,0.5)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(201,169,110,0.25)';
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>{icon}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Cinzel, serif' }}>{label}</span>
            </div>
            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{sub}</p>
          </a>
        ))}
      </div>

      {/* ── SECTION 6: Economic Calendar ───────────────────────────────────── */}
      {(() => {
        const now = new Date();
        const dubaiOffset = 4 * 60; // UTC+4
        const dubaiNow = new Date(now.getTime() + dubaiOffset * 60000);

        // Parse event datetime → Date object
        const parseEventDate = (date: string, time: string): Date | null => {
          try {
            // FF format: date = "03-10-2026", time = "8:30am" or "All Day"
            if (!time || time === 'All Day' || time === 'Tentative') return null;
            const [mon, day, yr] = date.split('-');
            const parsed = new Date(`${yr}-${mon}-${day} ${time}`);
            return isNaN(parsed.getTime()) ? null : parsed;
          } catch { return null; }
        };

        // Format time to Dubai
        const fmtDubai = (date: string, time: string): string => {
          const d = parseEventDate(date, time);
          if (!d) return time ?? '—';
          const dubaiMs = d.getTime() + dubaiOffset * 60000;
          const dd = new Date(dubaiMs);
          const h = dd.getUTCHours();
          const m = dd.getUTCMinutes().toString().padStart(2, '0');
          const ampm = h >= 12 ? 'PM' : 'AM';
          return `${((h % 12) || 12)}:${m} ${ampm}`;
        };

        const fmtDateLabel = (date: string): string => {
          try {
            const [mon, day, yr] = date.split('-');
            const d = new Date(`${yr}-${mon}-${day}`);
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          } catch { return date; }
        };

        const isToday = (date: string): boolean => {
          try {
            const [mon, day, yr] = date.split('-');
            const d = new Date(`${yr}-${mon}-${day}`);
            const t = new Date(dubaiNow.getUTCFullYear(), dubaiNow.getUTCMonth(), dubaiNow.getUTCDate());
            return d.toDateString() === t.toDateString();
          } catch { return false; }
        };

        const isTomorrow = (date: string): boolean => {
          try {
            const [mon, day, yr] = date.split('-');
            const d = new Date(`${yr}-${mon}-${day}`);
            const t = new Date(dubaiNow.getUTCFullYear(), dubaiNow.getUTCMonth(), dubaiNow.getUTCDate() + 1);
            return d.toDateString() === t.toDateString();
          } catch { return false; }
        };

        const isUpcoming = (date: string, time: string): boolean => {
          const d = parseEventDate(date, time);
          if (!d) return false;
          const diff = d.getTime() - now.getTime();
          return diff > 0 && diff < 2 * 60 * 60 * 1000; // within 2 hours
        };

        // Group events by date
        const grouped: Record<string, CalendarEvent[]> = {};
        calendarEvents.forEach(ev => {
          if (!grouped[ev.date]) grouped[ev.date] = [];
          grouped[ev.date].push(ev);
        });

        const sortedDates = Object.keys(grouped).sort((a, b) => {
          const [am, ad, ay] = a.split('-'); const [bm, bd, by] = b.split('-');
          return new Date(`${ay}-${am}-${ad}`).getTime() - new Date(`${by}-${bm}-${bd}`).getTime();
        });

        return (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(201,169,110,0.7)', textTransform: 'uppercase', fontFamily: 'Cinzel, serif', margin: 0 }}>
                📅 Economic Calendar — Crypto &amp; Gold Market Events
              </p>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)' }}>
                Source: Forex Factory · USD &amp; EUR · High &amp; Medium Impact · Dubai time (GMT+4) · ↻ 30 min
              </span>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              {[
                { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: '🔴 High Impact' },
                { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', label: '🟡 Medium Impact' },
                { color: '#C9A96E', bg: 'rgba(201,169,110,0.12)', label: '₿ Affects Crypto' },
                { color: '#d4af37', bg: 'rgba(212,175,55,0.12)', label: '🥇 Affects Gold' },
              ].map(({ color, bg, label }) => (
                <span key={label} style={{ fontSize: '0.62rem', padding: '2px 9px', borderRadius: '999px', background: bg, color, border: `1px solid ${color}40` }}>{label}</span>
              ))}
            </div>

            {calendarLoading ? (
              <div style={{ background: '#141C2B', border: '1px solid rgba(201,169,110,0.12)', borderRadius: '12px', padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>
                ⏳ Loading economic calendar…
              </div>
            ) : calendarEvents.length === 0 ? (
              <div style={{ background: '#141C2B', border: '1px solid rgba(201,169,110,0.12)', borderRadius: '12px', padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>
                📭 No high-impact events found for this week — or calendar API is unavailable.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedDates.map(date => (
                  <div key={date} style={{ background: '#141C2B', border: `1px solid ${isToday(date) ? 'rgba(201,169,110,0.4)' : 'rgba(201,169,110,0.12)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                    {/* Date header */}
                    <div style={{
                      padding: '8px 16px',
                      background: isToday(date) ? 'rgba(201,169,110,0.12)' : isTomorrow(date) ? 'rgba(255,255,255,0.03)' : '#0F1623',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.78rem', color: isToday(date) ? '#C9A96E' : 'rgba(255,255,255,0.5)' }}>
                        {fmtDateLabel(date)}
                      </span>
                      {isToday(date) && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 8px', borderRadius: '999px', background: 'rgba(201,169,110,0.2)', border: '1px solid rgba(201,169,110,0.4)', color: '#C9A96E' }}>TODAY</span>
                      )}
                      {isTomorrow(date) && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>TOMORROW</span>
                      )}
                      <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)' }}>{grouped[date].length} events</span>
                    </div>

                    {/* Events rows */}
                    <div>
                      {grouped[date].map((ev, i) => {
                        const upcoming = isUpcoming(ev.date, ev.time);
                        const hasActual = ev.actual && ev.actual !== '';
                        return (
                          <div key={i} style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '52px 1fr' : '64px 22px 1fr auto auto auto',
                            gap: isMobile ? '8px' : '12px',
                            alignItems: 'center',
                            padding: isMobile ? '10px 14px' : '9px 16px',
                            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                            background: upcoming ? 'rgba(251,191,36,0.04)' : 'transparent',
                            transition: 'background 0.15s',
                          }}>
                            {/* Time (Dubai) */}
                            <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: upcoming ? '#fbbf24' : 'rgba(255,255,255,0.4)', fontWeight: upcoming ? 700 : 400 }}>
                              {upcoming && <span style={{ marginRight: 4 }}>⚡</span>}
                              {fmtDubai(ev.date, ev.time)}
                            </span>

                            {/* Country flag (non-mobile) */}
                            {!isMobile && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: ev.country === 'USD' ? '#60a5fa' : '#a78bfa', textAlign: 'center' }}>
                                {ev.country === 'USD' ? '🇺🇸' : '🇪🇺'}
                              </span>
                            )}

                            {/* Event name + tags */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                              <span style={{ fontSize: '0.75rem', color: hasActual ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)', fontWeight: hasActual ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '180px' : '320px' }}>
                                {ev.title}
                              </span>
                              {ev.crypto && <span title="Affects crypto" style={{ fontSize: '0.6rem', padding: '0 5px', borderRadius: '4px', background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)', flexShrink: 0 }}>₿</span>}
                              {ev.gold && <span title="Affects gold" style={{ fontSize: '0.6rem', padding: '0 5px', borderRadius: '4px', background: 'rgba(212,175,55,0.12)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.2)', flexShrink: 0 }}>🥇</span>}
                              {isMobile && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: ev.country === 'USD' ? '#60a5fa' : '#a78bfa' }}>{ev.country}</span>}
                            </div>

                            {/* Impact badge (non-mobile) */}
                            {!isMobile && (
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', flexShrink: 0,
                                background: ev.impact === 'High' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.1)',
                                color: ev.impact === 'High' ? '#f87171' : '#fbbf24',
                                border: `1px solid ${ev.impact === 'High' ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.2)'}`,
                              }}>
                                {ev.impact === 'High' ? '🔴 High' : '🟡 Med'}
                              </span>
                            )}

                            {/* Forecast / Previous (non-mobile) */}
                            {!isMobile && (
                              <div style={{ display: 'flex', gap: '10px', fontSize: '0.65rem', flexShrink: 0, textAlign: 'right' }}>
                                {ev.forecast && <span style={{ color: 'rgba(255,255,255,0.3)' }}>F: <b style={{ color: 'rgba(255,255,255,0.55)' }}>{ev.forecast}</b></span>}
                                {ev.previous && <span style={{ color: 'rgba(255,255,255,0.25)' }}>P: <b style={{ color: 'rgba(255,255,255,0.4)' }}>{ev.previous}</b></span>}
                              </div>
                            )}

                            {/* Actual (non-mobile) */}
                            {!isMobile && (
                              <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '48px' }}>
                                {hasActual ? (
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                                    background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)',
                                  }}>
                                    ✓ {ev.actual}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)' }}>Pending</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Error Notice */}
      {Object.keys(errors).length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', fontSize: '0.72rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(255,150,150,0.8)' }}>
          <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span>Some APIs didn&apos;t respond: {Object.keys(errors).join(', ')} — bots may be starting up</span>
        </div>
      )}

      <p style={{ textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)', marginTop: '8px' }}>
        Astraterra Master Trading Orchestrator · 3-Bot System · Managed by PM2
      </p>
    </div>
  );
}
