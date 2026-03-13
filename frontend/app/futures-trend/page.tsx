'use client';

import { useState, useEffect } from 'react';

interface StatusData {
  state: string;
  dryRun: boolean;
  pairs: string[];
  leverage: number;
  riskPct: number;
  riskPerTrade: number;
  riskTier: string;
  scanCount: number;
  currentBalance: number;
  totalUnrealizedPnl: number;
  availableBalance: number;
  btcTrend: string;
  btcHTFTrend: string;
  btcRegime: string;
  btcMomentum4h: number;
  btcAtrPct: number;
  btcAdx: number;
  openPositionsCount: number;
  longCount: number;
  shortCount: number;
  dailyPnl: number;
  dailyTrades: number;
  regimeBlocking: boolean;
  regimeBlockReason: string;
  performance: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    profitFactor: number;
    avgWin?: number;
    avgLoss?: number;
    totalPnl: number;
  };
  macroFilter?: { enabled: boolean };
  portfolioMetrics?: { maxAllowed?: number; currentRegime?: string };
  signals?: any[];
}

export default function FuturesTrendDashboard() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/futures-trend/api/status');
        const statusData = await response.json();
        setData(statusData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching futures data:', error);
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-white">Loading...</div>;
  }

  if (!data) {
    return <div className="p-6 text-center text-white">No data available</div>;
  }

  const healthScore = data.performance?.profitFactor ? Math.min(100, Math.round(data.performance.profitFactor * 25)) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            ⚡ Futures Trend Bot
            <span className={`text-xs px-2 py-1 rounded ${data.state === 'RUNNING' ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
              {data.state === 'RUNNING' ? 'ONLINE' : 'OFFLINE'}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${data.dryRun ? 'bg-yellow-500/30 text-yellow-300' : 'bg-blue-500/30 text-blue-300'}`}>
              {data.dryRun ? 'DRY RUN' : 'LIVE'}
            </span>
            <span className={`text-xs px-2 py-1 rounded bg-orange-500/30 text-orange-300`}>
              {data.btcRegime || 'RANGING'}
            </span>
          </h1>
          <p className="text-blue-300 text-sm mt-1">29 pairs • Scan #{data.scanCount || 0} • 5s</p>
        </div>
      </div>

      {/* Top 4 Status Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* BOT Card */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-500/30 rounded-lg p-4">
          <div className="text-xs text-blue-300 mb-2">BOT</div>
          <div className="text-sm font-mono text-white mb-1">Mode: <span className="text-green-400">{data.dryRun ? 'DRY_RUN' : 'LIVE'}</span></div>
          <div className="text-sm font-mono text-white mb-1">Equity: <span className="text-yellow-400">${data.currentBalance?.toFixed(2) || '0.00'}</span></div>
          <div className="text-sm font-mono text-white mb-1">Balance: <span className="text-yellow-400">${data.availableBalance?.toFixed(2) || '0.00'}</span></div>
          <div className="text-sm font-mono text-white">Unrealized: <span className={data.totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>${data.totalUnrealizedPnl?.toFixed(2) || '0.00'}</span></div>
        </div>

        {/* SERIES Card */}
        <div className="bg-gradient-to-br from-purple-900 to-purple-800 border border-purple-500/30 rounded-lg p-4">
          <div className="text-xs text-purple-300 mb-2">SERIES</div>
          <div className="text-sm font-mono text-white mb-1">4H Momentum: <span className="text-orange-400">{data.btcMomentum4h?.toFixed(2)}%</span></div>
          <div className="text-sm font-mono text-white mb-1">BTC 4H: <span className={data.btcTrend === 'BULLISH' ? 'text-green-400' : 'text-red-400'}>{data.btcTrend}</span></div>
          <div className="text-sm font-mono text-white mb-1">ADX: <span className="text-cyan-400">{data.btcAdx?.toFixed(2)}</span></div>
          <div className="text-sm font-mono text-white">Trend: <span className="text-blue-300">{data.btcRegime}</span></div>
        </div>

        {/* BIAS Card */}
        <div className="bg-gradient-to-br from-cyan-900 to-cyan-800 border border-cyan-500/30 rounded-lg p-4">
          <div className="text-xs text-cyan-300 mb-2">BIAS</div>
          <div className="text-sm font-mono text-white mb-1">BTC 4H: <span className={data.btcTrend === 'BULLISH' ? 'text-green-400' : 'text-red-400'}>{data.btcTrend}</span></div>
          <div className="text-sm font-mono text-white mb-1">BTC 1H: <span className={data.btcHTFTrend === 'BULLISH' ? 'text-green-400' : 'text-red-400'}>{data.btcHTFTrend}</span></div>
          <div className="text-sm font-mono text-white mb-1">Positions: <span className="text-blue-300">{data.openPositionsCount}</span></div>
          <div className="text-sm font-mono text-white">Long/Short: <span className="text-blue-300">{data.longCount} / {data.shortCount}</span></div>
        </div>

        {/* RISK MODE Card */}
        <div className="bg-gradient-to-br from-red-900 to-red-800 border border-red-500/30 rounded-lg p-4">
          <div className="text-xs text-red-300 mb-2">RISK MODE</div>
          <div className="text-sm font-mono text-white mb-1">Tier: <span className="text-orange-400">{data.riskTier}</span></div>
          <div className="text-sm font-mono text-white mb-1">Risk %: <span className="text-yellow-400">{data.riskPct?.toFixed(2)}%</span></div>
          <div className="text-sm font-mono text-white mb-1">Daily P&L: <span className={data.dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}>${data.dailyPnl?.toFixed(2) || '0.00'}</span></div>
          <div className="text-sm font-mono text-white">Daily Limit: <span className={data.dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}>{data.dailyPnl >= 0 ? '✓' : 'HIT'}</span></div>
        </div>
      </div>

      {/* Entries Blocked Banner */}
      {data.regimeBlocking && (
        <div className="bg-red-900/40 border border-red-500 rounded-lg p-4 mb-6">
          <div className="text-red-300 font-semibold">⚠️ ENTRIES BLOCKED</div>
          <div className="text-red-200 text-sm mt-1">{data.regimeBlockReason || '461 data unavailable'}</div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Equity Curve */}
        <div className="bg-gradient-to-br from-blue-900/50 to-slate-900/50 border border-blue-500/20 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-blue-300 mb-4">EQUITY CURVE</h2>
          <div className="w-full h-48 bg-blue-900/20 rounded flex items-end justify-around px-2 py-4">
            {[70, 72, 71, 73, 75, 74, 76, 78].map((val, i) => (
              <div key={i} className="flex-1 mx-1 bg-yellow-400/70 rounded-t" style={{ height: `${(val / 80) * 100}%` }}></div>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-2 flex justify-between">
            <span>Balance: ${data.currentBalance?.toFixed(2)}</span>
            <span>Peak: ${data.performance?.totalPnl?.toFixed(2)}</span>
          </div>
        </div>

        {/* Performance Statistics */}
        <div className="bg-gradient-to-br from-blue-900/50 to-slate-900/50 border border-blue-500/20 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-blue-300 mb-4">PERFORMANCE STATISTICS</h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-400">Total Trades</span><span className="text-white font-mono">{data.performance?.totalTrades || 0}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Win / Losses</span><span className="text-white font-mono">{data.performance?.wins || 0} / {data.performance?.losses || 0}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Win Rate</span><span className="text-white font-mono">{data.performance?.winRate?.toFixed(2) || '0'}%</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Profit Factor</span><span className="text-white font-mono">{data.performance?.profitFactor?.toFixed(2) || '0'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Expectancy</span><span className="text-white font-mono">{data.performance?.avgWin?.toFixed(2) || '0'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Avg Win / Loss</span><span className="text-white font-mono">${data.performance?.avgWin?.toFixed(2) || '0'} / ${Math.abs(data.performance?.avgLoss || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Real P&L</span><span className={data.performance?.totalPnl >= 0 ? 'text-green-400 font-mono' : 'text-red-400 font-mono'}>${data.performance?.totalPnl?.toFixed(2) || '0'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Daily Trades</span><span className="text-white font-mono">{data.dailyTrades || 0}</span></div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-gradient-to-br from-blue-900/50 to-slate-900/50 border border-blue-500/20 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-blue-300 mb-4">SYSTEM HEALTH</h2>
          <div className="flex flex-col items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-32 h-32">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#1e3a8a" strokeWidth="4" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#d4af37"
                strokeWidth="4"
                strokeDasharray={`${(healthScore / 100) * 314} 314`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="70" textAnchor="middle" fontSize="28" fill="#d4af37" fontWeight="bold">
                {healthScore}
              </text>
            </svg>
            <div className="text-xs text-gray-400 mt-2 text-center">
              {healthScore >= 75 ? '✓ Excellent' : healthScore >= 50 ? '⚠ Good' : '✗ Poor'}
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2 space-y-1">
            <div>⚠️ PF 0-0.5 low</div>
            <div>✓ PF 1.0+ high</div>
            <div>⚡ PF 2.0+ ideal</div>
          </div>
        </div>
      </div>

      {/* Signal Opportunity Feed */}
      <div className="bg-gradient-to-br from-blue-900/50 to-slate-900/50 border border-blue-500/20 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-blue-300 mb-4">SIGNAL OPPORTUNITY FEED</h2>
        <div className="flex gap-2 mb-4">
          <button className="px-3 py-1 rounded text-xs bg-blue-500/30 text-blue-300 hover:bg-blue-500/50">ALL</button>
          <button className="px-3 py-1 rounded text-xs text-gray-400 hover:bg-blue-500/30">LONG</button>
          <button className="px-3 py-1 rounded text-xs text-gray-400 hover:bg-blue-500/30">SHORT</button>
          <button className="px-3 py-1 rounded text-xs text-gray-400 hover:bg-blue-500/30">ACCEPTED</button>
          <button className="px-3 py-1 rounded text-xs text-gray-400 hover:bg-blue-500/30">REJECTED</button>
        </div>
        <div className="text-xs text-gray-400 text-center py-4">No active signals at this time</div>
      </div>

      {/* All Pairs Scanner */}
      <div className="bg-gradient-to-br from-blue-900/50 to-slate-900/50 border border-blue-500/20 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-blue-300 mb-4">ALL PAIRS SCANNER</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-blue-500/30 text-blue-300">
                <th className="text-left py-2 px-2">Pair</th>
                <th className="text-right py-2 px-2">Price</th>
                <th className="text-right py-2 px-2">RSI</th>
                <th className="text-right py-2 px-2">ADX</th>
                <th className="text-right py-2 px-2">HTF 1H</th>
                <th className="text-left py-2 px-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.pairs?.slice(0, 10).map((pair) => (
                <tr key={pair} className="border-b border-blue-500/10 hover:bg-blue-500/5">
                  <td className="py-2 px-2 text-white">{pair}</td>
                  <td className="text-right py-2 px-2 text-gray-400">-</td>
                  <td className="text-right py-2 px-2 text-gray-400">-</td>
                  <td className="text-right py-2 px-2 text-gray-400">-</td>
                  <td className="text-right py-2 px-2 text-gray-400">-</td>
                  <td className="text-left py-2 px-2 text-gray-400">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
