'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, Shield, Activity, ChevronDown, ChevronUp } from 'lucide-react';

// Normalize institutional data from /trend/institutional endpoint
function normalizeInst(raw: any) {
  if (!raw || !raw.ok) return null;
  const ks = raw.protection?.killSwitches || {};
  const anyKill = Object.values(ks).some(Boolean);
  return {
    regime: raw.regime || 'UNKNOWN',
    regimeConfidence: raw.regimeConfidence ?? 0,
    bias4h: raw.bias4h || 'UNKNOWN',
    bias1h: raw.bias1h || 'UNKNOWN',
    htfAligned: raw.bias4h === raw.bias1h,
    session: raw.session || 'UNKNOWN',
    sessionLabel: raw.sessionLabel || raw.session || 'Unknown',
    sessionMult: raw.sessionMultiplier ?? 1,
    macroMode: raw.macroMode || 'NORMAL',
    readiness: raw.readiness || 'UNKNOWN',
    explanation: raw.explanation || {},
    healthScore: raw.health?.health ?? 0,
    healthLevel: raw.health?.level || 'UNKNOWN',
    healthComponents: raw.health?.components || {},
    protection: {
      isPaused: raw.protection?.isPaused || false,
      killSwitch: anyKill,
      killSwitches: ks,
      consecutiveLosses: raw.protection?.consecutiveLosses ?? 0,
      dailyPnl: raw.protection?.dailyPnl ?? 0,
      dailyTradeCount: raw.protection?.dailyTradeCount ?? 0,
      pauseReason: raw.protection?.pauseReason || '',
    },
    riskState: raw.riskState || {},
    performance: raw.performance || {},
    fearGreed: raw.fearGreed ?? null,
    fearGreedLabel: raw.fearGreedLabel || '',
    edgeStability: raw.edgeStability || {},
    raw4h: raw.raw4h || {},
    raw1h: raw.raw1h || {},
  };
}

export default function FuturesProPage() {
  const [data, setData] = useState<any>(null);
  const [inst, setInst] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchAll = async () => {
    try {
      const [statusRes, instRes] = await Promise.all([
        fetch('/futures-pro-api/status'),
        fetch('/futures-pro-api/institutional').catch(() => null),
      ]);
      if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
      const status = await statusRes.json();
      setData(status);
      if (instRes?.ok) {
        const raw = await instRes.json();
        setInst(normalizeInst(raw));
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300 text-lg">Loading Futures Pro Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-6 text-lg">⚠️ {error || 'No data available'}</p>
          <button onClick={fetchAll} className="flex items-center gap-2 mx-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
            <RefreshCw size={18} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const state = data?.state ?? 'UNKNOWN';
  const balance = data?.currentBalance ?? data?.balance ?? 0;
  const dailyPnL = data?.dailyPnl ?? data?.dailyPnL ?? 0;
  const openPos = data?.openPositionsCount ?? data?.openPositions?.length ?? 0;
  const performance = data?.performance ?? {};
  const signals = data?.signals ?? {};
  const equityCurve = data?.performance?.equityCurve ?? [];

  const signalList = Object.entries(signals)
    .filter(([_, signal]: any) => signal.signal !== 'NONE')
    .slice(0, 10)
    .map(([pair, signal]: any) => ({ pair, ...signal }));

  const maxEquity = Math.max(...equityCurve.map((e: any) => e.equity), balance || 1);
  const minEquity = Math.min(...equityCurve.map((e: any) => e.equity), balance || 0);
  const range = maxEquity - minEquity || 1;

  // Institutional data
  const healthScore = inst?.healthScore ?? null;
  const regime = inst?.regime ?? data?.btcRegime ?? 'UNKNOWN';
  const session = inst?.session ?? 'UNKNOWN';
  const sessionLabel = inst?.sessionLabel ?? session;
  const killSwitch = inst?.protection?.killSwitch ?? false;

  const healthColor = healthScore === null ? 'text-slate-400' :
    healthScore >= 70 ? 'text-green-400' : healthScore >= 40 ? 'text-yellow-400' : 'text-red-400';
  const healthBg = healthScore === null ? 'from-slate-800 to-slate-700 border-slate-600' :
    healthScore >= 70 ? 'from-green-900/40 to-green-800/40 border-green-700/60' :
    healthScore >= 40 ? 'from-yellow-900/40 to-yellow-800/40 border-yellow-700/60' :
    'from-red-900/40 to-red-800/40 border-red-700/60';

  const regimeColor: Record<string, string> = {
    'TREND': 'text-green-400', 'STRONG_TREND': 'text-green-300', 'TRENDING': 'text-green-400',
    'MODERATE_TREND': 'text-blue-400', 'WEAK_TREND': 'text-yellow-400',
    'RANGING': 'text-orange-400', 'CHOPPY': 'text-orange-500', 'RANGE': 'text-orange-400',
    'HIGH_VOLATILITY': 'text-red-400', 'LOW_LIQUIDITY': 'text-yellow-500',
    'VOLATILE': 'text-red-400', 'CRASH': 'text-red-500',
  };

  const sessionColor: Record<string, string> = {
    'LONDON_NY_OVERLAP': 'text-green-400', 'LONDON': 'text-green-300',
    'NY': 'text-blue-400', 'ASIA': 'text-yellow-400',
    'DEAD': 'text-red-400', 'ASIA_DEAD': 'text-red-500', 'BLOCKED_ASIA_DEAD': 'text-red-500',
  };

  const readinessColor: Record<string, string> = {
    'READY': 'text-green-400', 'MARGINAL': 'text-yellow-400', 'CONDITIONS_NOT_MET': 'text-red-400',
  };

  const Pill = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/80 border border-slate-600 rounded-full text-xs font-medium">
      <span className="text-slate-400">{label}:</span>
      <span className={color || 'text-white'}>{value}</span>
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">Futures Pro Bot</h1>
            <p className="text-slate-400">Live USDT-M Futures Trading • {data?.pairs?.length ?? 28} Pairs</p>
          </div>
          <button onClick={fetchAll} className="p-3 hover:bg-slate-700 rounded-lg transition">
            <RefreshCw size={24} className="text-blue-400" />
          </button>
        </div>

        {/* Status Pills Bar */}
        {inst && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Pill label="Regime" value={`${regime} (${inst.regimeConfidence}%)`} color={regimeColor[regime] || 'text-white'} />
            <Pill label="Session" value={sessionLabel} color={sessionColor[session] || 'text-slate-300'} />
            <Pill label="HTF Bias" value={inst.htfAligned ? `${inst.bias4h} ✓` : `4H:${inst.bias4h} / 1H:${inst.bias1h}`}
              color={inst.htfAligned ? 'text-green-400' : 'text-yellow-400'} />
            <Pill label="Health" value={`${healthScore}/100 ${inst.healthLevel}`} color={healthColor} />
            <Pill label="Readiness" value={inst.readiness?.replace(/_/g, ' ')} color={readinessColor[inst.readiness] || 'text-slate-300'} />
            {inst.fearGreed !== null && (
              <Pill label="F&G" value={`${inst.fearGreed} ${inst.fearGreedLabel}`}
                color={inst.fearGreed >= 60 ? 'text-green-400' : inst.fearGreed >= 40 ? 'text-yellow-400' : 'text-red-400'} />
            )}
            {killSwitch && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-900/60 border border-red-600 rounded-full text-xs font-bold text-red-300 animate-pulse">
                ⛔ KILL SWITCH
              </span>
            )}
            {inst.protection?.isPaused && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-900/40 border border-yellow-700 rounded-full text-xs font-semibold text-yellow-300">
                ⏸️ PAUSED
              </span>
            )}
            {inst.macroMode && inst.macroMode !== 'NORMAL' && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-semibold ${
                inst.macroMode === 'RED_ALERT' ? 'bg-red-900/40 border-red-700 text-red-300' :
                'bg-yellow-900/40 border-yellow-700 text-yellow-300'
              }`}>
                📡 {inst.macroMode.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-700 rounded-lg p-6">
            <p className="text-blue-200 text-sm mb-2 uppercase tracking-wide">Status</p>
            <p className={`text-3xl font-bold ${state === 'RUNNING' ? 'text-green-400' : 'text-yellow-400'}`}>{state}</p>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-600 rounded-lg p-6">
            <p className="text-slate-300 text-sm mb-2 uppercase tracking-wide">Balance</p>
            <p className="text-3xl font-bold text-white">${balance.toFixed(2)}</p>
          </div>

          <div className={`bg-gradient-to-br ${dailyPnL >= 0 ? 'from-green-900 to-green-800' : 'from-red-900 to-red-800'} border ${dailyPnL >= 0 ? 'border-green-700' : 'border-red-700'} rounded-lg p-6`}>
            <p className="text-slate-300 text-sm mb-2 uppercase tracking-wide">Daily P&L</p>
            <p className={`text-3xl font-bold ${dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>${dailyPnL.toFixed(2)}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-900 to-purple-800 border border-purple-700 rounded-lg p-6">
            <p className="text-purple-200 text-sm mb-2 uppercase tracking-wide">Open Positions</p>
            <p className="text-3xl font-bold text-white">{openPos}</p>
          </div>

          {/* Health Score Card */}
          <div className={`bg-gradient-to-br ${healthBg} border rounded-lg p-6`}>
            <p className="text-slate-300 text-sm mb-2 uppercase tracking-wide">Health Score</p>
            <p className={`text-3xl font-bold ${healthColor}`}>
              {healthScore !== null ? `${healthScore}` : (data?.btcRegime ?? '—')}
              {healthScore !== null && <span className="text-lg text-slate-400">/100</span>}
            </p>
            {inst?.healthLevel && (
              <p className={`text-xs mt-1 font-semibold ${healthColor}`}>{inst.healthLevel}</p>
            )}
          </div>
        </div>

        {/* Performance Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Performance Stats */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6">Performance</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Total Trades</span>
                <span className="text-white font-semibold text-lg">{performance.totalTrades || 0}</span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Win Rate</span>
                <span className="text-green-400 font-semibold text-lg">
                  {typeof performance.winRate === 'number' ? performance.winRate.toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Profit Factor</span>
                <span className="text-white font-semibold text-lg">
                  {typeof performance.profitFactor === 'number' ? performance.profitFactor.toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Max Drawdown</span>
                <span className="text-red-400 font-semibold text-lg">
                  ${typeof performance.maxDrawdown === 'number' ? performance.maxDrawdown.toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>

          {/* Risk Metrics */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6">Risk Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Risk Tier</span>
                <span className="text-blue-400 font-semibold text-lg">{data?.riskTier || 'UNKNOWN'}</span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Risk/Trade</span>
                <span className="text-white font-semibold text-lg">${(data?.riskPerTrade || 0).toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Session Mult</span>
                <span className={`font-semibold text-lg ${(inst?.sessionMult ?? 1) < 0.5 ? 'text-red-400' : (inst?.sessionMult ?? 1) < 1 ? 'text-yellow-400' : 'text-white'}`}>
                  {inst?.sessionMult?.toFixed(1) ?? '1.0'}×
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Loss Streak</span>
                <span className={`font-semibold text-lg ${(inst?.riskState?.lossStreak ?? 0) >= 3 ? 'text-red-400' : 'text-white'}`}>
                  {inst?.riskState?.lossStreak ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Market Conditions — enhanced with institutional data */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6">Market Conditions</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Regime (4H)</span>
                <span className={`font-semibold text-lg ${regimeColor[regime] || 'text-white'}`}>
                  {regime} <span className="text-sm text-slate-400">({inst?.regimeConfidence ?? '?'}%)</span>
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Session</span>
                <span className={`font-semibold text-lg ${sessionColor[session] || 'text-slate-300'}`}>
                  {sessionLabel}
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">HTF Alignment</span>
                <span className={`font-semibold text-lg ${inst?.htfAligned ? 'text-green-400' : 'text-yellow-400'}`}>
                  {inst?.htfAligned ? '✓ Aligned' : '✗ Diverged'}
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Fear & Greed</span>
                <span className={`font-semibold text-lg ${
                  (inst?.fearGreed ?? 50) >= 60 ? 'text-green-400' : (inst?.fearGreed ?? 50) >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {inst?.fearGreed ?? data?.macroFilter?.fearGreed?.value ?? '—'} {inst?.fearGreedLabel ? `(${inst.fearGreedLabel})` : ''}
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">ADX (4H)</span>
                <span className="text-white font-semibold text-lg">
                  {inst?.raw4h?.adx?.toFixed(1) ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Institutional Engine Details (expandable) */}
        {inst && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg mb-8 overflow-hidden">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-6 hover:bg-slate-700/50 transition"
            >
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-blue-400" />
                <h3 className="text-xl font-bold text-white">Institutional Engine Details</h3>
                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                  inst.healthLevel === 'GREEN' ? 'bg-green-900/60 text-green-300' :
                  inst.healthLevel === 'YELLOW' ? 'bg-yellow-900/60 text-yellow-300' :
                  'bg-red-900/60 text-red-300'
                }`}>{inst.healthLevel}</span>
              </div>
              {showDetails ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>

            {showDetails && (
              <div className="px-6 pb-6 border-t border-slate-700 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                  {/* Regime Analysis */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Regime Analysis</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">4H Regime</span>
                        <span className={`font-mono ${regimeColor[regime] || 'text-white'}`}>{regime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Confidence</span>
                        <span className="font-mono text-slate-200">{inst.regimeConfidence}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">4H Bias</span>
                        <span className={`font-mono ${inst.bias4h === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>{inst.bias4h}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">1H Bias</span>
                        <span className={`font-mono ${inst.bias1h === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>{inst.bias1h}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ADX</span>
                        <span className="font-mono text-slate-200">{inst.raw4h?.adx?.toFixed(1) ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ATR%</span>
                        <span className="font-mono text-slate-200">{inst.raw4h?.atrPct?.toFixed(2) ?? '—'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">EMA Gap</span>
                        <span className="font-mono text-slate-200">{inst.raw4h?.emaGap?.toFixed(2) ?? '—'}%</span>
                      </div>
                    </div>
                    {inst.explanation?.regime4h && (
                      <p className="text-xs text-slate-500 mt-2 italic">{inst.explanation.regime4h}</p>
                    )}
                  </div>

                  {/* Capital Protection */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Capital Protection</h4>
                    <div className="space-y-2 text-sm">
                      {[
                        ['Kill Switch', inst.protection?.killSwitch],
                        ['Consecutive Loss', inst.protection?.killSwitches?.consecutiveLoss],
                        ['Daily Loss', inst.protection?.killSwitches?.dailyLoss],
                        ['Max Drawdown', inst.protection?.killSwitches?.maxDrawdown],
                        ['Low Profit Factor', inst.protection?.killSwitches?.lowProfitFactor],
                        ['Low Win Rate', inst.protection?.killSwitches?.lowWinRate],
                        ['Paused', inst.protection?.isPaused],
                      ].map(([label, active]: any) => (
                        <div key={label} className="flex justify-between items-center">
                          <span className="text-slate-400">{label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            active ? 'bg-red-900/60 text-red-300' : 'bg-green-900/40 text-green-400'
                          }`}>
                            {active ? 'ACTIVE' : 'OFF'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {inst.protection?.pauseReason && (
                      <p className="text-xs text-yellow-400 mt-2">Reason: {inst.protection.pauseReason}</p>
                    )}
                  </div>

                  {/* Health Components */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Health Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      {Object.entries(inst.healthComponents).map(([key, val]: any) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span className="text-slate-200 font-mono">{typeof val === 'number' ? val.toFixed(1) : val}</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${Number(val) >= 20 ? 'bg-green-500' : Number(val) >= 10 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, Number(val) * 4)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-slate-600 pt-2 flex justify-between font-semibold">
                        <span className="text-white">Total</span>
                        <span className={`font-mono ${healthColor}`}>{healthScore}/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Edge Stability + Risk State */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Risk State</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Loss Streak</span>
                        <span className={`font-mono ${(inst.riskState?.lossStreak ?? 0) >= 3 ? 'text-red-400' : 'text-slate-200'}`}>
                          {inst.riskState?.lossStreak ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Drawdown</span>
                        <span className="font-mono text-slate-200">{inst.riskState?.drawdownPct?.toFixed(1) ?? '0.0'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Macro Mode</span>
                        <span className={`font-mono ${inst.riskState?.macroMode === 'NORMAL' ? 'text-green-400' : 'text-yellow-400'}`}>
                          {inst.riskState?.macroMode ?? 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Edge Strength</span>
                        <span className="font-mono text-slate-200">{inst.edgeStability?.edgeStrength ?? '—'}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Daily Trades</span>
                        <span className="font-mono text-slate-200">{inst.protection?.dailyTradeCount ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Daily P&L</span>
                        <span className={`font-mono ${(inst.protection?.dailyPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${(inst.protection?.dailyPnl ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-300 mb-2 mt-4 uppercase tracking-wide">Explanations</h4>
                    <div className="space-y-1 text-xs text-slate-500">
                      {inst.explanation?.regime4h && <p>📊 {inst.explanation.regime4h}</p>}
                      {inst.explanation?.bias1h && <p>📈 {inst.explanation.bias1h}</p>}
                      {inst.explanation?.session && <p>🕐 {inst.explanation.session}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Signals */}
        {signalList.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Active Signals ({signalList.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
              {signalList.map((item: any) => (
                <div key={item.pair} className="bg-slate-700 border border-slate-600 rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-white text-lg">{item.pair}</p>
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      item.signal === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                    }`}>
                      {item.signal}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm mb-2 line-clamp-2">{item.reason}</p>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Price: ${item.price}</span>
                    <span>RSI: {item.rsi?.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equity Curve Mini Chart */}
        {equityCurve.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Equity Curve</h3>
            <div className="h-48 flex items-end gap-1 bg-slate-900 rounded p-4">
              {equityCurve.slice(-50).map((point: any, idx: number) => (
                <div
                  key={idx}
                  className="flex-1 bg-blue-600 rounded-t opacity-80 hover:opacity-100 transition"
                  style={{ height: `${((point.equity - minEquity) / range) * 100}%`, minHeight: '2px' }}
                  title={`${new Date(point.time).toLocaleTimeString()} - $${point.equity.toFixed(2)}`}
                ></div>
              ))}
            </div>
            <p className="text-slate-400 text-xs mt-2 text-center">Last 50 equity points</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm">
          <p>Last updated: {data?.lastScanAt ? new Date(data.lastScanAt).toLocaleString('en-US', { timeZone: 'Asia/Dubai' }) : '—'} Dubai</p>
          <p className="mt-1">Auto-refresh every 10 seconds</p>
        </div>
      </div>
    </div>
  );
}
