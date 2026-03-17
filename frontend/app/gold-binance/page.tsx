'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Flame,
  Shield,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';

function StatRow({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-700/40 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  valueClass = 'text-white',
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-slate-900 border rounded-xl p-5 flex flex-col gap-2 transition-colors ${highlight ? 'border-amber-500/40 hover:border-amber-500/60' : 'border-slate-700/60 hover:border-slate-600/80'}`}>
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">{label}</p>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className={`text-3xl font-bold tracking-tight ${valueClass}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs">{sub}</p>}
    </div>
  );
}

function HealthBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className={score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'}>{score}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h'];

export default function GoldBinanceDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTf, setSelectedTf] = useState('5m');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      setError(null);
      const response = await fetch('/gold-scalper-api/status');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isRunning = data?.status === 'RUNNING';
  const isDryRun = data?.mode === 'DRY_RUN';
  const equity = data?.equity ?? 0;
  const dailyPnL = data?.dailyPnL ?? 0;
  const dailyPnLPct = data?.dailyPnLPct ?? 0;
  const perf = data?.performance ?? data?.paperStats ?? {};
  const totalTrades = perf.totalPaperTrades ?? perf.totalTrades ?? data?.totalTrades ?? 0;
  const winRate = perf.winRate ?? data?.winRate ?? 0;
  const profitFactor = perf.profitFactor ?? data?.pf ?? 0;
  const totalPnl = perf.totalPnl ?? data?.totalPnL ?? 0;
  const maxDrawdown = perf.maxDrawdown ?? 0;
  const killSwitchActive = data?.killSwitchActive ?? false;
  const killSwitchReason = data?.killSwitchReason ?? '';
  const consecutiveLosses = data?.consecutiveLosses ?? 0;
  const consecutiveWins = data?.consecutiveWins ?? 0;
  const todayTrades = data?.todayTrades ?? 0;
  const maxDailyTrades = data?.maxDailyTrades ?? 12;
  const todayMaxReached = data?.todayMaxReached ?? false;
  const healthScore = data?.healthScore ?? 0;
  const healthRating = data?.healthRating ?? 'UNKNOWN';
  const healthBreakdown = data?.healthBreakdown ?? {};
  const liveGate = data?.liveGateStatus ?? {};
  const macro = data?.macroFilter ?? {};
  const session = data?.session ?? 'UNKNOWN';
  const sessionAllowed = data?.sessionAllowed ?? false;
  const regime4h = data?.regime4h ?? data?.regime ?? '—';
  const bias1h = data?.bias1h ?? data?.htfBias ?? '—';
  const biasConfidence = data?.biasConfidence ?? 0;
  const pause = data?.pauseInfo ?? {};

  const healthColor = healthScore >= 70 ? 'text-green-400' : healthScore >= 40 ? 'text-yellow-400' : 'text-red-400';
  const healthBg = healthScore >= 70 ? 'border-green-500/30 bg-green-500/8' : healthScore >= 40 ? 'border-yellow-500/30 bg-yellow-500/8' : 'border-red-500/30 bg-red-500/8';

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Flame className="w-10 h-10 text-amber-500 animate-pulse mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Connecting to Gold Scalper v2.1...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-screen-2xl mx-auto px-6 py-6">

        {/* ── HEADER ── */}
        <div className="flex flex-col gap-3 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Flame className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  🔥 Gold Scalper v{data?.version ?? '2.1'}
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  XAUUSDT × {data?.leverage ?? 10}x • New York Session
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Online/Offline */}
              {isRunning ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-semibold">
                  <Wifi className="w-3 h-3" />
                  ONLINE
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold">
                  <WifiOff className="w-3 h-3" />
                  OFFLINE
                </div>
              )}

              {/* Mode */}
              {isDryRun ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-semibold">
                  🟡 DRY RUN
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                  🟢 LIVE
                </div>
              )}

              {/* Session */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${sessionAllowed ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-slate-600/30 bg-slate-800/50 text-slate-500'}`}>
                🕐 {session}
              </div>

              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/5 text-amber-400 text-xs font-semibold transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Sub-info row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Last update: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
            </span>
            <span>
              4H Regime:{' '}
              <span className={regime4h === 'TREND' ? 'text-green-400' : regime4h === 'RANGING' ? 'text-yellow-400' : 'text-slate-400'}>
                {regime4h}
              </span>
            </span>
            <span>
              1H Bias:{' '}
              <span className={bias1h.includes('BULLISH') ? 'text-green-400' : bias1h.includes('BEARISH') ? 'text-red-400' : 'text-slate-400'}>
                {bias1h}
              </span>
              {biasConfidence > 0 && <span className="text-slate-600 ml-1">({biasConfidence}%)</span>}
            </span>
            {macro.regime && (
              <span>Macro: <span className="text-slate-400">{macro.regime}</span></span>
            )}
          </div>
        </div>

        {/* ── ALERTS ── */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/8 border border-red-500/25 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold text-sm">API Error</p>
              <p className="text-red-300/80 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {killSwitchActive && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-red-400 font-bold text-sm">⚠ KILL SWITCH ACTIVE — Trading Halted</p>
              <p className="text-red-300/70 text-xs mt-0.5">
                {killSwitchReason || `${consecutiveLosses} consecutive losses`} — No new trades until reset
              </p>
            </div>
          </div>
        )}

        {pause?.paused && (
          <div className="mb-4 p-4 rounded-xl bg-orange-500/8 border border-orange-500/25 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-400 font-semibold text-sm">Bot Paused</p>
              <p className="text-orange-300/70 text-xs mt-0.5">{pause.reason ?? 'Manual pause'}</p>
            </div>
          </div>
        )}

        {todayMaxReached && (
          <div className="mb-4 p-4 rounded-xl bg-yellow-500/8 border border-yellow-500/25 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-semibold text-sm">Daily Trade Limit Reached ({maxDailyTrades})</p>
              <p className="text-yellow-300/70 text-xs mt-0.5">No new trades until tomorrow's session.</p>
            </div>
          </div>
        )}

        {macro.reason && macro.riskMultiplier < 1 && (
          <div className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center gap-3">
            <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-slate-400 text-xs">
              <span className="text-slate-300 font-semibold">Macro Filter:</span> {macro.reason} • Risk multiplier: {(macro.riskMultiplier * 100).toFixed(0)}%
            </p>
          </div>
        )}

        {/* ── TOP METRICS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Equity"
            value={`$${equity.toFixed(2)}`}
            sub={isDryRun ? 'paper USDT' : 'live USDT'}
            highlight
            icon={<Flame className="w-4 h-4 text-amber-500/60" />}
          />
          <MetricCard
            label="Total Trades"
            value={String(totalTrades)}
            sub={`Today: ${todayTrades} / ${maxDailyTrades}`}
            icon={<BarChart2 className="w-4 h-4" />}
          />
          <MetricCard
            label="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            sub={`PF: ${profitFactor.toFixed(2)}`}
            valueClass={winRate >= 50 ? 'text-green-400' : 'text-red-400'}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <MetricCard
            label="Daily P&L"
            value={`${dailyPnL >= 0 ? '+' : ''}$${dailyPnL.toFixed(2)}`}
            sub={`${dailyPnLPct >= 0 ? '+' : ''}${dailyPnLPct.toFixed(2)}%`}
            valueClass={dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}
            icon={dailyPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          />
        </div>

        {/* ── CHART SECTION ── */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-500/60" />
              <h2 className="text-sm font-semibold text-slate-200">
                Live Chart — XAUUSDT {selectedTf} Scalp
              </h2>
              <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">GOLD</span>
            </div>
            <div className="flex gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTf(tf)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                    selectedTf === tf
                      ? 'bg-amber-600/40 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* TradingView Widget */}
          <div className="rounded-lg h-[420px] border border-slate-700/40 overflow-hidden">
            <iframe
              key={`XAUUSDT-${selectedTf}`}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_chart_gold&symbol=BINANCE%3AXAUUSDT.P&interval=${selectedTf === '1m' ? '1' : selectedTf === '5m' ? '5' : selectedTf === '15m' ? '15' : '60'}&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=0f172a&studies=%5B%5D&theme=dark&style=1&timezone=Asia%2FDubai&withdateranges=1&showpopupbutton=0&locale=en&utm_source=crm.astraterra.ae`}
              className="w-full h-full"
              frameBorder="0"
              allowFullScreen
            />
          </div>
        </div>

        {/* ── DETAIL SECTION (3 columns) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

          {/* Performance */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-amber-500/70" />
              <h3 className="text-sm font-semibold text-slate-200">Performance</h3>
            </div>
            <div className="space-y-0">
              <StatRow label="Total Trades" value={String(totalTrades)} />
              <StatRow
                label="Win Rate"
                value={`${winRate.toFixed(1)}%`}
                valueClass={winRate >= 50 ? 'text-green-400' : 'text-red-400'}
              />
              <StatRow
                label="Profit Factor"
                value={profitFactor.toFixed(2)}
                valueClass={profitFactor >= 1.3 ? 'text-green-400' : profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}
              />
              <StatRow
                label="Total P&L"
                value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
                valueClass={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}
              />
              <StatRow
                label="Max Drawdown"
                value={`${maxDrawdown.toFixed(2)}%`}
                valueClass={maxDrawdown > 5 ? 'text-red-400' : maxDrawdown > 2 ? 'text-yellow-400' : 'text-white'}
              />
            </div>
          </div>

          {/* Account */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Account</h3>
            </div>
            <div className="space-y-0">
              <StatRow label="Equity" value={`$${equity.toFixed(2)}`} />
              <StatRow label="Available" value={`$${equity.toFixed(2)}`} />
              <StatRow label="Leverage" value={`${data?.leverage ?? 10}×`} />
              <StatRow
                label="Risk / Trade"
                value={data?.adaptiveRiskPct ? `${(data.adaptiveRiskPct * 100).toFixed(2)}%` : '0.5%'}
              />
              <StatRow label="Today's Trades" value={`${todayTrades} / ${maxDailyTrades}`} />
            </div>
          </div>

          {/* Risk Management */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-400/70" />
              <h3 className="text-sm font-semibold text-slate-200">Risk Management</h3>
            </div>
            <div className="space-y-0">
              <StatRow
                label="Consecutive Losses"
                value={String(consecutiveLosses)}
                valueClass={consecutiveLosses >= 4 ? 'text-red-400' : consecutiveLosses >= 2 ? 'text-yellow-400' : 'text-white'}
              />
              <StatRow
                label="Consecutive Wins"
                value={String(consecutiveWins)}
                valueClass={consecutiveWins > 0 ? 'text-green-400' : 'text-white'}
              />
              <StatRow label="Daily Loss Limit" value="-2.5%" />
              <StatRow label="Max Daily Trades" value={String(maxDailyTrades)} />
              <StatRow
                label="Kill Switch"
                value={killSwitchActive ? 'ACTIVE' : 'OK'}
                valueClass={killSwitchActive ? 'text-red-400' : 'text-green-400'}
              />
            </div>
          </div>
        </div>

        {/* ── HEALTH SCORE + LIVE GATE ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

          {/* Health Score */}
          <div className={`border rounded-xl p-5 ${healthBg}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-200">Bot Health</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${healthScore >= 70 ? 'bg-green-500/15 text-green-400' : healthScore >= 40 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
                  {healthRating}
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              {Object.entries(healthBreakdown).map(([key, val]: [string, any]) => (
                <HealthBar key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} score={Number(val)} />
              ))}
            </div>
          </div>

          {/* Live Gate */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-500/70" />
              <h3 className="text-sm font-semibold text-slate-200">Live Gate Status</h3>
              {liveGate.canGoLive ? (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> READY
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-red-400 font-semibold">
                  <XCircle className="w-3.5 h-3.5" /> NOT READY
                </span>
              )}
            </div>

            {isDryRun && (
              <p className="text-xs text-slate-500 mb-4">
                {perf.reason ?? data?.paperStats?.reason ?? 'Running in paper mode — monitoring performance before live activation.'}
              </p>
            )}

            <div className="space-y-0">
              <StatRow
                label="Profit Factor"
                value={`${(liveGate.profitFactor ?? profitFactor).toFixed(2)} / 1.30`}
                valueClass={(liveGate.profitFactor ?? profitFactor) >= 1.3 ? 'text-green-400' : 'text-red-400'}
              />
              <StatRow
                label="Win Rate"
                value={`${(liveGate.winRate ?? winRate).toFixed(1)}% / 50%`}
                valueClass={(liveGate.winRate ?? winRate) >= 50 ? 'text-green-400' : 'text-red-400'}
              />
              <StatRow
                label="Max Drawdown"
                value={`${(liveGate.drawdown ?? maxDrawdown).toFixed(2)}% / 5%`}
                valueClass={(liveGate.drawdown ?? maxDrawdown) <= 5 ? 'text-green-400' : 'text-red-400'}
              />
            </div>
          </div>
        </div>

        {/* ── MARKET CONTEXT ── */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Market Context</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">4H Regime</p>
              <p className={`text-sm font-bold ${regime4h === 'TREND' ? 'text-green-400' : regime4h === 'RANGING' ? 'text-yellow-400' : 'text-slate-400'}`}>
                {regime4h}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">1H Bias</p>
              <p className={`text-sm font-bold ${bias1h.includes('BULLISH') ? 'text-green-400' : bias1h.includes('BEARISH') ? 'text-red-400' : 'text-slate-400'}`}>
                {bias1h}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">ATR 5m</p>
              <p className="text-sm font-bold text-white">${data?.atr1m?.toFixed(2) ?? data?.atr5?.toFixed(2) ?? '—'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Fear & Greed</p>
              <p className={`text-sm font-bold ${(macro.fearGreed?.value ?? 50) >= 50 ? 'text-green-400' : (macro.fearGreed?.value ?? 50) >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                {macro.fearGreed?.value ?? '—'}{' '}
                <span className="text-xs font-normal text-slate-500">{macro.fearGreed?.classification ?? ''}</span>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
