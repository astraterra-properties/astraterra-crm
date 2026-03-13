'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Position {
  symbol: string;
  side: 'Long' | 'Short';
  contracts: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  leverage: number;
  marginType: string;
  margin: number;
  percentage: number;
}

interface FundingRate {
  symbol: string;
  rate: number;
  nextFunding: number;
  markPrice: number;
  volume24h: number;
  apr: number;
}

interface BotStatus {
  status: 'live' | 'dry-run' | 'offline';
  data: Record<string, unknown> | null;
}

interface MobileData {
  ts: number;
  portfolio: {
    total: number;
    binanceSpot: number;
    binanceFutures: number;
    bybit: number;
    kucoin?: number;
    okx: number;
    unrealizedPnl: number;
  };
  positions: Position[];
  fundingRates: FundingRate[];
  bots: {
    arb: BotStatus;
    crossArb: BotStatus;
    kucoin?: BotStatus;
    fundingRate: BotStatus;
    marketMaking: BotStatus;
    gold: BotStatus;
  };
  pnl: { today: number; allTime: number };
}

type Tab = 'overview' | 'positions' | 'rates' | 'bots' | 'pnl';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVol(v: number) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${(v / 1000).toFixed(0)}K`;
}

function timeUntil(ms: number) {
  const diff = ms - Date.now();
  if (diff <= 0) return '0m';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

// ── Style constants ──────────────────────────────────────────────────────────

const BG      = '#0A0F1E';
const CARD    = '#111827';
const BORDER  = 'rgba(255,255,255,0.08)';
const GOLD    = '#C9A96E';
const GREEN   = '#22c55e';
const RED     = '#ef4444';
const TEXT1   = '#ffffff';
const TEXT2   = 'rgba(255,255,255,0.5)';
const YELLOW  = '#eab308';

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );
}

// ── Tab: Overview ────────────────────────────────────────────────────────────

function TabOverview({ data, setTab }: { data: MobileData; setTab: (t: Tab) => void }) {
  const p = data.portfolio;
  const bots = data.bots;
  const botList = [
    { key: 'arb',          label: 'Tri-Arb',   emoji: '🔺' },
    { key: 'crossArb',     label: 'X-Arb',     emoji: '⚡' },
    { key: 'fundingRate',  label: 'Funding',   emoji: '💰' },
    { key: 'marketMaking', label: 'MM',        emoji: '📊' },
    { key: 'gold',         label: 'Gold',      emoji: '🥇' },
  ] as const;

  const statusColor = (s: string) => s === 'live' ? GREEN : s === 'dry-run' ? YELLOW : '#6b7280';

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Portfolio Total */}
      <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: TEXT2, marginBottom: 4, letterSpacing: 1.5, textTransform: 'uppercase' }}>Total Portfolio</div>
        <div style={{ fontSize: 42, fontWeight: 700, color: GOLD, lineHeight: 1.1 }}>${fmt(p.total, 2)}</div>
        <div style={{ fontSize: 12, color: TEXT2, marginTop: 6 }}>
          Unrealized: <span style={{ color: p.unrealizedPnl >= 0 ? GREEN : RED }}>{p.unrealizedPnl >= 0 ? '+' : ''}{fmt(p.unrealizedPnl, 4)} USDT</span>
        </div>
      </div>

      {/* Exchange Breakdown */}
      <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '16px' }}>
        <div style={{ fontSize: 11, color: TEXT2, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>Exchange Balances</div>
        {[
          { label: 'Binance Spot',    val: p.binanceSpot,    icon: '🟡' },
          { label: 'Binance Futures', val: p.binanceFutures, icon: '📈' },
          { label: 'Bybit',           val: p.bybit,          icon: '🔵' },
          { label: 'OKX',             val: p.okx,            icon: '⚫' },
        ].map(({ label, val, icon }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 14, color: TEXT1 }}>{label}</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: val > 0 ? GOLD : TEXT2 }}>${fmt(val, 2)}</span>
          </div>
        ))}
      </div>

      {/* P&L Mini Card */}
      <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '16px', display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: TEXT2, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Today P&L</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: data.pnl.today >= 0 ? GREEN : RED }}>
            {data.pnl.today >= 0 ? '+' : ''}{fmt(data.pnl.today, 4)}
          </div>
          <div style={{ fontSize: 11, color: TEXT2 }}>USDT</div>
        </div>
        <div style={{ width: 1, background: BORDER }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: TEXT2, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>All-Time P&L</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: data.pnl.allTime >= 0 ? GREEN : RED }}>
            {data.pnl.allTime >= 0 ? '+' : ''}{fmt(data.pnl.allTime, 4)}
          </div>
          <div style={{ fontSize: 11, color: TEXT2 }}>USDT</div>
        </div>
      </div>

      {/* Bot Status Strip */}
      <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '16px' }}>
        <div style={{ fontSize: 11, color: TEXT2, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>Active Bots</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-around' }}>
          {botList.map(({ key, label, emoji }) => {
            const s = bots[key]?.status || 'offline';
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${statusColor(s)}20`, border: `2px solid ${statusColor(s)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {emoji}
                </div>
                <span style={{ fontSize: 9, color: statusColor(s), fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Access */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => setTab('positions')}
          style={{ flex: 1, padding: '14px', borderRadius: 12, background: `${GOLD}20`, border: `1px solid ${GOLD}`, color: GOLD, fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}
        >
          📈 Open Positions
        </button>
        <button
          onClick={() => setTab('rates')}
          style={{ flex: 1, padding: '14px', borderRadius: 12, background: `${GREEN}20`, border: `1px solid ${GREEN}`, color: GREEN, fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}
        >
          🔥 Live Rates
        </button>
      </div>
    </div>
  );
}

// ── Tab: Positions ───────────────────────────────────────────────────────────

function TabPositions({ data }: { data: MobileData }) {
  const positions = data.positions;
  const nextFundingTime = data.fundingRates[0]?.nextFunding || 0;

  if (positions.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <div style={{ fontSize: 18, color: TEXT1, fontWeight: 600, marginBottom: 8 }}>No Open Positions</div>
        <div style={{ fontSize: 14, color: TEXT2 }}>Your Binance Futures positions will appear here</div>
        {nextFundingTime > 0 && (
          <div style={{ marginTop: 20, padding: '12px 16px', background: CARD, borderRadius: 12, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 12, color: TEXT2 }}>Next Funding Payment</div>
            <div style={{ fontSize: 16, color: GOLD, fontWeight: 700, marginTop: 4 }}>⏰ {timeUntil(nextFundingTime)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Funding countdown */}
      {nextFundingTime > 0 && (
        <div style={{ background: `${GOLD}15`, borderRadius: 10, border: `1px solid ${GOLD}40`, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: GOLD }}>⏰ Next Funding</span>
          <span style={{ fontSize: 13, color: GOLD, fontWeight: 700 }}>{timeUntil(nextFundingTime)}</span>
        </div>
      )}

      {positions.map((pos, i) => {
        const isProfit = pos.unrealizedPnl >= 0;
        const color = isProfit ? GREEN : RED;
        return (
          <div key={`${pos.symbol}-${i}`} style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', background: `${color}10`, borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: TEXT1 }}>{pos.symbol}</span>
                <span style={{ fontSize: 11, color: TEXT2, marginLeft: 8 }}>Perp · {pos.marginType === 'cross' ? 'Cross' : 'Isolated'} {pos.leverage}x</span>
              </div>
              <div style={{ padding: '3px 10px', borderRadius: 6, background: pos.side === 'Long' ? `${GREEN}20` : `${RED}20`, border: `1px solid ${pos.side === 'Long' ? GREEN : RED}`, fontSize: 11, color: pos.side === 'Long' ? GREEN : RED, fontWeight: 700 }}>
                {pos.side.toUpperCase()}
              </div>
            </div>

            {/* PNL row */}
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}` }}>
              <div>
                <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>PNL (USDT)</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{isProfit ? '+' : ''}{fmt(pos.unrealizedPnl, 4)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>ROI</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{isProfit ? '+' : ''}{fmt(pos.percentage, 2)}%</div>
              </div>
            </div>

            {/* Detail grid */}
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 0' }}>
              {[
                ['Size', fmt(pos.contracts, 4)],
                ['Margin', `${fmt(pos.margin, 4)} USDT`],
                ['Entry', fmt(pos.entryPrice, 6)],
                ['Mark', fmt(pos.markPrice, 6)],
                ['Liq.', fmt(pos.liquidationPrice, 6)],
              ].map(([label, val]) => (
                <div key={label}>
                  <span style={{ fontSize: 11, color: TEXT2 }}>{label}: </span>
                  <span style={{ fontSize: 12, color: TEXT1, fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Live Rates ──────────────────────────────────────────────────────────

function TabRates({ data, onRefresh }: { data: MobileData; onRefresh: () => void }) {
  const rates = data.fundingRates;
  const positiveRates = rates.filter(r => r.rate > 0);
  const allRates = rates;

  const RateRow = ({ r, rank }: { r: FundingRate; rank: number }) => {
    const color = r.rate >= 0 ? GREEN : RED;
    const isBest = rank <= 3 && r.rate > 0;
    const letter = r.symbol.replace('USDT', '').slice(0, 2);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${BORDER}` }}>
        {/* Icon */}
        <div style={{ width: 36, height: 36, borderRadius: 10, background: isBest ? `${GOLD}25` : 'rgba(255,255,255,0.08)', border: `1px solid ${isBest ? GOLD : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isBest ? GOLD : TEXT2, flexShrink: 0 }}>
          {letter}
        </div>
        {/* Main */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT1 }}>{r.symbol}</span>
            {isBest && (
              <span style={{ fontSize: 9, fontWeight: 700, color: GOLD, background: `${GOLD}20`, border: `1px solid ${GOLD}`, borderRadius: 4, padding: '1px 5px', letterSpacing: 0.5 }}>
                #{rank} BEST
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: TEXT2 }}>
            {fmtVol(r.volume24h)} vol · Next: {timeUntil(r.nextFunding)}
          </div>
        </div>
        {/* Rate */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color }}>{r.rate >= 0 ? '+' : ''}{(r.rate * 100).toFixed(4)}%</div>
          <div style={{ fontSize: 11, color: TEXT2 }}>APR {r.apr >= 0 ? '+' : ''}{r.apr.toFixed(1)}%</div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Filter banner */}
      <div style={{ padding: '10px 16px', background: `${GOLD}10`, borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: TEXT2 }}>Showing $50M+ volume pairs only</span>
        <button onClick={onRefresh} style={{ fontSize: 11, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', minHeight: 32 }}>↺ Refresh</button>
      </div>

      {/* High Positive Section */}
      <div style={{ padding: '12px 16px 6px', fontSize: 13, fontWeight: 700, color: GREEN }}>
        🔥 High Positive (earn by shorting)
      </div>
      {positiveRates.slice(0, 10).map((r, i) => <RateRow key={r.symbol} r={r} rank={i + 1} />)}

      {/* All Pairs Section */}
      <div style={{ padding: '12px 16px 6px', fontSize: 13, fontWeight: 700, color: TEXT2 }}>
        📊 All Liquid Pairs ({allRates.length})
      </div>
      {allRates.map((r, i) => <RateRow key={`all-${r.symbol}`} r={r} rank={i + 1} />)}
    </div>
  );
}

// ── Tab: Bots ────────────────────────────────────────────────────────────────

function TabBots({ data }: { data: MobileData }) {
  const bots = data.bots;

  const botConfig = [
    {
      key: 'arb' as const,
      name: 'Tri-Arb',
      emoji: '🔺',
      desc: (d: Record<string, unknown> | null) => {
        const triangles = (d as { stats?: { totalOpportunities?: number } } | null)?.stats?.totalOpportunities;
        return triangles ? `${triangles} triangles scanned` : 'Binance triangular arb';
      },
      link: '/arb',
    },
    {
      key: 'crossArb' as const,
      name: 'Cross-Exchange',
      emoji: '⚡',
      desc: (d: Record<string, unknown> | null) => {
        const pairs = (d as { stats?: { pairs?: number } } | null)?.stats?.pairs;
        return pairs ? `${pairs} pairs monitored` : 'Binance ↔ Bybit arbitrage';
      },
      link: '/cross-arb',
    },
    {
      key: 'kucoin' as const,
      name: 'KuCoin Arb (removed)',
      emoji: '🟢',
      desc: (d: Record<string, unknown> | null) => {
        const ops = (d as { stats?: { totalOpportunities?: number } } | null)?.stats?.totalOpportunities;
        return ops ? `${ops} triangles scanned` : 'KuCoin triangular arb';
      },
      link: '/kucoin-arb',
    },
    {
      key: 'fundingRate' as const,
      name: 'Funding Rate',
      emoji: '💰',
      desc: () => 'Delta-neutral funding harvest',
      link: '/funding-rate',
    },
    {
      key: 'marketMaking' as const,
      name: 'Market Making',
      emoji: '📊',
      desc: () => 'Binance spot MM strategy',
      link: '/market-making',
    },
    {
      key: 'gold' as const,
      name: 'Gold Scalping',
      emoji: '🥇',
      desc: () => 'XAU/USD Exness scalper',
      link: '/gold',
    },
  ];

  return (
    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {botConfig.map(({ key, name, emoji, desc, link }) => {
        const bot = bots[key];
        const status = bot?.status || 'offline';
        const statusColor = status === 'live' ? GREEN : status === 'dry-run' ? YELLOW : '#6b7280';
        const statusLabel = status === 'live' ? 'LIVE' : status === 'dry-run' ? 'DRY RUN' : 'OFFLINE';
        const pnl = (bot?.data as { stats?: { totalProfit?: number } } | null)?.stats?.totalProfit || 0;

        return (
          <a
            key={key}
            href={link}
            style={{
              background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
              padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8,
              textDecoration: 'none', minHeight: 44,
              transition: 'border-color 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 24 }}>{emoji}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}40`, borderRadius: 5, padding: '2px 6px', letterSpacing: 0.5 }}>
                {statusLabel}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1 }}>{name}</div>
            <div style={{ fontSize: 11, color: TEXT2, lineHeight: 1.4 }}>{desc(bot?.data || null)}</div>
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: TEXT2 }}>Today P&L</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: pnl >= 0 ? GREEN : RED }}>
                {pnl >= 0 ? '+' : ''}{fmt(pnl, 4)} USDT
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

// ── Tab: P&L ─────────────────────────────────────────────────────────────────

function TabPnL({ data }: { data: MobileData }) {
  const pnl = data.pnl;
  const bots = data.bots;

  const strategies = [
    { label: 'Tri-Arb',      emoji: '🔺', bot: bots.arb,          isDry: bots.arb?.status === 'dry-run' },
    { label: 'Cross-Arb',    emoji: '⚡', bot: bots.crossArb,     isDry: bots.crossArb?.status === 'dry-run' },
    { label: 'Funding Rate', emoji: '💰', bot: bots.fundingRate,   isDry: bots.fundingRate?.status === 'dry-run' },
    { label: 'Market Making',emoji: '📊', bot: bots.marketMaking,  isDry: bots.marketMaking?.status === 'dry-run' },
    { label: 'KuCoin Arb',  emoji: '🟢', bot: bots.kucoin,        isDry: bots.kucoin?.status === 'dry-run' },
    { label: 'Gold Scalp',  emoji: '🥇', bot: bots.gold,          isDry: bots.gold?.status === 'dry-run' },
  ];

  const maxPnl = Math.max(...strategies.map(s => Math.abs((s.bot?.data as { stats?: { totalProfit?: number } } | null)?.stats?.totalProfit || 0)), 0.001);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Today', val: pnl.today },
          { label: 'All-Time', val: pnl.allTime },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '12px 10px', textAlign: 'center', gridColumn: label === 'Today' ? 'span 1' : 'span 2' }}>
            <div style={{ fontSize: 10, color: TEXT2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: val >= 0 ? GREEN : RED }}>
              {val >= 0 ? '+' : ''}{fmt(val, 4)}
            </div>
            <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>USDT</div>
          </div>
        ))}
      </div>

      {/* Strategy breakdown */}
      <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '16px' }}>
        <div style={{ fontSize: 11, color: TEXT2, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>Strategy Breakdown</div>
        {strategies.map(({ label, emoji, bot, isDry }) => {
          const val = (bot?.data as { stats?: { totalProfit?: number } } | null)?.stats?.totalProfit || 0;
          const pct = Math.min(Math.abs(val) / maxPnl * 100, 100);
          const color = isDry ? TEXT2 : val >= 0 ? GREEN : RED;
          return (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: TEXT1 }}>{emoji} {label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color }}>
                  {isDry && val === 0 ? 'DRY RUN' : `${val >= 0 ? '+' : ''}${fmt(val, 4)}`}
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color === TEXT2 ? 'rgba(255,255,255,0.15)' : color, borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent activity placeholder */}
      <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '16px' }}>
        <div style={{ fontSize: 11, color: TEXT2, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>Recent Activity</div>
        <div style={{ fontSize: 13, color: TEXT2, textAlign: 'center', padding: '20px 0' }}>
          Activity log streams from bot APIs in real-time
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MobileTradingDashboard() {
  const [tab, setTab]         = useState<Tab>('overview');
  const [data, setData]       = useState<MobileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastTs, setLastTs]   = useState<number | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const cachedRef             = useRef<MobileData | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const r = await fetch('/api/mobile-api', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json: MobileData = await r.json();
      setData(json);
      cachedRef.current = json;
      setLastTs(Date.now());
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      if (cachedRef.current) setData(cachedRef.current);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 8000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview',   label: 'Overview',   icon: '🏠' },
    { id: 'positions',  label: 'Positions',  icon: '📈' },
    { id: 'rates',      label: 'Live Rates', icon: '🔥' },
    { id: 'bots',       label: 'Bots',       icon: '🤖' },
    { id: 'pnl',        label: 'P&L',        icon: '💹' },
  ];

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { background: ${BG}; margin: 0; overscroll-behavior: none; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{
        background: BG,
        minHeight: '100dvh',
        maxWidth: 430,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Fixed Header */}
        <div style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          background: `${BG}E8`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${BORDER}`,
          padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 100,
          paddingTop: 'max(12px, env(safe-area-inset-top))',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, letterSpacing: 0.5 }}>⚡ Astraterra Trading</div>
            {error && (
              <div style={{ fontSize: 10, color: YELLOW, marginTop: 2 }}>⚠ {lastTs ? `Last: ${timeAgo(lastTs)}` : 'Offline'}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            {data ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>${fmt(data.portfolio.total)}</div>
                <div style={{ fontSize: 10, color: TEXT2 }}>Total Portfolio</div>
              </>
            ) : (
              <Skeleton w={80} h={20} />
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 70,
          paddingBottom: `calc(80px + env(safe-area-inset-bottom))`,
        }}>
          {loading && !data ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 20 }}>
                  <Skeleton h={14} w="60%" />
                  <div style={{ marginTop: 12 }}><Skeleton h={32} /></div>
                  <div style={{ marginTop: 8 }}><Skeleton h={12} w="40%" /></div>
                </div>
              ))}
            </div>
          ) : data ? (
            <>
              {tab === 'overview'  && <TabOverview  data={data} setTab={setTab} />}
              {tab === 'positions' && <TabPositions data={data} />}
              {tab === 'rates'     && <TabRates     data={data} onRefresh={fetchAll} />}
              {tab === 'bots'      && <TabBots      data={data} />}
              {tab === 'pnl'       && <TabPnL       data={data} />}
            </>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: RED }}>
              Failed to load: {error}
            </div>
          )}
        </div>

        {/* Fixed Bottom Tab Bar */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 430,
          background: `${CARD}F2`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: `1px solid ${BORDER}`,
          display: 'flex',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100,
        }}>
          {tabs.map(({ id, label, icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  flex: 1, padding: '10px 4px', border: 'none', background: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  cursor: 'pointer', minHeight: 56, position: 'relative',
                  borderTop: `2px solid ${active ? GOLD : 'transparent'}`,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? GOLD : TEXT2, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
