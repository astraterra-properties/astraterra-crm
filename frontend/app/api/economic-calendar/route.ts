import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface FFEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

// Keywords that directly affect crypto / gold markets
const CRYPTO_KEYWORDS = ['interest rate', 'fed', 'fomc', 'cpi', 'inflation', 'nfp', 'non-farm', 'gdp', 'ppi', 'unemployment', 'jobs', 'treasury', 'pcai', 'pce', 'powell', 'jolts', 'ism', 'durable', 'retail sales', 'trade balance'];
const GOLD_KEYWORDS   = ['interest rate', 'fed', 'fomc', 'cpi', 'inflation', 'nfp', 'non-farm', 'pce', 'gdp', 'ppi', 'employment', 'powell', 'dollar', 'dxy'];

function relevance(title: string): { crypto: boolean; gold: boolean } {
  const low = title.toLowerCase();
  return {
    crypto: CRYPTO_KEYWORDS.some(k => low.includes(k)),
    gold:   GOLD_KEYWORDS.some(k => low.includes(k)),
  };
}

/**
 * Forex Factory now returns date as a full ISO timestamp e.g. "2026-03-11T08:30:00-04:00"
 * Normalize to:
 *   date: "MM-DD-YYYY"  (UTC date — frontend groups by this)
 *   time: "H:mmam"      (UTC time — frontend adds Dubai +4h offset for display)
 */
function normalizeFFDate(raw: string): { date: string; time: string } {
  try {
    // Handle old "MM-DD-YYYY" format (fallback)
    if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return { date: raw, time: '' };
    const d = new Date(raw);
    if (isNaN(d.getTime())) return { date: raw, time: '' };
    const mon  = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day  = String(d.getUTCDate()).padStart(2, '0');
    const yr   = d.getUTCFullYear();
    const h24  = d.getUTCHours();
    const min  = String(d.getUTCMinutes()).padStart(2, '0');
    const ampm = h24 >= 12 ? 'pm' : 'am';
    const h12  = ((h24 % 12) || 12);
    return { date: `${mon}-${day}-${yr}`, time: `${h12}:${min}${ampm}` };
  } catch { return { date: raw, time: '' }; }
}

export async function GET() {
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 1800 }, // cache 30 min server-side
    });

    if (!res.ok) throw new Error(`FF status ${res.status}`);
    const raw: FFEvent[] = await res.json();

    // Keep only USD/EUR high/medium impact events
    const filtered = raw
      .filter(e => (e.country === 'USD' || e.country === 'EUR') && (e.impact === 'High' || e.impact === 'Medium'))
      .map(e => {
        const { date, time } = normalizeFFDate(e.date);
        return {
          title: e.title,
          country: e.country,
          date,
          time: e.time ?? time,   // prefer original time field if present, else extracted
          impact: e.impact,
          forecast: e.forecast ?? null,
          previous: e.previous ?? null,
          actual: e.actual ?? null,
          ...relevance(e.title),
        };
      })
      .sort((a, b) => {
        const da = new Date(`${a.date} ${a.time}`).getTime();
        const db = new Date(`${b.date} ${b.time}`).getTime();
        return da - db;
      });

    return NextResponse.json({ ok: true, events: filtered, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[economic-calendar]', err);
    return NextResponse.json({ ok: false, events: [], error: String(err) }, { status: 200 });
  }
}
