'use client';

import { useState, useEffect } from 'react';

export default function GoldBinanceDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/gold-scalper-api/status');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
        console.error('[GoldScalper]', err);
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
        <div className="text-xl mb-2">Loading Gold Scalper Bot...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        <div className="text-lg mb-2">Error loading gold scalper data</div>
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
          <h1 className="text-3xl font-bold text-white mb-2">Gold Scalper Bot v4.0</h1>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              data.status === 'RUNNING' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {data.status || 'RUNNING'}
            </span>
            <span className="text-gray-400">
              Mode: {data.mode || 'DRY_RUN'}
            </span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* 4H Regime */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">4H Regime</div>
            <div className="text-2xl font-bold text-white">{data.regime4h || 'N/A'}</div>
            <div className="text-xs text-gray-500 mt-1">Confidence: {(data.regimeConfidence || 0).toFixed(0)}%</div>
          </div>

          {/* 1H Bias */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">1H Bias</div>
            <div className={`text-2xl font-bold ${
              data.bias1h?.includes('BULLISH') ? 'text-green-400' : 'text-red-400'
            }`}>
              {data.bias1h || 'N/A'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Confidence: {(data.biasConfidence || 0).toFixed(0)}%</div>
          </div>

          {/* Quality Score */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Quality Score</div>
            <div className={`text-2xl font-bold ${(data.qualityScore || 0) >= 65 ? 'text-green-400' : 'text-yellow-400'}`}>
              {(data.qualityScore || 0).toFixed(1)}/100
            </div>
            <div className="text-xs text-gray-500 mt-1">Action: {data.action || 'HOLD'}</div>
          </div>

          {/* Volatility */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Volatility</div>
            <div className="text-2xl font-bold text-white">{data.volState || 'N/A'}</div>
            <div className="text-xs text-gray-500 mt-1">TP Mult: {(data.tpMultiplier || 1).toFixed(1)}x</div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk & Market */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Market State</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ATR (5m)</span>
                <span className="text-white font-semibold">${(data.atr5 || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ATR (20m)</span>
                <span className="text-white font-semibold">${(data.atr20 || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Current Price</span>
                <span className="text-white font-semibold">${(data.currentPrice || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ADX (15m)</span>
                <span className="text-white font-semibold">{(data.adx15m || 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">RSI (15m)</span>
                <span className="text-white font-semibold">{(data.rsi || 0).toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Account & Risk */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Account</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Equity</span>
                <span className="text-white font-semibold">${(data.equity || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Daily PnL</span>
                <span className={`font-semibold ${(data.dailyPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${(data.dailyPnL || 0).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Daily Trades</span>
                <span className="text-white font-semibold">{data.dailyTrades || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Leverage</span>
                <span className="text-white font-semibold">{data.leverage || 0}x</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Risk %</span>
                <span className="text-white font-semibold">{(data.riskPct || 0).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
