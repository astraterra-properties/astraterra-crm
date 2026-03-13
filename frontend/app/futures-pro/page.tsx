'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

export default function FuturesProPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/futures-pro-api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const status = await res.json();
      setData(status);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
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
          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
          >
            <RefreshCw size={18} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const state = data?.state ?? 'UNKNOWN';
  const balance = data?.currentBalance ?? 0;
  const dailyPnL = data?.dailyPnL ?? 0;
  const openPos = data?.openPositionsCount ?? 0;
  const performance = data?.performance ?? {};
  const signals = data?.signals ?? {};
  const btcRegime = data?.btcRegime ?? 'UNKNOWN';
  const equityCurve = data?.performance?.equityCurve ?? [];

  const signalList = Object.entries(signals)
    .filter(([_, signal]: any) => signal.signal !== 'NONE')
    .slice(0, 10)
    .map(([pair, signal]: any) => ({ pair, ...signal }));

  const maxEquity = Math.max(...equityCurve.map((e: any) => e.equity), balance);
  const minEquity = Math.min(...equityCurve.map((e: any) => e.equity), balance);
  const range = maxEquity - minEquity || 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">Futures Pro Bot</h1>
            <p className="text-slate-400">Live USDT-M Futures Trading • 28 Pairs</p>
          </div>
          <button
            onClick={fetchStatus}
            className="p-3 hover:bg-slate-700 rounded-lg transition"
          >
            <RefreshCw size={24} className="text-blue-400" />
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-700 rounded-lg p-6">
            <p className="text-blue-200 text-sm mb-2 uppercase tracking-wide">Status</p>
            <p className={`text-3xl font-bold ${state === 'RUNNING' ? 'text-green-400' : 'text-yellow-400'}`}>
              {state}
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-600 rounded-lg p-6">
            <p className="text-slate-300 text-sm mb-2 uppercase tracking-wide">Balance</p>
            <p className="text-3xl font-bold text-white">${balance.toFixed(2)}</p>
          </div>

          <div className={`bg-gradient-to-br ${dailyPnL >= 0 ? 'from-green-900 to-green-800' : 'from-red-900 to-red-800'} border ${dailyPnL >= 0 ? 'border-green-700' : 'border-red-700'} rounded-lg p-6`}>
            <p className="text-slate-300 text-sm mb-2 uppercase tracking-wide">Daily P&L</p>
            <p className={`text-3xl font-bold ${dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${dailyPnL.toFixed(2)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-900 to-purple-800 border border-purple-700 rounded-lg p-6">
            <p className="text-purple-200 text-sm mb-2 uppercase tracking-wide">Open Positions</p>
            <p className="text-3xl font-bold text-white">{openPos}</p>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-600 rounded-lg p-6">
            <p className="text-slate-300 text-sm mb-2 uppercase tracking-wide">Market Regime</p>
            <p className="text-3xl font-bold text-yellow-400">{btcRegime}</p>
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
                  {typeof performance.maxDrawdown === 'number' ? performance.maxDrawdown.toFixed(2) : '0.00'}%
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
                <span className="text-slate-400">Portfolio Risk</span>
                <span className="text-white font-semibold text-lg">
                  {data?.portfolioMetrics?.riskUtilization || '0.0'}%
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Scan Count</span>
                <span className="text-white font-semibold text-lg">{(data?.scanCount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Market Conditions */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6">Market Conditions</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">BTC Trend (15m)</span>
                <span className={`font-semibold text-lg ${data?.btcTrend === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>
                  {data?.btcTrend || 'UNKNOWN'}
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">BTC HTF (1h)</span>
                <span className={`font-semibold text-lg ${data?.btcHTFTrend === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>
                  {data?.btcHTFTrend || 'UNKNOWN'}
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Range %</span>
                <span className="text-white font-semibold text-lg">
                  {typeof data?.btcRangePct === 'number' ? data.btcRangePct.toFixed(2) : '0.00'}%
                </span>
              </div>
              <div className="border-t border-slate-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Fear & Greed</span>
                <span className="text-yellow-400 font-semibold text-lg">
                  {data?.macroFilter?.fearGreed?.value || '0'}
                </span>
              </div>
            </div>
          </div>
        </div>

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
                  style={{
                    height: `${((point.equity - minEquity) / range) * 100}%`,
                    minHeight: '2px',
                  }}
                  title={`${new Date(point.time).toLocaleTimeString()} - $${point.equity.toFixed(2)}`}
                ></div>
              ))}
            </div>
            <p className="text-slate-400 text-xs mt-2 text-center">Last 50 equity points</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm">
          <p>Last updated: {new Date(data?.lastScanAt).toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} Dubai</p>
          <p className="mt-1">Updates every 3 seconds</p>
        </div>
      </div>
    </div>
  );
}
