'use client';
import Link from 'next/link';
import { useBetSlipStore } from '../lib/betSlipStore';

interface Outcome { name: string; price: number; point?: number; }
interface Market { key: string; outcomes?: Outcome[]; }
interface Bookmaker { markets?: Market[]; }
interface EventCardProps {
  event: {
    id: string;
    home: { name: string };
    away: { name: string };
    time?: number;
    league?: { name: string };
    sport_id?: string;
    bookmakers?: Bookmaker[];
  };
}

const MARGIN = 0.05;
const MAX_ODDS = 50;

function applyMargin(o: number): number {
  if (!o || o <= 1) return 0;
  const p = Math.min(0.97, (1 / o) * (1 + MARGIN));
  const r = parseFloat((1 / p).toFixed(2));
  return r > MAX_ODDS || r <= 1 ? 0 : r;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function estimateOdds(home: string, away: string) {
  const hv = hashStr(home + away);
  const pH = 0.30 + (hv % 1000) / 4000;
  const pD = 0.22 + ((hv >> 4) % 500) / 5000;
  const pA = Math.max(0.05, 1 - pH - pD);
  const sum = pH + pD + pA;
  const m = MARGIN;
  const toOdd = (p: number) => parseFloat(((1 + m) / Math.max(0.01, p)).toFixed(2));
  const lH = 0.7 * pH + 1.1 * pD + 1.5 * pA + 0.8;
  const lA = 1.5 * pH + 1.1 * pD + 0.7 * pA + 0.5;
  const lT = lH + lA;
  const pO25 = 1 - Math.exp(-lT) * (1 + lT + lT * lT / 2);
  const pGG = Math.min(0.78, Math.max(0.28, 0.52 + (pA / sum) * 0.35 + (pH / sum) * 0.18));
  return {
    h2h: { home: toOdd(pH / sum), draw: toOdd(pD / sum), away: toOdd(pA / sum) },
    ou25: { over: toOdd(pO25), under: toOdd(1 - pO25) },
    ggng: { gg: toOdd(pGG), ng: toOdd(1 - pGG) },
    estimated: true, totalMarkets: 0,
  };
}

function extractOdds(event: EventCardProps['event']) {
  const bks = event.bookmakers ?? [];
  const home = event.home?.name ?? '', away = event.away?.name ?? '';
  let rawH = 0, rawD = 0, rawA = 0;
  let ou25: { over: number; under: number } | null = null;
  let totalMarkets = 0;

  for (const bk of bks) {
    totalMarkets = Math.max(totalMarkets, bk.markets?.length ?? 0);
    for (const m of bk.markets ?? []) {
      if (m.key === 'h2h' && !rawH) {
        const oc = m.outcomes ?? [];
        let h = oc.find(o => o.name === home)?.price ?? 0;
        let d = oc.find(o => o.name === 'Draw')?.price ?? 0;
        let a = oc.find(o => o.name === away)?.price ?? 0;
        if (!h && oc.length >= 2) { const nd = oc.filter(o => o.name !== 'Draw'); h = nd[0]?.price ?? 0; a = nd[1]?.price ?? 0; }
        if (h > MAX_ODDS) h = 0; if (a > MAX_ODDS) a = 0; if (d > MAX_ODDS) d = 0;
        if (h > 1 && a > 1) { rawH = h; rawD = d; rawA = a; }
      }
      if (m.key === 'totals' && !ou25) {
        const oc = m.outcomes ?? [];
        const ov = oc.find(o => o.name === 'Over' && (o.point === 2.5 || !o.point))?.price ?? oc.find(o => o.name === 'Over')?.price ?? 0;
        const un = oc.find(o => o.name === 'Under' && (o.point === 2.5 || !o.point))?.price ?? oc.find(o => o.name === 'Under')?.price ?? 0;
        if (ov > 1 && un > 1) ou25 = { over: applyMargin(ov), under: applyMargin(un) };
      }
    }
  }

  if (!rawH) return estimateOdds(home, away);

  const h2h = { home: applyMargin(rawH), draw: rawD > 1 ? applyMargin(rawD) : 0, away: applyMargin(rawA) };
  const iH = 1/rawH, iD = rawD > 1 ? 1/rawD : 0.28, iA = 1/rawA, tot = iH + iD + iA;
  const pH = iH/tot, pA = iA/tot;
  const pGG = Math.min(0.78, Math.max(0.28, 0.52 + pA * 0.35 + pH * 0.18));
  const ggng = { gg: parseFloat(((1+MARGIN)/pGG).toFixed(2)), ng: parseFloat(((1+MARGIN)/(1-pGG)).toFixed(2)) };
  return { h2h, ou25, ggng, totalMarkets, estimated: false };
}

function formatTime(ts?: number) {
  if (!ts) return { day: '—', time: '' };
  const d = new Date(ts * 1000), today = new Date(), tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return { day: 'Oggi', time };
  if (d.toDateString() === tomorrow.toDateString()) return { day: 'Domani', time };
  return { day: d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }), time };
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Bottone quota stile enterprise
function OddsBtn({ label, val, outcome, eventId, eventName, market, estimated }: {
  label: string; val: number; outcome: string; eventId: string; eventName: string; market: string; estimated?: boolean;
}) {
  const { addSelection, removeSelection, selections } = useBetSlipStore();
  const selected = selections.some(s => s.event_id === eventId && s.outcome === outcome);
  const valid = val > 1.01;

  function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!valid) return;
    if (selected) removeSelection(eventId, outcome);
    else addSelection({ event_id: eventId, nome_evento: eventName, quota: val, market, outcome });
  }

  return (
    <button onClick={toggle} disabled={!valid}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: 52, height: 36, padding: '2px 4px', gap: 1,
        background: selected
          ? 'linear-gradient(145deg, rgba(0,180,216,0.22), rgba(0,212,170,0.15))'
          : 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
        border: selected ? '1px solid rgba(0,180,216,0.75)' : '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, cursor: valid ? 'pointer' : 'default',
        transition: 'all 0.14s ease',
        boxShadow: selected ? '0 6px 18px rgba(0,180,216,0.2)' : 'none',
      }}
      onMouseEnter={e => { if (!selected && valid) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(145deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'; }}
    >
      <span style={{ fontSize: 7, fontWeight: 700, color: selected ? 'rgba(0,180,216,0.7)' : '#2e4460', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 900, color: selected ? '#00d8ff' : estimated ? '#8aa0b0' : '#c8dce8', lineHeight: 1 }}>
        {valid ? val.toFixed(2) : '—'}
      </span>
    </button>
  );
}

export default function EventCard({ event }: EventCardProps) {
  const home = event.home?.name ?? '?', away = event.away?.name ?? '?';
  const eventName = `${home} vs ${away}`;
  const odds = extractOdds(event);
  const { day, time } = formatTime(event.time);

  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{
        display: 'flex', alignItems: 'center', minHeight: 38,
        background: 'linear-gradient(180deg, rgba(9,14,21,0.95), rgba(8,12,18,0.95))', borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer', transition: 'background 0.12s ease, transform 0.12s ease', position: 'relative',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(14,20,32,0.98), rgba(11,16,24,0.98))'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(9,14,21,0.95), rgba(8,12,18,0.95))'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {/* Accent bar */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'transparent', transition: 'background 0.1s' }}
          onMouseEnter={e => ((e.currentTarget.parentElement as HTMLElement).style.background = '#0d1220')}
        />

        {/* Orario */}
        <div style={{ width: 50, flexShrink: 0, padding: '0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(255,255,255,0.06)', alignSelf: 'stretch', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#2e4460', lineHeight: 1 }}>{day}</span>
          {time && <span style={{ fontSize: 10, fontWeight: 800, color: '#4a6a88', lineHeight: 1 }}>{time}</span>}
        </div>

        {/* Squadre */}
        <div style={{ flex: 1, padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 800, color: '#dff5ff',
              background: 'linear-gradient(135deg, rgba(0,180,216,0.45), rgba(0,212,170,0.25))',
              border: '1px solid rgba(0,180,216,0.45)',
              flexShrink: 0,
            }}>{initials(home)}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#c8dce8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{home}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 800, color: '#ffe7ef',
              background: 'linear-gradient(135deg, rgba(255,77,109,0.4), rgba(255,127,80,0.25))',
              border: '1px solid rgba(255,77,109,0.45)',
              flexShrink: 0,
            }}>{initials(away)}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#c8dce8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{away}</span>
          </div>
        </div>

        {/* 1X2 */}
        <div style={{ display: 'flex', gap: 2, padding: '0 6px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.05)' }} onClick={e => e.preventDefault()}>
          <OddsBtn label="1" val={odds.h2h?.home ?? 0} outcome="1" eventId={event.id} eventName={eventName} market="1X2" estimated={odds.estimated} />
          <OddsBtn label="X" val={odds.h2h?.draw ?? 0} outcome="X" eventId={event.id} eventName={eventName} market="1X2" estimated={odds.estimated} />
          <OddsBtn label="2" val={odds.h2h?.away ?? 0} outcome="2" eventId={event.id} eventName={eventName} market="1X2" estimated={odds.estimated} />
        </div>

        {/* O/U 2.5 */}
        <div style={{ display: 'flex', gap: 2, padding: '0 6px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.05)' }} onClick={e => e.preventDefault()}>
          <OddsBtn label="Ov" val={odds.ou25?.over ?? 0} outcome="Over 2.5" eventId={event.id} eventName={eventName} market="O/U 2.5" estimated={odds.estimated} />
          <OddsBtn label="Un" val={odds.ou25?.under ?? 0} outcome="Under 2.5" eventId={event.id} eventName={eventName} market="O/U 2.5" estimated={odds.estimated} />
        </div>

        {/* GG/NG */}
        <div style={{ display: 'flex', gap: 2, padding: '0 6px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.05)' }} onClick={e => e.preventDefault()}>
          <OddsBtn label="GG" val={odds.ggng?.gg ?? 0} outcome="GG" eventId={event.id} eventName={eventName} market="GG/NG" estimated={odds.estimated} />
          <OddsBtn label="NG" val={odds.ggng?.ng ?? 0} outcome="NG" eventId={event.id} eventName={eventName} market="GG/NG" estimated={odds.estimated} />
        </div>

        {/* +Mercati */}
        <div style={{ padding: '0 8px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#2e4460', minWidth: 28, textAlign: 'center' }}>
            {odds.estimated ? '~' : odds.totalMarkets > 0 ? `+${odds.totalMarkets}` : '›'}
          </span>
        </div>
      </div>
    </Link>
  );
}
