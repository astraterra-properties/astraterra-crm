'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Shield, Activity } from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG     = '#0a0e1a';
const CARD   = '#111827';
const BORDER = '#1f2937';
const GREEN  = '#10b981';
const YELLOW = '#f59e0b';
const RED    = '#ef4444';
const GOLD   = '#d97706';
const MUTED  = '#6b7280';
const TEXT   = '#e5e7eb';
const API    = '/gold-scalper-api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PauseInfo  { paused: boolean; reason: string | null; remainingMs: number; }
interface MacroFilter {
  canTrade: boolean; riskMultiplier: number; regime: string; reason: string;
  sentimentMultiplier?: number; fearGreed?: { value: number; classification: string; };
}
interface Performance {
  totalPnl: number; totalFees: number; avgSlippage: number; makerPct: number;
  bestTrade: number; worstTrade: number; winRate: number; profitFactor: number;
  maxDrawdown?: number; totalTrades?: number;
}
interface PaperStats {
  canGoLive: boolean; reason: string; totalPaperTrades: number; winRate: number;
  profitFactor: number; maxDrawdown: number; avgDurationMin: number;
  totalFees?: number; totalPnl?: number;
}
interface Signal {
  action?: string; confidence?: number; reason?: string; atr?: number;
  adx15m?: number; spread?: number; spreadLimit?: number; trend?: string;
  htf1hTrend?: string; regime?: string; rsi?: number; macdHistogram?: number;
  currentPrice?: number; sessionName?: string; timestamp?: string;
  ema50_15m?: number; ema200_15m?: number;
}
interface Trade {
  id: string; side: string; entryPrice: number; exitPrice: number; qty: number;
  pnl: number; reason: string; openTime: string; closeTime: string;
  durationMs: number; dryRun: boolean; totalFees?: number; fees?: number;
  session?: string; regime?: string; symbol?: string; signal?: { confidence?: number; };
}
interface Position {
  id: string; side: string; entryPrice: number; qty: number;
  sl: number; tp: number; openTime: string;
}
interface BotStatus {
  version?: string; mode?: string; status?: string; symbol?: string;
  leverage?: number; equity?: number; dailyPnL?: number; dailyPnLPct?: number;
  totalTrades?: number; paperTrades?: number; killSwitch?: boolean;
  consecutiveLosses?: number; consecutiveWins?: number;
  todayTrades?: number; todayMaxReached?: boolean; maxDailyTrades?: number;
  regime?: string; session?: string; atr1m?: number; adx15m?: number;
  htf1hTrend?: string; cooldownActiveMs?: number; cooldownReason?: string;
  pauseActiveUntil?: string; pauseInfo?: PauseInfo;
  currentSignal?: Signal; openPositions?: Position[];
  sessionActive?: boolean; sessionName?: string; lastUpdate?: string;
  paperStats?: PaperStats;
  liveGateStatus?: { canGoLive: boolean; profitFactor?: number; drawdown?: number; winRate?: number; };
  performance?: Performance; macroFilter?: MacroFilter;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return '—'; }
}
function fmtDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function pnlColor(v: number) { return v > 0 ? GREEN : v < 0 ? RED : MUTED; }
function pnlSign(v: number)  { return v >= 0 ? '+' : ''; }

// ── Micro components ──────────────────────────────────────────────────────────

function Pill({ label, color, bg, dot }: { label: string; color: string; bg?: string; dot?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: bg ?? `${color}18`, border: `1px solid ${color}40`,
      color, borderRadius: '20px', padding: '3px 10px',
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.4px', whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />}
      {label}
    </span>
  );
}

function HBar({ value, max, color, height = 6 }: { value: number; max: number; color: string; height?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ background: '#1f2937', borderRadius: '4px', height, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
    </div>
  );
}

function KPICard({
  label, value, sub, color, bar
}: {
  label: string; value: React.ReactNode; sub?: string; color?: string;
  bar?: { value: number; max: number; color: string; targetPct?: number; fromRight?: boolean; };
}) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 16px' }}>
      <div style={{ color: MUTED, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{label}</div>
      <div style={{ color: color ?? TEXT, fontSize: '26px', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1, marginBottom: '8px' }}>{value}</div>
      {bar && (
        <div style={{ position: 'relative', marginBottom: '6px' }}>
          {bar.fromRight ? (
            <div style={{ background: '#1f2937', borderRadius: '4px', height: 6, overflow: 'hidden' }}>
              <div style={{ marginLeft: 'auto', width: `${Math.min(100, (bar.value / bar.max) * 100)}%`, height: '100%', background: bar.color, borderRadius: '4px' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <HBar value={bar.value} max={bar.max} color={bar.color} />
              {bar.targetPct != null && (
                <div style={{ position: 'absolute', left: `${bar.targetPct}%`, top: -2, width: 2, height: 10, background: '#4b5563', borderRadius: 1 }} />
              )}
            </div>
          )}
        </div>
      )}
      {sub && <div style={{ color: MUTED, fontSize: '11px' }}>{sub}</div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GoldBinancePage() {
  const [data, setData]       = useState<BotStatus | null>(null);
  const [history, setHistory] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [actionMsg, setActionMsg]     = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, histRes] = await Promise.all([
        fetch(API),
        fetch(`${API}/history?limit=8`),
      ]);
      if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
      setData(await statusRes.json());
      setError(null);
      if (histRes.ok) { const h = await histRes.json(); setHistory(Array.isArray(h) ? h : []); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fetch error');
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const control = async (action: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    try {
      setActionMsg(`Sending ${action}…`);
      const res = await fetch(`${API}/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const j = await res.json();
      setActionMsg(j.message ?? (res.ok ? '✓ Done' : '✗ Failed'));
      setTimeout(() => setActionMsg(null), 4000);
      fetchData();
    } catch (e: unknown) { setActionMsg(e instanceof Error ? e.message : 'Error'); }
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const mode           = data?.mode ?? 'UNKNOWN';
  const botStatus      = data?.status ?? 'STOPPED';
  const regime         = data?.regime ?? 'UNKNOWN';
  const htfBias        = data?.htf1hTrend ?? 'UNKNOWN';
  const session        = data?.sessionName ?? data?.session ?? 'CLOSED';
  const sessionActive  = data?.sessionActive ?? false;
  const killSwitch     = data?.killSwitch ?? false;
  const consLosses     = data?.consecutiveLosses ?? 0;
  const todayTrades    = data?.todayTrades ?? 0;
  const maxTrades      = data?.maxDailyTrades ?? 12;
  const atr1m          = data?.atr1m ?? 0;
  const adx15m         = data?.adx15m ?? 0;
  const dailyPnL       = data?.dailyPnL ?? 0;
  const equity         = data?.equity ?? 0;
  const perf           = data?.performance;
  const signal         = data?.currentSignal;
  const pauseInfo      = data?.pauseInfo;
  const macroFilter    = data?.macroFilter;
  const riskMultiplier = macroFilter?.riskMultiplier ?? 1.0;
  const positionSizePct = Math.round(riskMultiplier * 100);

  // Cooldown remaining (live countdown)
  const refreshAge      = now - lastRefresh.getTime();
  const cooldownMs      = Math.max(0, (data?.cooldownActiveMs ?? 0) - refreshAge);
  const pauseMs         = Math.max(0, (pauseInfo?.remainingMs ?? 0) - refreshAge);

  // Win rate & profit factor
  const winRate     = perf?.winRate ?? 0;
  const profitFactor = perf?.profitFactor ?? 0;
  const maxDrawdown  = data?.paperStats?.maxDrawdown ?? perf?.maxDrawdown ?? 0;
  const wins        = Math.round((winRate / 100) * (perf?.totalTrades ?? 0));
  const losses      = (perf?.totalTrades ?? 0) - wins;

  // Regime pill color
  function regimeColor(r: string) {
    if (['STRONG_TREND','NORMAL_TREND','BULLISH'].includes(r)) return GREEN;
    if (['CHOPPY','DEAD','BEARISH'].includes(r)) return RED;
    if (['WEAK_TREND','VOLATILE','SENTIMENT_CAUTION'].includes(r)) return YELLOW;
    return MUTED;
  }
  const regColor = regimeColor(regime);

  // Bot status pill
  function botPill() {
    if (botStatus !== 'RUNNING') return { label: '● STOPPED', color: RED };
    if (mode === 'DRY_RUN')      return { label: '● DRY RUN', color: YELLOW };
    return { label: '● LIVE', color: GREEN };
  }
  const bp = botPill();

  // Session pill
  function sessionLabel() {
    if (!sessionActive) return 'SESSION CLOSED';
    const s = session?.replace(/_/g, '-') ?? 'UNKNOWN';
    if (s.includes('LONDON') && s.includes('NY')) return 'LONDON-NY';
    return s;
  }

  // ── Signal quality breakdown ────────────────────────────────────────────────
  const sigConf     = signal?.confidence ?? 0;
  const spread      = signal?.spread ?? 0;
  const spreadLimit = signal?.spreadLimit ?? 0.08;

  // Derive sub-scores from real data
  const htfAligned  = signal?.trend === signal?.htf1hTrend || (htfBias !== 'UNKNOWN' && signal?.action === (htfBias === 'BULLISH' ? 'BUY' : 'SELL'));
  const htfScore    = htfAligned ? 30 : 0;
  const adxScore    = Math.round(Math.min(1, adx15m / 40) * 25);
  const sessionScore = sessionActive ? 20 : 0;
  const confScore   = Math.round((sigConf / 100) * 15);
  const spreadOK    = spread < spreadLimit;
  const spreadScore = spreadOK ? 15 : 0;
  const totalScore  = htfScore + adxScore + sessionScore + confScore + spreadScore;
  const maxScore    = 105;

  function scoreColor(s: number, max: number) {
    const pct = s / max;
    if (pct >= 0.57) return GREEN;
    if (pct >= 0.38) return YELLOW;
    return RED;
  }
  const scoreC = scoreColor(totalScore, maxScore);

  function scoreLabel(s: number) {
    if (s >= 60) return 'HIGH CONFIDENCE';
    if (s >= 40) return 'MODERATE';
    return 'LOW CONFIDENCE';
  }

  // ── Entry status ────────────────────────────────────────────────────────────
  function entryStatus() {
    if (killSwitch)         return { ok: false, msg: 'KILL SWITCH ACTIVE — trading halted' };
    if (pauseInfo?.paused)  return { ok: false, msg: `PAUSED: ${pauseInfo?.reason ?? 'cooldown'} — ${fmtDuration(pauseMs)} remaining` };
    if (!sessionActive)     return { ok: false, msg: 'OUT OF SESSION — waiting for trading hours' };
    if (data?.todayMaxReached) return { ok: false, msg: `DAILY LIMIT REACHED — ${maxTrades} trades completed` };
    if (['CHOPPY','DEAD'].includes(regime)) return { ok: false, msg: 'DEAD MARKET — no volatility detected' };
    return { ok: true, msg: 'CONDITIONS MET — awaiting signal' };
  }
  const entry = entryStatus();

  if (loading) return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: GOLD, fontSize: '18px', fontFamily: 'monospace' }}>Loading Gold Scalper…</div>
    </div>
  );

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'system-ui, sans-serif', padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — TOP STATUS BAR                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px',
        padding: '10px 16px', marginBottom: '16px',
        display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
      }}>
        {/* Bot status */}
        <Pill label={bp.label} color={bp.color} dot={false} />

        {/* Regime */}
        <Pill
          label={`${htfBias === 'BULLISH' ? '📈' : htfBias === 'BEARISH' ? '📉' : '↔'} ${regime.replace(/_/g, ' ')}`}
          color={regColor}
        />

        {/* Session */}
        <Pill label={sessionLabel()} color={sessionActive ? GREEN : RED} />

        {/* Mode badge */}
        {mode === 'DRY_RUN' && <Pill label="DRY RUN" color={YELLOW} />}
        {mode === 'LIVE'    && <Pill label="🔴 LIVE TRADING" color={RED} />}

        {/* Kill switch warning */}
        {killSwitch && <Pill label="⚠ KILL SWITCH" color={RED} />}

        {/* Macro */}
        {macroFilter && !macroFilter.canTrade && (
          <Pill label={`MACRO: ${macroFilter.regime.replace(/_/g, ' ')}`} color={YELLOW} />
        )}

        {/* Spacer + last scan */}
        <div style={{ marginLeft: 'auto', color: MUTED, fontSize: '11px', fontFamily: 'monospace' }}>
          Last scan: {fmtTime(data?.lastUpdate)} &nbsp;·&nbsp;
          {error ? <span style={{ color: RED }}>⚠ {error}</span> : <span style={{ color: GREEN }}>●</span>}
        </div>

        <button onClick={fetchData} style={{
          background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED,
          borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
        }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Action feedback */}
      {actionMsg && (
        <div style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}40`, borderRadius: '8px', padding: '8px 16px', marginBottom: '12px', color: GOLD, fontSize: '13px' }}>
          ⚡ {actionMsg}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — PERFORMANCE PANEL (4 KPI cards)                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>

        {/* Win Rate */}
        <KPICard
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          color={winRate >= 55 ? GREEN : winRate >= 45 ? YELLOW : RED}
          bar={{ value: winRate, max: 100, color: winRate >= 55 ? GREEN : YELLOW, targetPct: 55 }}
          sub={`${wins} wins / ${losses} losses`}
        />

        {/* Profit Factor */}
        <KPICard
          label="Profit Factor"
          value={profitFactor.toFixed(2)}
          color={profitFactor >= 1.5 ? GREEN : profitFactor >= 1.0 ? YELLOW : RED}
          bar={{ value: Math.min(profitFactor, 3), max: 3, color: profitFactor >= 1.5 ? GREEN : profitFactor >= 1 ? YELLOW : RED }}
          sub="Target: >1.5"
        />

        {/* Daily P&L */}
        <KPICard
          label="Daily P&L"
          value={`${pnlSign(dailyPnL)}$${Math.abs(dailyPnL).toFixed(2)}`}
          color={pnlColor(dailyPnL)}
          sub={`${todayTrades} trade${todayTrades !== 1 ? 's' : ''} today${data?.todayMaxReached ? ' · ⚠ limit' : ''}`}
        />

        {/* Drawdown */}
        <KPICard
          label="Max Drawdown"
          value={`${maxDrawdown.toFixed(2)}%`}
          color={maxDrawdown > 5 ? RED : maxDrawdown > 2 ? YELLOW : GREEN}
          bar={{ value: maxDrawdown, max: 10, color: RED, fromRight: true }}
          sub={`Equity: $${equity.toFixed(2)}`}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — RISK CONTROL PANEL                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: CARD, border: `1px solid ${killSwitch || consLosses >= 4 ? RED + '60' : consLosses >= 2 ? YELLOW + '60' : BORDER}`,
        borderRadius: '12px', padding: '18px', marginBottom: '16px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={14} color={GOLD} />
            <span style={{ color: GOLD, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Risk Monitor</span>
          </div>
          {macroFilter?.reason && (
            <span style={{ color: MUTED, fontSize: '11px' }}>{macroFilter.reason}</span>
          )}
        </div>

        {/* Grid: consec losses + position size + cooldown + kill switch */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '12px' }}>

          {/* Consecutive losses */}
          <div>
            <div style={{ color: MUTED, fontSize: '10px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Consecutive Losses</div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '4px' }}>
              {[...Array(7)].map((_, i) => {
                const filled = i < consLosses;
                const dotColor = consLosses >= 4 ? RED : consLosses >= 2 ? YELLOW : GREEN;
                return (
                  <div key={i} style={{
                    width: '14px', height: '14px', borderRadius: '3px',
                    background: filled ? dotColor : `${dotColor}20`,
                    border: `1px solid ${dotColor}40`,
                  }} />
                );
              })}
              <span style={{ color: consLosses >= 4 ? RED : consLosses >= 2 ? YELLOW : GREEN, fontSize: '12px', fontWeight: 700, marginLeft: '4px' }}>
                {consLosses}/7
              </span>
            </div>
          </div>

          {/* Position size */}
          <div>
            <div style={{ color: MUTED, fontSize: '10px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Position Size</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: positionSizePct >= 90 ? GREEN : positionSizePct >= 60 ? YELLOW : RED, fontSize: '22px', fontWeight: 800, fontFamily: 'monospace' }}>
                {positionSizePct}%
              </span>
            </div>
            <HBar value={positionSizePct} max={100} color={positionSizePct >= 90 ? GREEN : positionSizePct >= 60 ? YELLOW : RED} height={5} />
          </div>

          {/* Cooldown */}
          <div>
            <div style={{ color: MUTED, fontSize: '10px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Entry Cooldown</div>
            {cooldownMs > 0 ? (
              <>
                <div style={{ color: YELLOW, fontSize: '18px', fontWeight: 800, fontFamily: 'monospace' }}>⏳ {fmtDuration(cooldownMs)}</div>
                <div style={{ color: MUTED, fontSize: '10px', marginTop: '2px' }}>Reason: {data?.cooldownReason ?? '—'}</div>
              </>
            ) : pauseInfo?.paused ? (
              <>
                <div style={{ color: RED, fontSize: '18px', fontWeight: 800, fontFamily: 'monospace' }}>PAUSED {fmtDuration(pauseMs)}</div>
                <div style={{ color: MUTED, fontSize: '10px', marginTop: '2px' }}>{pauseInfo.reason}</div>
              </>
            ) : (
              <div style={{ color: GREEN, fontSize: '18px', fontWeight: 800, fontFamily: 'monospace' }}>✓ READY</div>
            )}
          </div>

          {/* Kill switch */}
          <div>
            <div style={{ color: MUTED, fontSize: '10px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Kill Switch</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '40px', height: '20px', borderRadius: '10px',
                background: killSwitch ? RED : '#374151',
                position: 'relative', cursor: 'default',
              }}>
                <div style={{
                  position: 'absolute', top: '3px',
                  left: killSwitch ? '22px' : '3px',
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: killSwitch ? '#fff' : '#9ca3af',
                  transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ color: killSwitch ? RED : GREEN, fontSize: '13px', fontWeight: 700 }}>
                {killSwitch ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            {killSwitch && (
              <button onClick={() => control('reset_kill_switch')} style={{
                marginTop: '6px', background: `${GREEN}15`, border: `1px solid ${GREEN}40`,
                color: GREEN, borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px',
              }}>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Alert banners */}
        {killSwitch && (
          <div style={{ background: `${RED}15`, border: `1px solid ${RED}50`, borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} color={RED} />
            <span style={{ color: RED, fontSize: '12px', fontWeight: 600 }}>
              🔴 KILL SWITCH ACTIVE — {consLosses} consecutive losses. All trading halted until manual reset.
            </span>
          </div>
        )}
        {!killSwitch && consLosses >= 3 && (
          <div style={{ background: `${YELLOW}12`, border: `1px solid ${YELLOW}50`, borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} color={YELLOW} />
            <span style={{ color: YELLOW, fontSize: '12px', fontWeight: 600 }}>
              ⚠ WARNING: {consLosses} consecutive losses — position size reduced to {positionSizePct}%
            </span>
          </div>
        )}
        {pauseInfo?.paused && !killSwitch && (
          <div style={{ background: `${YELLOW}12`, border: `1px solid ${YELLOW}50`, borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: killSwitch || consLosses >= 3 ? '8px' : '0' }}>
            <AlertTriangle size={14} color={YELLOW} />
            <span style={{ color: YELLOW, fontSize: '12px', fontWeight: 600 }}>
              ⏸ AUTO-PAUSED: {pauseInfo.reason} — resumes in {fmtDuration(pauseMs)}
            </span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3B — LIVE PRICE CHART (XAUUSDT 1H)                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', marginBottom: '16px', minHeight: '320px' }}>
        <div style={{ color: GOLD, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>XAUUSDT Live Chart (1H)</span>
          <span style={{ fontSize: '11px', color: MUTED }}>Last 20 candles</span>
        </div>
        <LivePriceChart />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — MARKET INTELLIGENCE                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
          Market Conditions
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Regime row */}
          <MarketRow
            label="Regime"
            pill={regime.replace(/_/g, ' ')}
            pillColor={regColor}
            bar={{ value: adx15m, max: 50, color: regColor }}
            detail={`ADX ${adx15m.toFixed(1)}`}
            status={['STRONG_TREND','NORMAL_TREND'].includes(regime) ? 'ok' : ['CHOPPY','DEAD'].includes(regime) ? 'bad' : 'warn'}
          />

          {/* Volatility row */}
          <MarketRow
            label="Volatility"
            pill={atr1m > 5 ? 'HIGH' : atr1m > 2 ? 'NORMAL' : 'LOW'}
            pillColor={atr1m > 5 ? YELLOW : atr1m > 2 ? GREEN : RED}
            bar={{ value: Math.min(atr1m, 10), max: 10, color: atr1m > 5 ? YELLOW : GREEN }}
            detail={`ATR $${atr1m.toFixed(2)}`}
            status={atr1m > 1 ? 'ok' : 'bad'}
          />

          {/* HTF Bias row */}
          <MarketRow
            label="HTF Bias"
            pill={htfBias}
            pillColor={htfBias === 'BULLISH' ? GREEN : htfBias === 'BEARISH' ? RED : MUTED}
            bar={undefined}
            detail={signal?.ema50_15m && signal?.ema200_15m
              ? `EMA50 ${signal.ema50_15m > signal.ema200_15m ? '>' : '<'} EMA200`
              : `1H Trend`}
            status={htfBias !== 'UNKNOWN' ? 'ok' : 'warn'}
          />

          {/* Session row */}
          <MarketRow
            label="Session"
            pill={sessionLabel()}
            pillColor={sessionActive ? GREEN : RED}
            bar={undefined}
            detail={sessionActive ? 'Liquidity window active' : 'Outside session hours'}
            status={sessionActive ? 'ok' : 'bad'}
          />

          {/* Spread row */}
          <MarketRow
            label="Spread"
            pill={spreadOK ? 'GOOD' : 'WIDE'}
            pillColor={spreadOK ? GREEN : RED}
            bar={undefined}
            detail={`${(spread * 100).toFixed(4)}% · limit ${(spreadLimit * 100).toFixed(2)}%`}
            status={spreadOK ? 'ok' : 'bad'}
          />

          {/* Macro filter row */}
          {macroFilter && (
            <MarketRow
              label="Macro Filter"
              pill={macroFilter.canTrade ? 'CLEAR' : 'CAUTION'}
              pillColor={macroFilter.canTrade ? GREEN : YELLOW}
              bar={undefined}
              detail={macroFilter.fearGreed ? `Fear&Greed: ${macroFilter.fearGreed.value} (${macroFilter.fearGreed.classification})` : macroFilter.reason}
              status={macroFilter.canTrade ? 'ok' : 'warn'}
            />
          )}

        </div>

        {/* Entry status summary */}
        <div style={{
          marginTop: '14px', borderTop: `1px solid ${BORDER}`, paddingTop: '12px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '16px' }}>{entry.ok ? '✅' : '❌'}</span>
          <span style={{ color: entry.ok ? GREEN : RED, fontSize: '12px', fontWeight: 700 }}>{entry.msg}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — SIGNAL QUALITY METER                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ color: GOLD, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Signal Quality</div>
          <div style={{ color: scoreC, fontFamily: 'monospace', fontWeight: 800, fontSize: '16px' }}>
            Score: {totalScore}/{maxScore}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          <SignalRow label="HTF Alignment"     score={htfScore}    max={30} color={htfScore === 30 ? GREEN : RED} />
          <SignalRow label="Trend Strength (ADX)" score={adxScore} max={25} color={adxScore >= 20 ? GREEN : adxScore >= 10 ? YELLOW : RED} />
          <SignalRow label="Session Quality"   score={sessionScore} max={20} color={sessionScore === 20 ? GREEN : RED} />
          <SignalRow label="Signal Confidence" score={confScore}    max={15} color={confScore >= 10 ? GREEN : confScore >= 6 ? YELLOW : RED} />
          <SignalRow label="Spread Quality"    score={spreadScore}  max={15} color={spreadScore === 15 ? GREEN : RED} />
        </div>

        {/* Total bar */}
        <div style={{ background: '#1f2937', borderRadius: '6px', height: '10px', marginBottom: '8px', overflow: 'hidden' }}>
          <div style={{
            width: `${(totalScore / maxScore) * 100}%`, height: '100%',
            background: `linear-gradient(90deg, ${scoreC}cc, ${scoreC})`,
            borderRadius: '6px', transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: MUTED, fontSize: '11px' }}>Threshold: 60 — {totalScore >= 60 ? '✅ QUALIFIED TO TRADE' : '❌ BELOW THRESHOLD'}</span>
          <span style={{
            background: `${scoreC}20`, border: `1px solid ${scoreC}50`, color: scoreC,
            borderRadius: '6px', padding: '2px 10px', fontSize: '11px', fontWeight: 700,
          }}>{scoreLabel(totalScore)}</span>
        </div>

        {/* Current signal reason */}
        {signal?.reason && (
          <div style={{ marginTop: '12px', borderTop: `1px solid ${BORDER}`, paddingTop: '10px' }}>
            <div style={{ color: MUTED, fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase' }}>Latest Signal</div>
            <div style={{ color: signal.action === 'BUY' ? GREEN : signal.action === 'SELL' ? RED : TEXT, fontSize: '12px', fontFamily: 'monospace', lineHeight: 1.5 }}>
              {signal.action ? <strong>[{signal.action}] </strong> : null}{signal.reason}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6 — RECENT TRADES (last 8)                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
          Recent Trades
        </div>
        {history.length === 0 ? (
          <div style={{ color: MUTED, textAlign: 'center', padding: '24px', fontSize: '13px' }}>
            No trades yet — accumulating paper history…
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Time', 'Pair', 'Dir', 'Entry', 'Exit', 'P&L', 'Duration', ''].map((h, i) => (
                    <th key={i} style={{ padding: '7px 10px', textAlign: 'left', color: MUTED, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map((t, i) => {
                  const win = t.pnl > 0;
                  return (
                    <tr key={t.id ?? i} style={{
                      borderBottom: `1px solid ${BORDER}30`,
                      background: i % 2 === 0 ? 'transparent' : `${BORDER}20`,
                    }}>
                      <td style={{ padding: '9px 10px', color: MUTED, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {fmtTime(t.closeTime)}
                      </td>
                      <td style={{ padding: '9px 10px', color: TEXT, fontWeight: 600 }}>
                        {t.symbol ?? 'XAUUSDT'}
                      </td>
                      <td style={{ padding: '9px 10px', color: t.side === 'BUY' ? GREEN : RED, fontWeight: 700, fontFamily: 'monospace' }}>
                        {t.side === 'BUY' ? '▲ LONG' : '▼ SHORT'}
                      </td>
                      <td style={{ padding: '9px 10px', color: GOLD, fontFamily: 'monospace' }}>
                        ${t.entryPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: '9px 10px', color: TEXT, fontFamily: 'monospace' }}>
                        ${t.exitPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: '9px 10px', color: pnlColor(t.pnl), fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {pnlSign(t.pnl)}${Math.abs(t.pnl).toFixed(2)}
                      </td>
                      <td style={{ padding: '9px 10px', color: MUTED, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {fmtDuration(t.durationMs)}
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{
                          background: win ? `${GREEN}20` : `${RED}20`,
                          color: win ? GREEN : RED,
                          border: `1px solid ${win ? GREEN : RED}40`,
                          borderRadius: '4px', padding: '2px 7px', fontSize: '10px', fontWeight: 700,
                        }}>
                          {win ? '✓ WIN' : '✗ LOSS'}
                        </span>
                        {t.reason && (
                          <span style={{ color: MUTED, fontSize: '10px', marginLeft: '4px' }}>({t.reason})</span>
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CONTROLS (keep for operations)                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Activity size={13} color={GOLD} />
          <span style={{ color: GOLD, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Controls</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { label: '▶ Start',       action: 'start',        color: GREEN },
            { label: '⏹ Stop',        action: 'stop',         color: MUTED },
            { label: '📄 Dry Run',    action: 'dry_run',      color: YELLOW },
            { label: '▶ Reset Pause', action: 'reset_pause',  color: GREEN },
            { label: '🔓 Reset Kill', action: 'reset_kill_switch', color: YELLOW },
          ].map(btn => (
            <button key={btn.action} onClick={() => control(btn.action)} style={{
              background: `${btn.color}15`, border: `1px solid ${btn.color}40`,
              color: btn.color, borderRadius: '8px', padding: '7px 14px',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}>
              {btn.label}
            </button>
          ))}
          <button onClick={() => control('emergency_close', '⚠ EMERGENCY CLOSE ALL positions?')} style={{
            background: `${RED}20`, border: `1px solid ${RED}50`,
            color: RED, borderRadius: '8px', padding: '7px 14px',
            cursor: 'pointer', fontSize: '12px', fontWeight: 700,
          }}>
            🚨 Emergency Close
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#374151', fontSize: '10px', paddingBottom: '16px', fontFamily: 'monospace' }}>
        Gold Scalper v{data?.version ?? '2.1'} · XAUUSDT × {data?.leverage ?? 10}x · {mode} MODE · 5s scan
        &nbsp;·&nbsp; Last refresh: {lastRefresh.toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai', hour12: false })} UAE
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MarketRow({ label, pill, pillColor, bar, detail, status }: {
  label: string; pill: string; pillColor: string;
  bar?: { value: number; max: number; color: string; } | undefined;
  detail: string; status: 'ok' | 'warn' | 'bad';
}) {
  const statusIcon = status === 'ok' ? '●' : status === 'warn' ? '◐' : '○';
  const statusColor = status === 'ok' ? GREEN : status === 'warn' ? YELLOW : RED;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: `1px solid ${BORDER}30` }}>
      <div style={{ color: MUTED, fontSize: '11px', fontWeight: 600, width: '110px', flexShrink: 0 }}>{label}</div>
      <span style={{
        background: `${pillColor}18`, border: `1px solid ${pillColor}40`, color: pillColor,
        borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 700,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>{pill}</span>
      {bar && (
        <div style={{ flex: '1 1 80px', maxWidth: '120px' }}>
          <HBar value={bar.value} max={bar.max} color={bar.color} height={4} />
        </div>
      )}
      <div style={{ color: MUTED, fontSize: '11px', flex: 1 }}>{detail}</div>
      <span style={{ color: statusColor, fontSize: '12px', flexShrink: 0 }}>{statusIcon}</span>
    </div>
  );
}

function SignalRow({ label, score, max, color }: { label: string; score: number; max: number; color: string; }) {
  const pct = Math.min(100, (score / max) * 100);
  const icon = score === max ? '✅' : score === 0 ? '❌' : '⚠️';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ color: MUTED, fontSize: '11px', width: '160px', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: '#1f2937', borderRadius: '3px', height: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px' }} />
      </div>
      <div style={{ color, fontSize: '11px', fontFamily: 'monospace', width: '40px', textAlign: 'right', flexShrink: 0 }}>
        {score}/{max}
      </div>
      <div style={{ fontSize: '12px', width: '20px', flexShrink: 0 }}>{icon}</div>
    </div>
  );
}

function LivePriceChart() {
  // Color palette
  const WHITE = '#f8f9fa';
  const GREEN = '#10b981';
  const RED = '#ef4444';
  const MUTED = '#64748b';
  const BORDER = '#1f2937';

  const [candles, setCandles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch24hData = async () => {
      try {
        // Fetch 1h candles (last 20) + 24h stats
        const klineRes = await fetch('https://fapi.binance.com/fapi/v1/klines?symbol=XAUUSDT&interval=1h&limit=20');
        const stats24hRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=XAUUSDT');
        
        if (!klineRes.ok || !stats24hRes.ok) throw new Error('API failed');
        
        const klines = await klineRes.json();
        const stats24h = await stats24hRes.json();
        
        const processed = klines.map((k: any) => ({
          time: parseInt(k[0]),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[7]),
        }));
        
        setCandles(processed);
        setError('');
      } catch (e) {
        setError('Chart data unavailable');
      } finally {
        setLoading(false);
      }
    };

    fetch24hData();
    const interval = setInterval(fetch24hData, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ color: MUTED, fontSize: '12px', textAlign: 'center', padding: '40px' }}>Loading chart...</div>;
  if (error || !candles.length) return <div style={{ color: RED, fontSize: '12px', textAlign: 'center', padding: '40px' }}>{error || 'No data'}</div>;

  const prices = candles.map(c => c.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 0.1;
  const current = candles[candles.length - 1]?.close || 0;
  const change = current - candles[0]?.open || 0;
  const changePct = range > 0 ? (change / (candles[0]?.open || 1)) * 100 : 0;

  const candleWidth = 12;  // pixels per candle
  const candleSpacing = 2; // spacing between candles
  const w = candleWidth;
  const h = 300; // increased chart height
  const viewBoxWidth = candles.length * (candleWidth + candleSpacing) + 40; // add padding

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Price ticker */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: WHITE, fontFamily: 'monospace' }}>
            ${current.toFixed(2)}
          </span>
          <span style={{ fontSize: '14px', color: changePct > 0 ? GREEN : RED, fontWeight: 600 }}>
            {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
        <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: MUTED }}>
          <span>24H High: <span style={{ color: WHITE, fontWeight: 600 }}>${max.toFixed(2)}</span></span>
          <span>24H Low: <span style={{ color: WHITE, fontWeight: 600 }}>${min.toFixed(2)}</span></span>
        </div>
      </div>

      {/* Candlestick chart — increased height & proper proportions */}
      <div style={{ width: '100%', height: '420px', border: `1px solid ${BORDER}`, borderRadius: '6px', background: '#0a0e1a', overflow: 'auto' }}>
      <svg viewBox={`0 0 ${viewBoxWidth} ${h}`} style={{ width: '100%', height: '420px', minWidth: `${viewBoxWidth}px` }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
          <line key={`grid-${ratio}`} x1="0" y1={h * (1 - ratio)} x2={viewBoxWidth} y2={h * (1 - ratio)} stroke="#1f2937" strokeWidth="1" opacity="0.4" />
        ))}

        {/* Candles */}
        {candles.map((c, i) => {
          const yClose = h * (1 - (c.close - min) / range);
          const yOpen = h * (1 - (c.open - min) / range);
          const yHigh = h * (1 - (c.high - min) / range);
          const yLow = h * (1 - (c.low - min) / range);
          const x = 20 + i * (candleWidth + candleSpacing);
          const isGreen = c.close >= c.open;
          const bodyMin = Math.min(yClose, yOpen);
          const bodyMax = Math.max(yClose, yOpen);
          const bodyH = Math.max(1.5, bodyMax - bodyMin);

          return (
            <g key={`candle-${i}`}>
              {/* Wick */}
              <line x1={x + candleWidth / 2} y1={yHigh} x2={x + candleWidth / 2} y2={yLow} stroke={isGreen ? GREEN : RED} strokeWidth="1.2" opacity="0.8" />
              {/* Body */}
              <rect x={x} y={bodyMin} width={candleWidth} height={bodyH} fill={isGreen ? GREEN : RED} opacity="0.85" rx="1.5" />
            </g>
          );
        })}
      </svg>
      </div>

      <div style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>Updates every minute • Binance XAUUSDT 1H</div>
    </div>
  );
}
