'use client';

import { useState, useEffect } from 'react';

export default function FuturesTrendDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/futures-trend/api/status');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
        console.error('[FuturesTrend]', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-white">
        <div className="text-xl mb-2">Loading Futures Bot...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        <div className="text-lg mb-2">Error loading futures data</div>
        <div className="text-sm text-gray-400">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-400">No data available</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Futures Trend Bot</h1>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              data.state === 'RUNNING' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {data.state || 'UNKNOWN'}
            </span>
            <span className="text-gray-400">
              Last scan: {data.lastScanAt ? new Date(data.lastScanAt).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Regime */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Regime</div>
            <div className="text-2xl font-bold text-white">{data.regime || 'N/A'}</div>
            <div className="text-xs text-gray-500 mt-1">{data.regimeBlocking ? '🔒 Blocking' : '✅ Open'}</div>
          </div>

          {/* BTC Trend */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">BTC Trend</div>
            <div className={`text-2xl font-bold ${data.btcTrend === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>
              {data.btcTrend || 'N/A'}
            </div>
          </div>

          {/* Daily PnL */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Daily PnL</div>
            <div className={`text-2xl font-bold ${(data.dailyPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${(data.dailyPnL || 0).toFixed(2)}
            </div>
          </div>

          {/* Profit Factor */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Profit Factor</div>
            <div className={`text-2xl font-bold ${(data.performance?.profitFactor || 0) > 1.5 ? 'text-green-400' : 'text-yellow-400'}`}>
              {(data.performance?.profitFactor || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stats */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Performance</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Trades</span>
                <span className="text-white font-semibold">{data.performance?.totalTrades || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Win Rate</span>
                <span className="text-white font-semibold">{(data.performance?.winRate || 0).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total PnL</span>
                <span className={`font-semibold ${(data.performance?.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${(data.performance?.totalPnL || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Avg Win</span>
                <span className="text-green-400 font-semibold">${(data.performance?.avgWin || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Avg Loss</span>
                <span className="text-red-400 font-semibold">${(data.performance?.avgLoss || 0).toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Account</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Balance</span>
                <span className="text-white font-semibold">${(data.currentBalance || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Available</span>
                <span className="text-white font-semibold">${(data.availableBalance || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Open Positions</span>
                <span className="text-white font-semibold">{data.openPositionsCount || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Leverage</span>
                <span className="text-white font-semibold">{data.leverage || 0}x</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Risk Per Trade</span>
                <span className="text-white font-semibold">{(data.riskPct || 0).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
