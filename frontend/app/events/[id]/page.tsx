'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { fetchEventById, apiFetch } from '../../../lib/api';
import { calcSportMarkets } from '../../../lib/sportMarketsClient';
import { useBetSlipStore } from '../../../lib/betSlipStore';
import Link from 'next/link';
import TeamLogo from '../../../components/TeamLogo';
import InlineBetSlip from '../../../components/InlineBetSlip';

interface Outcome { name: string; price: number; point?: number }
interface Market { key: string; outcomes?: Outcome[] }
interface Bookmaker { markets?: Market[] }
interface EventData {
  id: string;
  home: { name: string };
  away: { name: string };
  time?: number;
  league?: { name: string };
  sport_id?: string;
  bookmakers?: Bookmaker[];
  live?: boolean;
  locked?: boolean;
  minute?: number;
  score?: { home: number; away: number };
  _liveMarkets?: Record<string, unknown>;
}

const HALF_POINTS = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
const MARGIN = 0.05;

function toOdd(prob: number): number {
  if (prob <= 0 || prob >= 0.999) return 0;
  const o = (1 + MARGIN) / prob;
  return o > 1000 ? 0 : parseFloat(o.toFixed(2));
}
function oddPair(p: number): [number, number] { return [toOdd(p), toOdd(1 - p)]; }
function oddTriple(p1: number, p2: number, p3: number): [number, number, number] {
  const s = p1 + p2 + p3;
  return [toOdd(p1 / s), toOdd(p2 / s), toOdd(p3 / s)];
}
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function poissonPMF(k: number, lambda: number): number {
  let r = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) r *= lambda / i;
  return r;
}
function pOver(line: number, lambda: number): number {
  let pu = 0;
  for (let k = 0; k <= Math.floor(line); k++) pu += poissonPMF(k, lambda);
  return 1 - pu;
}
function pRange(lo: number, hi: number, lambda: number): number {
  let p = 0;
  for (let k = lo; k <= hi; k++) p += poissonPMF(k, lambda);
  return p;
}

interface DerivedOdds {
  h2hHome: number; h2hDraw: number; h2hAway: number;
  pH: number; pD: number; pA: number;
  lambdaH: number; lambdaA: number; lambdaTotal: number;
  dc1x: number; dc12: number; dcx2: number;
  dnb1: number; dnb2: number;
  gg: number; ng: number;
  totalsAll: { point: number; over: number; under: number }[];
  hcpHome: number; hcpAway: number; hcpPoint: number;
  h1Home: number; h1Draw: number; h1Away: number;
  h1Over: number; h1Under: number; h1Point: number;
  h2Home: number; h2Draw: number; h2Away: number;
  h2Over: number; h2Under: number; h2Point: number;
  correctScores: { score: string; price: number }[];
  multigol: { label: string; price: number }[];
  homeGoals: { point: number; over: number; under: number }[];
  awayGoals: { point: number; over: number; under: number }[];
  corners: { point: number; over: number; under: number }[];
  combo: { label: string; market: string; outcome: string; price: number }[];
  multibet: { label: string; market: string; outcome: string; price: number }[];
  // Nuovi mercati avanzati
  oddEven: { odd: number; even: number } | null;
  firstGoal: { home: number; away: number; noGoal: number } | null;
  nextGoal: { home: number; away: number; noMore: number } | null;
  winningMargin: { label: string; price: number }[];
  htft: { combo: string; price: number }[];
  hcpMinus2Home: number; hcpMinus2Draw: number; hcpMinus2Away: number;
  hcpPlus2Home: number; hcpPlus2Draw: number; hcpPlus2Away: number;
  // Multiple Correct Scores (raggruppati)
  csGrouped: {
    home: { score: string; price: number }[];
    draw: { score: string; price: number }[];
    away: { score: string; price: number }[];
    other: { score: string; price: number }[];
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 100000);
}

function deriveAllOdds(event: EventData): DerivedOdds | null {
  const home = event.home?.name ?? '';
  const away = event.away?.name ?? '';
  if (!home || !away) return null;
  const bookmakers = event.bookmakers ?? [];

  let h2hHome = 0, h2hDraw = 0, h2hAway = 0;
  for (const bk of bookmakers) {
    const m = bk.markets?.find(m => m.key === 'h2h');
    if (!m) continue;
    let h = m.outcomes?.find(o => o.name === home)?.price ?? 0;
    let d = m.outcomes?.find(o => o.name === 'Draw')?.price ?? 0;
    let a = m.outcomes?.find(o => o.name === away)?.price ?? 0;
    // Positional fallback per sport senza pareggio (NBA, tennis, MMA)
    if (!h && !a) {
      const nonDraw = m.outcomes?.filter(o => o.name !== 'Draw') ?? [];
      h = nonDraw[0]?.price ?? 0;
      a = nonDraw[1]?.price ?? 0;
    }
    // Filtra quote anomale
    if (h > 50) h = 0;
    if (a > 50) a = 0;
    if (d > 50) d = 0;
    if (h > 1 && a > 1) { h2hHome = h; h2hDraw = d; h2hAway = a; break; }
  }

  let pH: number, pD: number, pA: number;
  if (!h2hHome) {
    const hv = hashStr(home + away);
    pH = 0.30 + (hv % 1000) / 4000;
    pD = 0.22 + ((hv >> 4) % 500) / 5000;
    pA = 1 - pH - pD;
    [h2hHome, h2hDraw, h2hAway] = oddTriple(pH, pD, pA);
  } else {
    const rawH = 1 / h2hHome, rawA = 1 / h2hAway;
    const rawD = h2hDraw > 0 ? 1 / h2hDraw : 0;
    const tot = rawH + rawD + rawA;
    pH = rawH / tot; pD = rawD / tot; pA = rawA / tot;
    if (h2hDraw > 0) {
      [h2hHome, h2hDraw, h2hAway] = oddTriple(pH, pD, pA);
    } else {
      [h2hHome, h2hAway] = oddPair(pH);
      h2hDraw = 0;
    }
  }

  const lambdaH = clamp(1.85 * pH + 1.15 * pD + 0.85 * pA, 0.75, 4.2);
  const lambdaA = clamp(0.85 * pH + 1.15 * pD + 1.85 * pA, 0.45, 3.8);
  const lambdaTotal = clamp(lambdaH + lambdaA, 1.2, 7.5);

  let dc1x = 0, dc12 = 0, dcx2 = 0;
  for (const bk of bookmakers) {
    const m = bk.markets?.find(m => m.key === 'double_chance');
    if (!m) continue;
    const hd = m.outcomes?.find(o => o.name === '1X')?.price ?? 0;
    const ha = m.outcomes?.find(o => o.name === '12')?.price ?? 0;
    const da = m.outcomes?.find(o => o.name === 'X2')?.price ?? 0;
    if (hd && ha && da) { const r1x=1/hd,r12=1/ha,rx2=1/da,rs=r1x+r12+rx2; [dc1x,dc12,dcx2]=oddTriple(r1x/rs,r12/rs,rx2/rs); break; }
  }
  if (!dc1x) [dc1x, dc12, dcx2] = oddTriple(pH + pD, pH + pA, pD + pA);

  let dnb1 = 0, dnb2 = 0;
  for (const bk of bookmakers) {
    const m = bk.markets?.find(m => m.key === 'draw_no_bet');
    if (!m) continue;
    const h = m.outcomes?.find(o => o.name === home)?.price ?? 0;
    const a = m.outcomes?.find(o => o.name === away)?.price ?? 0;
    if (h && a) { const rh=1/h,ra=1/a,rs=rh+ra; [dnb1,dnb2]=oddPair(rh/rs); break; }
  }
  if (!dnb1 && pD < 0.99) [dnb1, dnb2] = oddPair(pH / (pH + pA));

  let gg = 0, ng = 0;
  for (const bk of bookmakers) {
    const m = bk.markets?.find(m => m.key === 'btts');
    if (!m) continue;
    const y = m.outcomes?.find(o => o.name === 'Yes')?.price ?? 0;
    const n = m.outcomes?.find(o => o.name === 'No')?.price ?? 0;
    if (y && n) { const ry=1/y,rn=1/n,rs=ry+rn; [gg,ng]=oddPair(ry/rs); break; }
  }
  if (!gg) {
    const dominance = Math.abs(pH - pA);
    const pGG = clamp(0.52 + pA * 0.35 + pH * 0.18 - dominance * 0.22 - pD * 0.08, 0.28, 0.78);
    [gg, ng] = oddPair(pGG);
  }

  const totalsMap = new Map<number, { over: number; under: number }>();
  for (const bk of bookmakers) {
    for (const m of bk.markets ?? []) {
      if (m.key !== 'totals') continue;
      const oc = m.outcomes ?? [];
      const point = (oc[0] as Outcome)?.point ?? 2.5;
      if (!HALF_POINTS.includes(point) || totalsMap.has(point)) continue;
      const over = oc.find(o => o.name === 'Over')?.price ?? 0;
      const under = oc.find(o => o.name === 'Under')?.price ?? 0;
      if (over && under) { const ro=1/over,ru=1/under,rs=ro+ru; const [o,u]=oddPair(ro/rs); totalsMap.set(point,{over:o,under:u}); }
    }
  }
  for (const pt of HALF_POINTS) {
    if (totalsMap.has(pt)) continue;
    const po = pOver(pt, lambdaTotal);
    if (po <= 0.005 || po >= 0.995) continue;
    const [o, u] = oddPair(po);
    totalsMap.set(pt, { over: o, under: u });
  }
  const totalsAll = HALF_POINTS
    .map(p => ({ point: p, over: 0, under: 0, ...totalsMap.get(p) }))
    .filter(t => t.over > 1.01 && t.under > 1.01);

  let hcpHome = 0, hcpAway = 0, hcpPoint = 0;
  for (const bk of bookmakers) {
    const m = bk.markets?.find(m => m.key === 'spreads');
    if (!m) continue;
    const oc = m.outcomes ?? [];
    const h = oc.find(o => o.name === home)?.price ?? 0;
    const a = oc.find(o => o.name === away)?.price ?? 0;
    const pt = (oc[0] as Outcome)?.point ?? 0;
    if (h && a) { const rh=1/h,ra=1/a,rs=rh+ra; hcpPoint=pt; [hcpHome,hcpAway]=oddPair(rh/rs); break; }
  }
  if (!hcpHome) {
    const isFav = pH > pA;
    hcpPoint = isFav ? -1 : 1;
    [hcpHome, hcpAway] = oddPair(isFav ? pH * 0.55 : pA * 0.55);
  }

  let h1Home = 0, h1Draw = 0, h1Away = 0;
  for (const bk of bookmakers) {
    const m = bk.markets?.find(m => m.key === 'h2h_h1');
    if (!m) continue;
    const h = m.outcomes?.find(o => o.name === home)?.price ?? 0;
    const d = m.outcomes?.find(o => o.name === 'Draw')?.price ?? 0;
    const a = m.outcomes?.find(o => o.name === away)?.price ?? 0;
    if (h && d && a) { const rh=1/h,rd=1/d,ra=1/a,rs=rh+rd+ra; [h1Home,h1Draw,h1Away]=oddTriple(rh/rs,rd/rs,ra/rs); break; }
  }
  if (!h1Home) {
    const pH1 = pH * 0.72, pA1 = pA * 0.72, pD1 = 1 - pH1 - pA1;
    [h1Home, h1Draw, h1Away] = oddTriple(pH1, pD1, pA1);
  }
  let h1Over = 0, h1Under = 0, h1Point = 0.5;
  for (const bk of bookmakers) {
    const m = bk.markets?.find(m => m.key === 'totals_h1');
    if (!m) continue;
    const oc = m.outcomes ?? [];
    const pt = (oc[0] as Outcome)?.point ?? 0.5;
    const over = oc.find(o => o.name === 'Over')?.price ?? 0;
    const under = oc.find(o => o.name === 'Under')?.price ?? 0;
    if (over && under) { const ro=1/over,ru=1/under,rs=ro+ru; h1Point=pt; [h1Over,h1Under]=oddPair(ro/rs); break; }
  }
  if (!h1Over) {
    const lH1 = lambdaTotal * 0.45;
    h1Point = 0.5; [h1Over, h1Under] = oddPair(1 - poissonPMF(0, lH1));
  }

  const lH2 = lambdaTotal * 0.55;
  const pH2w = pH * 0.68, pA2w = pA * 0.68, pD2 = 1 - pH2w - pA2w;
  const [h2Home, h2Draw, h2Away] = oddTriple(pH2w, pD2, pA2w);
  const h2Point = 0.5;
  const [h2Over, h2Under] = oddPair(1 - poissonPMF(0, lH2));

  const csGrouped: DerivedOdds['csGrouped'] = { home: [], draw: [], away: [], other: [] };
  const scoreProbs: { score: string; prob: number; h: number; a: number }[] = [];
  for (let h = 0; h <= 5; h++)
    for (let a = 0; a <= 5; a++) {
      const prob = poissonPMF(h, lambdaH) * poissonPMF(a, lambdaA);
      if (prob > 0.001) scoreProbs.push({ score: `${h}-${a}`, prob, h, a });
    }
  scoreProbs.sort((a, b) => b.prob - a.prob);
  for (const { score, prob, h, a } of scoreProbs.slice(0, 24)) {
    const item = { score, price: toOdd(prob) };
    if (h > a) csGrouped.home.push(item);
    else if (a > h) csGrouped.away.push(item);
    else csGrouped.draw.push(item);
  }
  // Altro (es. 4-4, 5-5)
  csGrouped.other.push({ score: 'ALTRO', price: 25.00 });
  
  const correctScores = scoreProbs.slice(0, 16).map(s => ({ score: s.score, price: toOdd(s.prob) }));

  const multigolRanges: [number, number, string][] = [
    [0,1,'0-1'],[1,2,'1-2'],[2,3,'2-3'],[3,4,'3-4'],[4,5,'4-5'],
    [0,2,'0-2'],[1,3,'1-3'],[2,4,'2-4'],[3,5,'3-5'],
  ];
  const multigol = multigolRanges.map(([lo, hi, label]) => {
    const p = pRange(lo, hi, lambdaTotal);
    if (p <= 0.02 || p >= 0.98) return null;
    const [price] = oddPair(p);
    return { label, price };
  }).filter((m): m is { label: string; price: number } => m !== null && m.price < 40);

  const homeGoals = [0.5, 1.5, 2.5].map(pt => {
    const [over, under] = oddPair(pOver(pt, lambdaH));
    return { point: pt, over, under };
  }).filter(g => g.over > 1.05 && g.under > 1.05);
  const awayGoals = [0.5, 1.5, 2.5].map(pt => {
    const [over, under] = oddPair(pOver(pt, lambdaA));
    return { point: pt, over, under };
  }).filter(g => g.over > 1.05 && g.under > 1.05);

  const cornerMean = clamp(9.5 + (pH - pA) * 2.5, 7.5, 13);
  const corners = [7.5, 8.5, 9.5, 10.5, 11.5, 12.5].map(pt => {
    const [over, under] = oddPair(pOver(pt, cornerMean));
    return { point: pt, over, under };
  }).filter(c => c.over > 1.05 && c.under > 1.05);

  const pGGtrue = (1 + MARGIN) / gg;
  const pNGtrue = 1 - pGGtrue;
  const combo = [
    { label: '1 + GG',  market: 'COMBO', outcome: '1+GG',  p: pH * pGGtrue },
    { label: '1 + NG',  market: 'COMBO', outcome: '1+NG',  p: pH * pNGtrue },
    { label: 'X + GG',  market: 'COMBO', outcome: 'X+GG',  p: pD * pGGtrue },
    { label: 'X + NG',  market: 'COMBO', outcome: 'X+NG',  p: pD * pNGtrue },
    { label: '2 + GG',  market: 'COMBO', outcome: '2+GG',  p: pA * pGGtrue },
    { label: '2 + NG',  market: 'COMBO', outcome: '2+NG',  p: pA * pNGtrue },
    { label: '1X + GG', market: 'COMBO', outcome: '1X+GG', p: (pH + pD) * pGGtrue },
    { label: 'X2 + GG', market: 'COMBO', outcome: 'X2+GG', p: (pD + pA) * pGGtrue },
  ].map(c => ({ ...c, price: toOdd(c.p) })).filter(c => c.price > 1.01 && c.price < 40);

  const pO15 = pOver(1.5, lambdaTotal);
  const pO25 = pOver(2.5, lambdaTotal);
  const pU25 = 1 - pO25;
  const pU35 = 1 - pOver(3.5, lambdaTotal);
  const multibet = [
    { label: '1 + Over 1.5',   market: 'MULTI', outcome: '1+O1.5',  p: pH * pO15 },
    { label: '1 + Over 2.5',   market: 'MULTI', outcome: '1+O2.5',  p: pH * pO25 },
    { label: '2 + Over 1.5',   market: 'MULTI', outcome: '2+O1.5',  p: pA * pO15 },
    { label: '2 + Over 2.5',   market: 'MULTI', outcome: '2+O2.5',  p: pA * pO25 },
    { label: 'X + Under 2.5',  market: 'MULTI', outcome: 'X+U2.5',  p: pD * pU25 },
    { label: 'GG + Over 2.5',  market: 'MULTI', outcome: 'GG+O2.5', p: pGGtrue * pO25 },
    { label: 'GG + Under 3.5', market: 'MULTI', outcome: 'GG+U3.5', p: pGGtrue * pU35 },
    { label: '1X + Under 2.5', market: 'MULTI', outcome: '1X+U2.5', p: (pH + pD) * pU25 },
    { label: 'X2 + Over 1.5',  market: 'MULTI', outcome: 'X2+O1.5', p: (pD + pA) * pO15 },
  ].map(m => ({ ...m, price: toOdd(m.p) })).filter(m => m.price > 1.01 && m.price < 40);

  // New: Pari/Dispari
  let oddEven: DerivedOdds['oddEven'] = null;
  const evenProb = clamp(Array.from({length:6}, (_,h)=> Array.from({length:6},(_,a)=>{
    const p = poissonPMF(h,lambdaH)*poissonPMF(a,lambdaA);
    return (h+a)%2===0 ? p : 0;
  }).reduce((s,v)=>s+v,0)).reduce((s,v)=>s+v,0), 0.3, 0.7);
  oddEven = { even: toOdd(evenProb), odd: toOdd(1-evenProb) };

  // New: Primo Gol
  const noGoalP = poissonPMF(0, lambdaH) * poissonPMF(0, lambdaA);
  const pFirstH = (lambdaH/(lambdaH+lambdaA)) * (1 - noGoalP);
  const pFirstA = (lambdaA/(lambdaH+lambdaA)) * (1 - noGoalP);
  const firstGoal = { home: toOdd(pFirstH), away: toOdd(pFirstA), noGoal: toOdd(noGoalP) };

  // New: Prossimo Gol (same as first at prematch)
  const nextGoal = { home: toOdd(pFirstH), away: toOdd(pFirstA), noMore: toOdd(noGoalP) };

  // New: Margine di Vittoria
  const winningMargin: { label: string; price: number }[] = [];
  const wmProbs: Record<string, number> = { 'Casa +1': 0, 'Casa +2': 0, 'Casa +3+': 0, 'Pareggio': 0, 'Ospite +1': 0, 'Ospite +2': 0, 'Ospite +3+': 0 };
  for (let h = 0; h <= 6; h++) for (let a = 0; a <= 6; a++) {
    const p = poissonPMF(h,lambdaH)*poissonPMF(a,lambdaA);
    const diff = h - a;
    if (diff === 1) wmProbs['Casa +1'] += p;
    else if (diff === 2) wmProbs['Casa +2'] += p;
    else if (diff >= 3) wmProbs['Casa +3+'] += p;
    else if (diff === 0) wmProbs['Pareggio'] += p;
    else if (diff === -1) wmProbs['Ospite +1'] += p;
    else if (diff === -2) wmProbs['Ospite +2'] += p;
    else if (diff <= -3) wmProbs['Ospite +3+'] += p;
  }
  for (const [label, p] of Object.entries(wmProbs)) {
    if (p > 0.01) winningMargin.push({ label, price: toOdd(p) });
  }

  // New: HT/FT
  const htft: { combo: string; price: number }[] = [];
  const htftCombos = [
    { ht: '1', ft: '1', p: (pH*0.72) * pH * 1.1 },
    { ht: '1', ft: 'X', p: (pH*0.72) * pD * 0.6 },
    { ht: '1', ft: '2', p: (pH*0.72) * pA * 0.3 },
    { ht: 'X', ft: '1', p: (1-pH*0.72-pA*0.72) * pH * 0.85 },
    { ht: 'X', ft: 'X', p: (1-pH*0.72-pA*0.72) * pD * 1.2 },
    { ht: 'X', ft: '2', p: (1-pH*0.72-pA*0.72) * pA * 0.85 },
    { ht: '2', ft: '1', p: (pA*0.72) * pH * 0.3 },
    { ht: '2', ft: 'X', p: (pA*0.72) * pD * 0.6 },
    { ht: '2', ft: '2', p: (pA*0.72) * pA * 1.1 },
  ];
  const htftTotal = htftCombos.reduce((s, c) => s + c.p, 0);
  for (const c of htftCombos) {
    const normP = c.p / htftTotal;
    if (normP > 0.01) htft.push({ combo: `${c.ht}/${c.ft}`, price: toOdd(normP) });
  }

  // New: Handicap -2 / +2
  let hcpMinus2Home = 0, hcpMinus2Draw = 0, hcpMinus2Away = 0;
  let hcpPlus2Home = 0, hcpPlus2Draw = 0, hcpPlus2Away = 0;
  for (let h = 0; h <= 6; h++) for (let a = 0; a <= 6; a++) {
    const p = poissonPMF(h,lambdaH)*poissonPMF(a,lambdaA);
    const diff = h - a;
    if (diff >= 3) hcpMinus2Home += p;
    else if (diff === 2) hcpMinus2Draw += p;
    else hcpMinus2Away += p;
    if (diff >= -1) hcpPlus2Home += p;
    else if (diff === -2) hcpPlus2Draw += p;
    else hcpPlus2Away += p;
  }

  return {
    h2hHome, h2hDraw, h2hAway, pH, pD, pA, lambdaH, lambdaA, lambdaTotal,
    dc1x, dc12, dcx2, dnb1, dnb2, gg, ng, totalsAll,
    hcpHome, hcpAway, hcpPoint,
    h1Home, h1Draw, h1Away, h1Over, h1Under, h1Point,
    h2Home, h2Draw, h2Away, h2Over, h2Under, h2Point,
    correctScores, multigol, homeGoals, awayGoals, corners, combo, multibet,
    oddEven, firstGoal, nextGoal, winningMargin, htft,
    hcpMinus2Home: toOdd(hcpMinus2Home), hcpMinus2Draw: toOdd(hcpMinus2Draw), hcpMinus2Away: toOdd(hcpMinus2Away),
    hcpPlus2Home: toOdd(hcpPlus2Home), hcpPlus2Draw: toOdd(hcpPlus2Draw), hcpPlus2Away: toOdd(hcpPlus2Away),
    csGrouped,
  };
}

const SECTION_TABS = [
  // Calcio
  { key: '1x2',      label: '1X2',          sport: ['soccer','hockey','rugby','handball','american_football'], category: 'main' },
  { key: 'dc',       label: 'DC',           sport: ['soccer','hockey','rugby','handball'], category: 'main' },
  { key: 'dnb',      label: 'DNB',          sport: ['soccer','hockey'], category: 'main' },
  { key: 'ggng',     label: 'GG/NG',        sport: ['soccer'], category: 'goals' },
  { key: 'ou',       label: 'U/O',          sport: ['soccer','hockey','rugby','handball','american_football'], category: 'goals' },
  { key: 'multigol', label: 'Multigol',      sport: ['soccer'], category: 'goals' },
  { key: 'hcp',      label: 'Handicap',      sport: ['soccer','hockey','rugby','american_football'], category: 'main' },
  { key: 'h1',       label: '1° Tempo',      sport: ['soccer','hockey','american_football'], category: 'half' },
  { key: 'h2',       label: '2° Tempo',      sport: ['soccer','american_football'], category: 'half' },
  { key: 'casa',     label: 'Gol Casa',      sport: ['soccer'], category: 'goals' },
  { key: 'ospite',   label: 'Gol Ospite',    sport: ['soccer'], category: 'goals' },
  { key: 'oddeven',  label: 'Pari/Dispari',  sport: ['soccer'], category: 'goals' },
  { key: 'firstgoal',label: 'Primo Gol',     sport: ['soccer'], category: 'goals' },
  { key: 'nextgoal', label: 'Prossimo Gol',  sport: ['soccer'], category: 'goals' },
  { key: 'margin',   label: 'Margine',       sport: ['soccer'], category: 'main' },
  { key: 'htft',     label: 'HT/FT',         sport: ['soccer'], category: 'half' },
  { key: 'corner',   label: 'Corner',        sport: ['soccer'], category: 'other' },
  { key: 'combo',    label: 'Combo',         sport: ['soccer'], category: 'combo' },
  { key: 'multi',    label: 'Multibet',      sport: ['soccer'], category: 'combo' },
  { key: 'cs',       label: 'Ris. Esatto',   sport: ['soccer'], category: 'other' },
  
  // Basket
  { key: 'bk_h2h',   label: 'T/T',           sport: ['basketball'], category: 'main' },
  { key: 'bk_hcp',   label: 'HCP',           sport: ['basketball'], category: 'main' },
  { key: 'bk_ou',    label: 'U/O',           sport: ['basketball'], category: 'goals' },
  { key: 'bk_h1',    label: '1° Tempo',      sport: ['basketball'], category: 'half' },
  { key: 'bk_q1',    label: '1° Quarto',      sport: ['basketball'], category: 'half' },
  { key: 'bk_oe',    label: 'Pari/Dispari',  sport: ['basketball'], category: 'goals' },
  { key: 'bk_margin',label: 'Margine',       sport: ['basketball'], category: 'main' },
  { key: 'bk_combo', label: 'Combo',         sport: ['basketball'], category: 'combo' },
  
  // Altri sport (Tennis, Baseball, Boxe) usano categorie simili o 'main'
  { key: 'tn_winner',label: 'Vincente',      sport: ['tennis'], category: 'main' },
  { key: 'tn_set',   label: 'Set',           sport: ['tennis'], category: 'half' },
  { key: 'tn_ou',    label: 'U/O Games',     sport: ['tennis'], category: 'goals' },
  { key: 'tn_hcp',   label: 'HCP Games',     sport: ['tennis'], category: 'main' },
  { key: 'tn_oe',    label: 'Pari/Dispari',  sport: ['tennis'], category: 'goals' },
  { key: 'tn_sb',    label: 'Set Betting',   sport: ['tennis'], category: 'other' },
  { key: 'tn_cs',    label: 'Ris. Esatto',   sport: ['tennis'], category: 'other' },
  { key: 'tn_combo', label: 'Combo S1',      sport: ['tennis'], category: 'combo' },
  
  { key: 'bb_h2h',   label: 'T/T',           sport: ['baseball'], category: 'main' },
  { key: 'bb_hcp',   label: 'HCP',           sport: ['baseball'], category: 'main' },
  { key: 'bb_ou',    label: 'U/O',           sport: ['baseball'], category: 'goals' },
  { key: 'bb_oe',    label: 'Pari/Dispari',  sport: ['baseball'], category: 'goals' },
  { key: 'bb_home',  label: 'U/O Casa',      sport: ['baseball'], category: 'goals' },
  { key: 'bb_away',  label: 'U/O Ospite',     sport: ['baseball'], category: 'goals' },
  { key: 'bb_1inn',  label: '1° Inn',        sport: ['baseball'], category: 'half' },
  { key: 'bb_5inn',  label: '5° Inn',        sport: ['baseball'], category: 'half' },
  { key: 'bb_ei',    label: 'Extra Inn',     sport: ['baseball'], category: 'half' },
  
  { key: 'bx_h2h',   label: 'T/T',           sport: ['boxing','mma'], category: 'main' },
  { key: 'bx_ou',    label: 'U/O Round',     sport: ['boxing','mma'], category: 'goals' },
  { key: 'bx_method',label: 'Metodo',        sport: ['boxing','mma'], category: 'main' },
] as const;

const MARKET_CATEGORIES = [
  { key: 'main',  label: 'Principali' },
  { key: 'goals', label: 'Under/Over & Gol' },
  { key: 'half',  label: 'Tempi/Set/Quarti' },
  { key: 'combo', label: 'Combo' },
  { key: 'other', label: 'Altro' },
] as const;

type SectionKey = typeof SECTION_TABS[number]['key'];
type CategoryKey = typeof MARKET_CATEGORIES[number]['key'];

function OddsBtn({ eventId, eventName, market, outcome, price, label }: {
  eventId: string; eventName: string; market: string; outcome: string; price: number; label?: string;
}) {
  const { addSelection, removeSelection, selections } = useBetSlipStore();
  const selected = selections.some(s => s.event_id === eventId && s.outcome === outcome);
  const valid = price >= 1.01;

  function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!valid) return;
    if (selected) removeSelection(eventId, outcome);
    else addSelection({ event_id: eventId, nome_evento: eventName, quota: price, market, outcome });
  }

  return (
    <button onClick={toggle} disabled={!valid} className={`ev-odds-btn${selected ? ' selected' : ''}${!valid ? ' disabled' : ''}`}
      style={{ opacity: valid ? 1 : 0.6, cursor: valid ? 'pointer' : 'not-allowed' }}>
      <span className="ev-odds-label">{label ?? outcome}</span>
      <span className="ev-odds-price">{valid ? price.toFixed(2) : '—'}</span>
    </button>
  );
}

function formatMatchTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Oggi ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Domani ${time}`;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + time;
}

// A single market row: label on left, odds buttons on right
function MarketRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      gap: 12,
    }}>
      <span style={{
        flex: 1, fontSize: 12, color: 'var(--text-secondary)',
        fontWeight: 500, minWidth: 0,
      }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

// Section header inside content
function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      padding: '10px 16px 8px',
      fontSize: 10, fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
    }}>{title}</div>
  );
}

// Correct scores section — hook estratto per rispettare le regole degli hooks
function CsSection({ d, eventId, eventName }: { d: ReturnType<typeof deriveAllOdds>; eventId: string; eventName: string }) {
  const { addSelection, removeSelection, selections } = useBetSlipStore();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, padding: 16 }}>
      {d!.correctScores.map((cs: { score: string; price: number }) => {
        const selected = selections.some(s => s.event_id === eventId && s.outcome === cs.score);
        return (
          <button key={cs.score}
            onClick={() => selected ? removeSelection(eventId, cs.score) : addSelection({ event_id: eventId, nome_evento: eventName, quota: cs.price, market: 'CS', outcome: cs.score })}
            style={{
              padding: '10px 8px', borderRadius: 6,
              border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: selected ? 'rgba(0,180,216,0.1)' : 'var(--bg-card)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              transition: 'all 0.12s',
            }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: selected ? 'var(--accent)' : 'var(--text-primary)' }}>{cs.score}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: selected ? 'var(--accent)' : '#34d399' }}>{cs.price.toFixed(2)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params?.id as string;
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('main');
  const [activeSection, setActiveSection] = useState<SectionKey>('1x2');
  const [liveMarkets, setLiveMarkets] = useState<Record<string, unknown> | null>(null);
  const [sportMarkets, setSportMarkets] = useState<Record<string, unknown> | null>(null);
  const [liveMinute, setLiveMinute] = useState<number | null>(null);
  const { addSelection, removeSelection, selections } = useBetSlipStore();

  const eventName = event ? `${event.home.name} vs ${event.away.name}` : '';
  const isLive = !!(event as (EventData & { live?: boolean }) | null)?.live;
  const sport = (event as EventData & { sport_category?: string })?.sport_category ?? 'soccer';
  const isSoccer = sport === 'soccer' || sport === 'hockey' || sport === 'rugby' || sport === 'handball' || sport === 'american_football';

  useEffect(() => {
    if (!eventId) return;
    fetchEventById(eventId)
      .then(data => {
        const ev = data as EventData & { live?: boolean; minute?: number; score?: { home: number; away: number } };
        setEvent(ev);
        setLoading(false);
        if (ev.live) setLiveMinute(ev.minute ?? null);
        if (ev._liveMarkets) setLiveMarkets(ev._liveMarkets);
        if ((ev as EventData & { _sportMarkets?: Record<string, unknown> })._sportMarkets) {
          setSportMarkets((ev as EventData & { _sportMarkets?: Record<string, unknown> })._sportMarkets!);
        }
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  // Polling quote live ogni 3 secondi per eventi live
  useEffect(() => {
    if (!eventId || !event?.live) return;
    let cancelled = false;

    async function fetchLiveOdds() {
      try {
        const data = await apiFetch<{ odds?: Record<string, unknown>; sportMarkets?: Record<string, unknown>; locked?: boolean }>(`/live/odds/${eventId}`);
        if (!cancelled) {
          if (data.odds) setLiveMarkets(data.odds);
          else setLiveMarkets(data as Record<string, unknown>);
          if (data.sportMarkets) setSportMarkets(data.sportMarkets);
          fetchEventById(eventId).then(d => {
            if (!cancelled) {
              const ev = d as EventData;
              setEvent(ev);
              setLiveMinute(ev.minute ?? null);
            }
          }).catch(() => {});
        }
      } catch { /* silent */ }
    }

    fetchLiveOdds();
    const interval = setInterval(fetchLiveOdds, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [eventId, event?.live]);

  // Per eventi live usa i mercati dal backend (aggiornati ogni 30s)
  // Per eventi prematch usa deriveAllOdds locale
  const d = useMemo(() => {
    if (!event) return null;

    // Calcola sempre base — serve come fallback per tutti i mercati non coperti dal live
    const base = deriveAllOdds(event);

    if (liveMarkets) {
      const lm = liveMarkets as {
        h2h?: { home: number | null; draw: number | null; away: number | null };
        double_chance?: { home_draw: number | null; draw_away: number | null; home_away: number | null };
        draw_no_bet?: { home: number | null; away: number | null };
        gg_ng?: { gg: number | null; ng: number | null };
        over_under?: Record<string, number | null>;
        correct_score?: Array<{ score: string; odds: number | null }>;
        multigol?: Record<string, number | null>;
        handicap?: Record<string, number | null>;
        corners?: Record<string, number | null>;
        combo?: Record<string, number | null>;
        odd_even?: { odd: number | null; even: number | null };
        first_goal?: { home: number | null; away: number | null; no_goal: number | null };
        next_goal?: { home: number | null; away: number | null; no_more: number | null };
        home_goals_ou?: Record<string, number | null>;
        away_goals_ou?: Record<string, number | null>;
        winning_margin?: Array<{ label: string; odds: number | null }>;
        ht_ft?: Array<{ combo: string; odds: number | null }>;
        multi?: Array<{ label: string; odds: number | null }>;
        shots?: Record<string, number | null>;
        odds?: unknown;
      };

      // Risposta mercati live/prematch dal backend
      if (!lm.h2h && !isLive) return base;

      // Se h2h non disponibile ma siamo live, usa base come fallback invece di abbandonare
      const h2h = lm.h2h;
      const h2hHome = h2h?.home === null ? 0 : (h2h?.home ?? base?.h2hHome ?? 0);
      const h2hDraw = h2h?.draw === null ? 0 : (h2h?.draw ?? base?.h2hDraw ?? 0);
      const h2hAway = h2h?.away === null ? 0 : (h2h?.away ?? base?.h2hAway ?? 0);

      if (!base) return null;

      const liveGG = lm.gg_ng !== undefined ? lm.gg_ng.gg : base.gg;
      const liveNG = lm.gg_ng !== undefined ? lm.gg_ng.ng : base.ng;

      // Handicap dal motore live
      const hcp = lm.handicap;
      const hcpHome = hcp?.home_minus1 === null ? 0 : (hcp?.home_minus1 ?? base.hcpHome);
      const hcpAway = hcp?.away_minus1 === null ? 0 : (hcp?.away_minus1 ?? base.hcpAway);

      // Corner dal motore live
      const corn = lm.corners;
      const cornersLive = corn ? [
        { point: 7.5, over: corn.over75 ?? 0, under: corn.under75 ?? 0 },
        { point: 8.5, over: corn.over85 ?? 0, under: corn.under85 ?? 0 },
        { point: 9.5, over: corn.over95 ?? 0, under: corn.under95 ?? 0 },
        { point: 10.5, over: corn.over105 ?? 0, under: corn.under105 ?? 0 },
        { point: 11.5, over: corn.over115 ?? 0, under: corn.under115 ?? 0 },
      ].filter(c => c.over > 1 && c.under > 1) : base.corners;

      // Multigol dal motore live
      const mg = lm.multigol;
      const multigolLive = mg ? Object.entries(mg)
        .filter(([, v]) => v && v > 1)
        .map(([k, v]) => ({ label: k, price: v as number })) : base.multigol;

      // Combo dal motore live
      const cb = lm.combo;
      const comboLive = cb ? Object.entries(cb)
        .filter(([, v]) => v && v > 1)
        .map(([k, v]) => ({
          label: k.replace(/_/g, ' + ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          market: 'Combo', outcome: k, price: v as number,
        })) : base.combo;

      // Odd/Even dal motore live
      const oe = lm.odd_even;
      const oddEvenLive = oe
        ? { odd: oe.odd ?? 0, even: oe.even ?? 0 }
        : base.oddEven;

      // Primo Gol dal motore live
      const fg = lm.first_goal;
      const firstGoalLive = fg
        ? { home: fg.home ?? 0, away: fg.away ?? 0, noGoal: fg.no_goal ?? 0 }
        : base.firstGoal;

      // Prossimo Gol dal motore live
      const ng2 = lm.next_goal;
      const nextGoalLive = ng2
        ? { home: ng2.home ?? 0, away: ng2.away ?? 0, noMore: ng2.no_more ?? 0 }
        : base.nextGoal;

      // Gol Casa/Ospite dal motore live
      const hgo = lm.home_goals_ou;
      const homeGoalsLive = hgo ? [
        { point: 0.5, over: hgo.over05 ?? 0, under: hgo.under05 ?? 0 },
        { point: 1.5, over: hgo.over15 ?? 0, under: hgo.under15 ?? 0 },
        { point: 2.5, over: hgo.over25 ?? 0, under: hgo.under25 ?? 0 },
      ].filter(g => g.over > 1 && g.under > 1) : base.homeGoals;

      const ago = lm.away_goals_ou;
      const awayGoalsLive = ago ? [
        { point: 0.5, over: ago.over05 ?? 0, under: ago.under05 ?? 0 },
        { point: 1.5, over: ago.over15 ?? 0, under: ago.under15 ?? 0 },
        { point: 2.5, over: ago.over25 ?? 0, under: ago.under25 ?? 0 },
      ].filter(g => g.over > 1 && g.under > 1) : base.awayGoals;

      // Margine di vittoria dal motore live
      const wmLive = lm.winning_margin
        ? lm.winning_margin.filter(w => w.odds !== null && (w.odds ?? 0) > 1)
            .map(w => ({ label: w.label, price: w.odds as number }))
        : base.winningMargin;

      // HT/FT dal motore live
      const htftLive = lm.ht_ft
        ? lm.ht_ft.filter(h => h.odds !== null && (h.odds ?? 0) > 1)
            .map(h => ({ combo: h.combo, price: h.odds as number }))
        : base.htft;

      // Multi dal motore live
      const multiLive = lm.multi
        ? lm.multi.filter(m => m.odds !== null && (m.odds ?? 0) > 1)
            .map(m => ({ label: m.label, market: 'MULTI', outcome: m.label, price: m.odds as number }))
        : base.multibet;

      return {
        ...base,
        h2hHome,
        h2hDraw,
        h2hAway,
        dc1x: lm.double_chance?.home_draw === null ? 0 : (lm.double_chance?.home_draw ?? base.dc1x),
        dc12: lm.double_chance?.home_away === null ? 0 : (lm.double_chance?.home_away ?? base.dc12),
        dcx2: lm.double_chance?.draw_away === null ? 0 : (lm.double_chance?.draw_away ?? base.dcx2),
        dnb1: lm.draw_no_bet?.home === null ? 0 : (lm.draw_no_bet?.home ?? base.dnb1),
        dnb2: lm.draw_no_bet?.away === null ? 0 : (lm.draw_no_bet?.away ?? base.dnb2),
        gg: liveGG === null ? 0 : (liveGG ?? base.gg),
        ng: liveNG === null ? 0 : (liveNG ?? base.ng),
        hcpHome,
        hcpAway,
        corners: cornersLive,
        multigol: multigolLive,
        combo: comboLive,
        multibet: multiLive,
        oddEven: oddEvenLive,
        firstGoal: firstGoalLive,
        nextGoal: nextGoalLive,
        homeGoals: homeGoalsLive,
        awayGoals: awayGoalsLive,
        winningMargin: wmLive,
        htft: htftLive,
        totalsAll: lm.over_under ? [
          { point: 0.5, over: lm.over_under.over05 ?? 0, under: lm.over_under.under05 ?? 0 },
          { point: 1.5, over: lm.over_under.over15 ?? 0, under: lm.over_under.under15 ?? 0 },
          { point: 2.5, over: lm.over_under.over25 ?? 0, under: lm.over_under.under25 ?? 0 },
          { point: 3.5, over: lm.over_under.over35 ?? 0, under: lm.over_under.under35 ?? 0 },
          { point: 4.5, over: lm.over_under.over45 ?? 0, under: lm.over_under.under45 ?? 0 },
        ].filter(t => t.over > 1 && t.under > 1) : base.totalsAll,
        correctScores: (lm.correct_score ?? [])
          .filter(s => s.odds !== null && (s.odds ?? 0) > 1)
          .map(s => ({ score: s.score, price: s.odds as number }))
          .slice(0, 20),
      };
    }
    return base;
  }, [event, isLive, liveMarkets]);

  const signStr = (n: number) => n > 0 ? `+${n}` : `${n}`;

  const availableSections = SECTION_TABS.filter(s => {
    // Filtra per sport
    if (!s.sport.includes(sport as never)) return false;

    // Mercati calcio/hockey standard — richiedono d
    if (['1x2','dc','dnb','ggng','ou','multigol','hcp','h1','h2','casa','ospite','corner','combo','multi','cs','oddeven','firstgoal','nextgoal','margin','htft'].includes(s.key)) {
      if (!d) return false;
      if (s.key === '1x2')      return d.h2hHome > 0;
      if (s.key === 'dc')       return d.dc1x > 0;
      if (s.key === 'dnb')      return d.dnb1 > 0;
      if (s.key === 'ggng')     return d.gg > 0;
      if (s.key === 'ou')       return d.totalsAll.length > 0;
      if (s.key === 'multigol') return d.multigol.length > 0;
      if (s.key === 'hcp')      return d.hcpHome > 0;
      if (s.key === 'h1')       return d.h1Home > 0;
      if (s.key === 'h2')       return d.h2Home > 0;
      if (s.key === 'casa')     return d.homeGoals.length > 0;
      if (s.key === 'ospite')   return d.awayGoals.length > 0;
      if (s.key === 'corner')   return d.corners.length > 0;
      if (s.key === 'combo')    return d.combo.length > 0;
      if (s.key === 'multi')    return d.multibet.length > 0;
      if (s.key === 'cs')       return d.correctScores.length > 0;
      if (s.key === 'oddeven')  return d.oddEven !== null;
      if (s.key === 'firstgoal') return d.firstGoal !== null;
      if (s.key === 'nextgoal') return d.nextGoal !== null;
      if (s.key === 'margin')   return d.winningMargin.length > 0;
      if (s.key === 'htft')     return d.htft.length > 0;
    }

    // Mercati sport-specifici — disponibili se sportMarkets è presente o evento è live/prematch
    if (s.key.startsWith('bk_') || s.key.startsWith('tn_') ||
        s.key.startsWith('bb_') || s.key.startsWith('bx_')) {
      // Per prematch mostra sempre i tab (le quote verranno calcolate)
      // Per live mostra solo se sportMarkets è disponibile
      return isLive ? !!sportMarkets : true;
    }
    return false;
  });

  return (
    <div style={{ minHeight: 'calc(100vh - 48px)', background: 'var(--bg-base)' }}>

      {/* ── MATCH HEADER ── */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Breadcrumb */}
        <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href="/" style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>Sport</Link>
          {event?.league?.name && (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{event.league.name}</span>
            </>
          )}
          {event && (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{eventName}</span>
            </>
          )}
        </div>

        {/* Teams + main odds */}
        {loading ? (
          <div style={{ height: 100, margin: 16, borderRadius: 8, background: 'var(--bg-card)' }} />
        ) : event && d ? (
          <div style={{ padding: '16px 16px 0' }}>
            {/* Time + league */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              {isLive ? (
                <span style={{
                  fontSize: 11, fontWeight: 900, color: '#ff3b3b',
                  background: 'rgba(255,59,59,0.12)', border: '1px solid rgba(255,59,59,0.3)',
                  borderRadius: 4, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3b3b', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                  {liveMinute != null ? `${liveMinute}'` : 'LIVE'}
                </span>
              ) : event.time ? (
                <span style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 8px',
                }}>{formatMatchTime(event.time)}</span>
              ) : null}
              {event.league?.name && (
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                  {event.league.name}
                </span>
              )}
            </div>

            {/* Teams row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}>
              {/* Home */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TeamLogo name={event.home.name} size={40} borderRadius={8} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{event.home.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Casa</div>
                </div>
              </div>

              {/* Centro: punteggio o VS + minuto */}
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                {isLive && (event as EventData & { score?: { home: number; away: number } }).score != null ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                        {(event as EventData & { score?: { home: number; away: number } }).score!.home}
                      </span>
                      <span style={{ fontSize: 14, color: '#2e4460', fontWeight: 700 }}>—</span>
                      <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                        {(event as EventData & { score?: { home: number; away: number } }).score!.away}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff3b3b', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#ff5555' }}>
                        {liveMinute != null ? `${liveMinute}°` : 'LIVE'}
                      </span>
                    </div>
                  </>
                ) : isLive ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#ff5555', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff3b3b', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                      {liveMinute != null ? `${liveMinute}°` : 'LIVE'}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2e4460', letterSpacing: '0.1em' }}>VS</div>
                )}
              </div>

              {/* Away */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{event.away.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Ospite</div>
                </div>
                <TeamLogo name={event.away.name} size={40} borderRadius={8} />
              </div>
            </div>

            {/* Main 1X2 odds strip */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              gap: 6, marginBottom: 16,
            }}>
              {[
                { label: '1', sublabel: event.home.name, price: d.h2hHome, outcome: '1' },
                { label: 'X', sublabel: 'Pareggio', price: d.h2hDraw, outcome: 'X' },
                { label: '2', sublabel: event.away.name, price: d.h2hAway, outcome: '2' },
              ].map(item => {
                const selected = selections.some(s => s.event_id === eventId && s.outcome === item.outcome);
                return (
                  <button key={item.outcome}
                    onClick={() => selected ? removeSelection(eventId, item.outcome) : addSelection({ event_id: eventId, nome_evento: eventName, quota: item.price, market: '1X2', outcome: item.outcome })}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 6,
                      border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: selected ? 'rgba(0,180,216,0.12)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: 10, color: selected ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {item.label} — {item.sublabel}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: selected ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {item.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Categorized Tab bar */}
        {d && (
          <div style={{ background: 'var(--bg-surface)' }}>

            {/* Primary Categories */}
            <div style={{
              display: 'flex', overflowX: 'auto', gap: 0,
              borderTop: '1px solid var(--border)',
              scrollbarWidth: 'none',
              padding: '0 8px'
            }}>
              {MARKET_CATEGORIES.map(cat => {
                const hasMarkets = SECTION_TABS.some(s => s.category === cat.key && (s.sport as ReadonlyArray<string>).includes(sport));
                if (!hasMarkets) return null;
                return (
                  <button key={cat.key} onClick={() => {
                    setActiveCategory(cat.key);
                    const firstSection = SECTION_TABS.find(s => s.category === cat.key && (s.sport as ReadonlyArray<string>).includes(sport));
                    if (firstSection) setActiveSection(firstSection.key);
                  }} style={{
                    flexShrink: 0,
                    padding: '12px 14px',
                    fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', border: 'none',
                    background: 'transparent',
                    color: activeCategory === cat.key ? 'var(--accent)' : 'var(--text-secondary)',
                    borderBottom: activeCategory === cat.key ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>{cat.label}</button>
                );
              })}
            </div>

            {/* Sub-Tabs (Specific Markets) */}
            <div style={{
              display: 'flex', overflowX: 'auto', gap: 6,
              background: 'var(--bg-base)',
              padding: '8px 16px',
              borderTop: '1px solid var(--border)',
              scrollbarWidth: 'none'
            }}>
              {availableSections.filter(s => s.category === activeCategory).map(s => (
                <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: 20,
                  border: '1px solid',
                  borderColor: activeSection === s.key ? 'var(--accent)' : 'var(--border)',
                  background: activeSection === s.key ? 'rgba(0,180,216,0.1)' : 'var(--bg-surface)',
                  color: activeSection === s.key ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.12s',
                  whiteSpace: 'nowrap',
                }}>{s.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MARKET CONTENT ── */}
      <div style={{ background: 'var(--bg-base)' }}>
        {!loading && !event && (
          <div style={{ padding: 20, color: '#fbbf24', fontSize: 13 }}>Evento non trovato.</div>
        )}

        {!loading && event && d && (
          <>
            {/* 1X2 */}
            {activeSection === '1x2' && (
              <>
                <SectionHeader title="Risultato Finale — 1X2" />
                <MarketRow label={event.home.name}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="1X2" outcome="1" label="1" price={d.h2hHome} />
                </MarketRow>
                <MarketRow label="Pareggio">
                  <OddsBtn eventId={eventId} eventName={eventName} market="1X2" outcome="X" label="X" price={d.h2hDraw} />
                </MarketRow>
                <MarketRow label={event.away.name}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="1X2" outcome="2" label="2" price={d.h2hAway} />
                </MarketRow>
              </>
            )}

            {/* DC */}
            {activeSection === 'dc' && (
              <>
                <SectionHeader title="Doppia Chance" />
                <MarketRow label={`${event.home.name} o Pareggio`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="DC" outcome="1X" label="1X" price={d.dc1x} />
                </MarketRow>
                <MarketRow label={`${event.home.name} o ${event.away.name}`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="DC" outcome="12" label="12" price={d.dc12} />
                </MarketRow>
                <MarketRow label={`Pareggio o ${event.away.name}`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="DC" outcome="X2" label="X2" price={d.dcx2} />
                </MarketRow>
              </>
            )}

            {/* DNB */}
            {activeSection === 'dnb' && (
              <>
                <SectionHeader title="Draw No Bet — Rimborso in caso di pareggio" />
                <MarketRow label={event.home.name}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="DNB" outcome="1" label="1" price={d.dnb1} />
                </MarketRow>
                <MarketRow label={event.away.name}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="DNB" outcome="2" label="2" price={d.dnb2} />
                </MarketRow>
              </>
            )}

            {/* GG/NG */}
            {activeSection === 'ggng' && (
              <>
                <SectionHeader title="Goal / No Goal" />
                <MarketRow label="Entrambe le squadre segnano — Si">
                  <OddsBtn eventId={eventId} eventName={eventName} market="GG/NG" outcome="GG" label="GG" price={d.gg} />
                </MarketRow>
                <MarketRow label="Entrambe le squadre segnano — No">
                  <OddsBtn eventId={eventId} eventName={eventName} market="GG/NG" outcome="NG" label="NG" price={d.ng} />
                </MarketRow>
              </>
            )}

            {/* O/U */}
            {activeSection === 'ou' && (
              <>
                <SectionHeader title="Over / Under Gol" />
                {d.totalsAll.map(t => (
                  <MarketRow key={t.point} label={`Totale gol — ${t.point}`}>
                    <OddsBtn eventId={eventId} eventName={eventName} market="O/U" outcome={`Over ${t.point}`} label={`Over ${t.point}`} price={t.over} />
                    <OddsBtn eventId={eventId} eventName={eventName} market="O/U" outcome={`Under ${t.point}`} label={`Under ${t.point}`} price={t.under} />
                  </MarketRow>
                ))}
              </>
            )}

            {/* Multigol */}
            {activeSection === 'multigol' && (
              <>
                <SectionHeader title="Multigol — Range Gol Totali" />
                {d.multigol.map(m => (
                  <MarketRow key={m.label} label={`Multigol ${m.label}`}>
                    <OddsBtn eventId={eventId} eventName={eventName} market="MULTIGOL" outcome={`Multigol ${m.label}`} label={m.label} price={m.price} />
                  </MarketRow>
                ))}
              </>
            )}

            {/* Handicap */}
            {activeSection === 'hcp' && (
              <>
                <SectionHeader title={`Handicap Europeo (${signStr(d.hcpPoint)})`} />
                <MarketRow label={`${event.home.name} ${signStr(d.hcpPoint)}`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="HCP" outcome={`Casa ${signStr(d.hcpPoint)}`} label={signStr(d.hcpPoint)} price={d.hcpHome} />
                </MarketRow>
                <MarketRow label={`${event.away.name} ${signStr(-d.hcpPoint)}`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="HCP" outcome={`Ospite ${signStr(-d.hcpPoint)}`} label={signStr(-d.hcpPoint)} price={d.hcpAway} />
                </MarketRow>
                {d.hcpMinus2Home > 1.01 && (
                  <>
                    <SectionHeader title="Handicap Europeo (-2)" />
                    <MarketRow label={`${event.home.name} -2`}>
                      <OddsBtn eventId={eventId} eventName={eventName} market="HCP" outcome="Casa -2" label="1" price={d.hcpMinus2Home} />
                    </MarketRow>
                    <MarketRow label="Pareggio">
                      <OddsBtn eventId={eventId} eventName={eventName} market="HCP" outcome="X -2" label="X" price={d.hcpMinus2Draw} />
                    </MarketRow>
                    <MarketRow label={`${event.away.name} -2`}>
                      <OddsBtn eventId={eventId} eventName={eventName} market="HCP" outcome="Ospite -2" label="2" price={d.hcpMinus2Away} />
                    </MarketRow>
                  </>
                )}
                {d.hcpPlus2Home > 1.01 && (
                  <>
                    <SectionHeader title="Handicap Europeo (+2)" />
                    <MarketRow label={`${event.home.name} +2`}>
                      <OddsBtn eventId={eventId} eventName={eventName} market="HCP" outcome="Casa +2" label="1" price={d.hcpPlus2Home} />
                    </MarketRow>
                    <MarketRow label="Pareggio">
                      <OddsBtn eventId={eventId} eventName={eventName} market="HCP" outcome="X +2" label="X" price={d.hcpPlus2Draw} />
                    </MarketRow>
                    <MarketRow label={`${event.away.name} +2`}>
                      <OddsBtn eventId={eventId} eventName={eventName} market="HCP" outcome="Ospite +2" label="2" price={d.hcpPlus2Away} />
                    </MarketRow>
                  </>
                )}
              </>
            )}

            {/* 1° Tempo */}
            {activeSection === 'h1' && (
              <>
                <SectionHeader title="1° Tempo — Risultato" />
                <MarketRow label={event.home.name}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="1T 1X2" outcome="1T 1" label="1" price={d.h1Home} />
                </MarketRow>
                <MarketRow label="Pareggio">
                  <OddsBtn eventId={eventId} eventName={eventName} market="1T 1X2" outcome="1T X" label="X" price={d.h1Draw} />
                </MarketRow>
                <MarketRow label={event.away.name}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="1T 1X2" outcome="1T 2" label="2" price={d.h1Away} />
                </MarketRow>
                <SectionHeader title={`1° Tempo — Over/Under ${d.h1Point}`} />
                <MarketRow label={`Over ${d.h1Point}`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="1T O/U" outcome={`1T Over ${d.h1Point}`} label={`Over ${d.h1Point}`} price={d.h1Over} />
                </MarketRow>
                <MarketRow label={`Under ${d.h1Point}`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="1T O/U" outcome={`1T Under ${d.h1Point}`} label={`Under ${d.h1Point}`} price={d.h1Under} />
                </MarketRow>
              </>
            )}

            {/* 2° Tempo */}
            {activeSection === 'h2' && (
              <>
                <SectionHeader title="2° Tempo — Risultato" />
                <MarketRow label={event.home.name}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="2T 1X2" outcome="2T 1" label="1" price={d.h2Home} />
                </MarketRow>
                <MarketRow label="Pareggio">
                  <OddsBtn eventId={eventId} eventName={eventName} market="2T 1X2" outcome="2T X" label="X" price={d.h2Draw} />
                </MarketRow>
                <MarketRow label={event.away.name}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="2T 1X2" outcome="2T 2" label="2" price={d.h2Away} />
                </MarketRow>
                <SectionHeader title={`2° Tempo — Over/Under ${d.h2Point}`} />
                <MarketRow label={`Over ${d.h2Point}`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="2T O/U" outcome={`2T Over ${d.h2Point}`} label={`Over ${d.h2Point}`} price={d.h2Over} />
                </MarketRow>
                <MarketRow label={`Under ${d.h2Point}`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="2T O/U" outcome={`2T Under ${d.h2Point}`} label={`Under ${d.h2Point}`} price={d.h2Under} />
                </MarketRow>
              </>
            )}

            {/* Gol Casa */}
            {activeSection === 'casa' && (
              <>
                <SectionHeader title={`Gol ${event.home.name}`} />
                {d.homeGoals.map(g => (
                  <MarketRow key={g.point} label={`Totale gol ${event.home.name} — ${g.point}`}>
                    <OddsBtn eventId={eventId} eventName={eventName} market="GOL CASA" outcome={`Casa Over ${g.point}`} label={`Over ${g.point}`} price={g.over} />
                    <OddsBtn eventId={eventId} eventName={eventName} market="GOL CASA" outcome={`Casa Under ${g.point}`} label={`Under ${g.point}`} price={g.under} />
                  </MarketRow>
                ))}
              </>
            )}

            {/* Gol Ospite */}
            {activeSection === 'ospite' && (
              <>
                <SectionHeader title={`Gol ${event.away.name}`} />
                {d.awayGoals.map(g => (
                  <MarketRow key={g.point} label={`Totale gol ${event.away.name} — ${g.point}`}>
                    <OddsBtn eventId={eventId} eventName={eventName} market="GOL OSPITE" outcome={`Ospite Over ${g.point}`} label={`Over ${g.point}`} price={g.over} />
                    <OddsBtn eventId={eventId} eventName={eventName} market="GOL OSPITE" outcome={`Ospite Under ${g.point}`} label={`Under ${g.point}`} price={g.under} />
                  </MarketRow>
                ))}
              </>
            )}

            {/* Corner */}
            {activeSection === 'corner' && (
              <>
                <SectionHeader title="Corner" />
                {d.corners.map(c => (
                  <MarketRow key={c.point} label={`Totale corner — ${c.point}`}>
                    <OddsBtn eventId={eventId} eventName={eventName} market="CORNER" outcome={`Corner Over ${c.point}`} label={`Over ${c.point}`} price={c.over} />
                    <OddsBtn eventId={eventId} eventName={eventName} market="CORNER" outcome={`Corner Under ${c.point}`} label={`Under ${c.point}`} price={c.under} />
                  </MarketRow>
                ))}
              </>
            )}

            {/* Combo */}
            {activeSection === 'combo' && (
              <>
                <SectionHeader title="Combo — Risultato + Goal/No Goal" />
                {d.combo.map(c => (
                  <MarketRow key={c.outcome} label={c.label}>
                    <OddsBtn eventId={eventId} eventName={eventName} market={c.market} outcome={c.outcome} label={c.label} price={c.price} />
                  </MarketRow>
                ))}
              </>
            )}

            {/* Risultato Esatto */}
            {activeSection === 'cs' && (
              <>
                <SectionHeader title={`Vittoria ${event.home.name}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
                  {d.csGrouped.home.map(cs => (
                    <OddsBtn key={cs.score} eventId={eventId} eventName={eventName} market="CS" outcome={cs.score} label={cs.score} price={cs.price} />
                  ))}
                </div>
                <SectionHeader title="Pareggio" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
                  {d.csGrouped.draw.map(cs => (
                    <OddsBtn key={cs.score} eventId={eventId} eventName={eventName} market="CS" outcome={cs.score} label={cs.score} price={cs.price} />
                  ))}
                </div>
                <SectionHeader title={`Vittoria ${event.away.name}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
                  {d.csGrouped.away.map(cs => (
                    <OddsBtn key={cs.score} eventId={eventId} eventName={eventName} market="CS" outcome={cs.score} label={cs.score} price={cs.price} />
                  ))}
                </div>
              </>
            )}

            {/* Pari/Dispari */}
            {activeSection === 'oddeven' && d.oddEven && (
              <>
                <SectionHeader title="Pari/Dispari Gol Totali" />
                <MarketRow label="Numero gol totali Pari (0, 2, 4...)">
                  <OddsBtn eventId={eventId} eventName={eventName} market="P/D" outcome="Pari" label="Pari" price={d.oddEven.even} />
                </MarketRow>
                <MarketRow label="Numero gol totali Dispari (1, 3, 5...)">
                  <OddsBtn eventId={eventId} eventName={eventName} market="P/D" outcome="Dispari" label="Dispari" price={d.oddEven.odd} />
                </MarketRow>
              </>
            )}

            {/* Primo Gol */}
            {activeSection === 'firstgoal' && d.firstGoal && (
              <>
                <SectionHeader title="Chi Segna il Primo Gol" />
                <MarketRow label={`${event.home.name} segna per prima`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="1° GOL" outcome="1° Gol Casa" label="Casa" price={d.firstGoal.home} />
                </MarketRow>
                <MarketRow label={`${event.away.name} segna per prima`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="1° GOL" outcome="1° Gol Ospite" label="Ospite" price={d.firstGoal.away} />
                </MarketRow>
                <MarketRow label="Nessun gol nella partita">
                  <OddsBtn eventId={eventId} eventName={eventName} market="1° GOL" outcome="Nessun Gol" label="Nessun Gol" price={d.firstGoal.noGoal} />
                </MarketRow>
              </>
            )}

            {/* Prossimo Gol */}
            {activeSection === 'nextgoal' && d.nextGoal && (
              <>
                <SectionHeader title="Prossimo Gol" />
                <MarketRow label={`${event.home.name} segna il prossimo`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="NEXT GOL" outcome="Next Gol Casa" label="Casa" price={d.nextGoal.home} />
                </MarketRow>
                <MarketRow label={`${event.away.name} segna il prossimo`}>
                  <OddsBtn eventId={eventId} eventName={eventName} market="NEXT GOL" outcome="Next Gol Ospite" label="Ospite" price={d.nextGoal.away} />
                </MarketRow>
                <MarketRow label="Nessun altro gol">
                  <OddsBtn eventId={eventId} eventName={eventName} market="NEXT GOL" outcome="Nessun Altro Gol" label="Nessun Altro" price={d.nextGoal.noMore} />
                </MarketRow>
              </>
            )}

            {/* Margine di Vittoria */}
            {activeSection === 'margin' && d.winningMargin.length > 0 && (
              <>
                <SectionHeader title="Margine di Vittoria" />
                {d.winningMargin.map(m => (
                  <MarketRow key={m.label} label={m.label}>
                    <OddsBtn eventId={eventId} eventName={eventName} market="MARGINE" outcome={m.label} label={m.label} price={m.price} />
                  </MarketRow>
                ))}
              </>
            )}

            {/* HT/FT */}
            {activeSection === 'htft' && d.htft.length > 0 && (
              <>
                <SectionHeader title="Primo Tempo / Finale Tempo" />
                {d.htft.map(h => (
                  <MarketRow key={h.combo} label={`HT/FT ${h.combo}`}>
                    <OddsBtn eventId={eventId} eventName={eventName} market="HT/FT" outcome={`HT/FT ${h.combo}`} label={h.combo} price={h.price} />
                  </MarketRow>
                ))}
              </>
            )}
            {/* ── MERCATI SPORT-SPECIFICI ── */}
            {(sportMarkets || !isSoccer) && event && (() => {
              // Per prematch senza sportMarkets, usa quote stimate
              const sm = sportMarkets || (d ? {
                h2h: { home: d.h2hHome, away: d.h2hAway },
                h2h_incl_ot: { home: d.h2hHome, away: d.h2hAway },
                handicap: [{ line: d.hcpPoint, home: d.hcpHome, away: d.hcpAway }],
                over_under: d.totalsAll.map(t => ({ line: t.point, over: t.over, under: t.under })),
                h1: {
                   home: d.h1Home, away: d.h1Away,
                   ou: [{ line: d.h1Point, over: d.h1Over, under: d.h1Under }]
                },
                q1: { home: d.h1Home, away: d.h1Away },
                odd_even: d.oddEven,
                winner: { p1: d.h2hHome, p2: d.h2hAway },
                winner_excl_ret: { p1: d.h2hHome, p2: d.h2hAway },
                set_winner: [{ set: 1, p1: d.h2hHome, p2: d.h2hAway }],
                ou_games: d.totalsAll.map(t => ({ line: t.point, over: t.over, under: t.under })),
              } : null) as any;
              
              if (!sm) return null;
              type OddVal = number | null;
              function OB({ label, val, market, outcome }: { label: string; val: OddVal; market: string; outcome: string }) {
                if (!val || val <= 1.01) return null;
                return <OddsBtn eventId={eventId} eventName={eventName} market={market} outcome={outcome} price={val} label={label} />;
              }

              // BASKET
              if (activeSection === 'bk_h2h') return (
                <>
                  <SectionHeader title="Testa a Testa" />
                  <MarketRow label={event!.home.name}><OB label="Casa" val={(sm.h2h as {home:OddVal})?.home} market="T/T" outcome="Casa" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="Ospite" val={(sm.h2h as {away:OddVal})?.away} market="T/T" outcome="Ospite" /></MarketRow>
                  <SectionHeader title="T/T Incl. Supplementari" />
                  <MarketRow label={event!.home.name}><OB label="Casa" val={(sm.h2h_incl_ot as {home:OddVal})?.home} market="T/T OT" outcome="Casa OT" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="Ospite" val={(sm.h2h_incl_ot as {away:OddVal})?.away} market="T/T OT" outcome="Ospite OT" /></MarketRow>
                </>
              );
              if (activeSection === 'bk_hcp') return (
                <>
                  <SectionHeader title="Handicap" />
                  {((sm.handicap as Array<{line:number;home:OddVal;away:OddVal}>) ?? []).map(h => (
                    <MarketRow key={h.line} label={`Handicap ${h.line > 0 ? '+' : ''}${h.line}`}>
                      <OB label={`Casa ${h.line > 0 ? '+' : ''}${h.line}`} val={h.home} market="HCP" outcome={`Casa ${h.line}`} />
                      <OB label={`Ospite ${h.line > 0 ? '-' : '+'}${Math.abs(h.line)}`} val={h.away} market="HCP" outcome={`Ospite ${h.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bk_ou') return (
                <>
                  <SectionHeader title="Over/Under Punti" />
                  {((sm.over_under as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Totale ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U" outcome={`Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U" outcome={`Under ${o.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bk_h1') return (
                <>
                  <SectionHeader title="1° Tempo" />
                  <MarketRow label={event!.home.name}><OB label="Casa" val={(sm.h1 as {home:OddVal})?.home} market="1T" outcome="1T Casa" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="Ospite" val={(sm.h1 as {away:OddVal})?.away} market="1T" outcome="1T Ospite" /></MarketRow>
                  {((sm.h1 as {ou?:Array<{line:number;over:OddVal;under:OddVal}>})?.ou ?? []).map(o => (
                    <MarketRow key={o.line} label={`O/U ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="1T O/U" outcome={`1T Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="1T O/U" outcome={`1T Under ${o.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bk_q1') return (
                <>
                  <SectionHeader title="1° Quarto" />
                  <MarketRow label={event!.home.name}><OB label="Casa" val={(sm.q1 as {home:OddVal})?.home} market="Q1" outcome="Q1 Casa" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="Ospite" val={(sm.q1 as {away:OddVal})?.away} market="Q1" outcome="Q1 Ospite" /></MarketRow>
                </>
              );
              if (activeSection === 'bk_oe') return (
                <>
                  <SectionHeader title="Pari/Dispari Punti Totali" />
                  <MarketRow label="Pari"><OB label="Pari" val={(sm.odd_even as {even:OddVal})?.even} market="P/D" outcome="Pari" /></MarketRow>
                  <MarketRow label="Dispari"><OB label="Dispari" val={(sm.odd_even as {odd:OddVal})?.odd} market="P/D" outcome="Dispari" /></MarketRow>
                </>
              );
              if (activeSection === 'bk_margin') return (
                <>
                  <SectionHeader title="Margine di Vittoria" />
                  {((sm.margin as Array<{label:string;odds:OddVal}>) ?? []).map(m => (
                    <MarketRow key={m.label} label={`Margine ${m.label}`}>
                      <OB label={m.label} val={m.odds} market="Margine" outcome={`Margine ${m.label}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bk_combo') return (
                <>
                  <SectionHeader title="Combo" />
                  {((sm.combo as Array<{label:string;odds:OddVal}>) ?? []).map(c => (
                    <MarketRow key={c.label} label={c.label}>
                      <OB label={c.label} val={c.odds} market="Combo" outcome={c.label} />
                    </MarketRow>
                  ))}
                </>
              );

              // TENNIS
              if (activeSection === 'tn_winner') return (
                <>
                  <SectionHeader title="Vincente Incontro" />
                  <MarketRow label={`${event!.home.name} (escl. ritiro)`}><OB label="P1" val={(sm.winner as {p1:OddVal})?.p1} market="Vincente" outcome="P1" /></MarketRow>
                  <MarketRow label={`${event!.away.name} (escl. ritiro)`}><OB label="P2" val={(sm.winner as {p2:OddVal})?.p2} market="Vincente" outcome="P2" /></MarketRow>
                  <SectionHeader title="P1 Vince Almeno Un Set" />
                  <MarketRow label="Sì"><OB label="Sì" val={sm.p1_wins_set as OddVal} market="P1 Set" outcome="P1 Set Sì" /></MarketRow>
                  <SectionHeader title="P2 Vince Almeno Un Set" />
                  <MarketRow label="Sì"><OB label="Sì" val={sm.p2_wins_set as OddVal} market="P2 Set" outcome="P2 Set Sì" /></MarketRow>
                </>
              );
              if (activeSection === 'tn_set') return (
                <>
                  {((sm.set_winner as Array<{set:number;p1:OddVal;p2:OddVal}>) ?? []).map(s => (
                    <div key={s.set}>
                      <SectionHeader title={`Vincente Set ${s.set} (escl. ritiro)`} />
                      <MarketRow label={event!.home.name}><OB label="P1" val={s.p1} market={`Set ${s.set}`} outcome={`Set ${s.set} P1`} /></MarketRow>
                      <MarketRow label={event!.away.name}><OB label="P2" val={s.p2} market={`Set ${s.set}`} outcome={`Set ${s.set} P2`} /></MarketRow>
                    </div>
                  ))}
                </>
              );
              if (activeSection === 'tn_ou') return (
                <>
                  <SectionHeader title="U/O Games Totali" />
                  {((sm.ou_games as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Games ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U Games" outcome={`Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U Games" outcome={`Under ${o.line}`} />
                    </MarketRow>
                  ))}
                  <SectionHeader title={`U/O Games ${event!.home.name}`} />
                  {((sm.ou_games_p1 as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Games P1 ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U P1" outcome={`P1 Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U P1" outcome={`P1 Under ${o.line}`} />
                    </MarketRow>
                  ))}
                  <SectionHeader title={`U/O Games ${event!.away.name}`} />
                  {((sm.ou_games_p2 as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Games P2 ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U P2" outcome={`P2 Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U P2" outcome={`P2 Under ${o.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'tn_hcp') return (
                <>
                  <SectionHeader title="Handicap Games" />
                  {((sm.handicap_games as Array<{line:number;p1:OddVal;p2:OddVal}>) ?? []).map(h => (
                    <MarketRow key={h.line} label={`Handicap ${h.line > 0 ? '+' : ''}${h.line}`}>
                      <OB label={`P1 ${h.line > 0 ? '+' : ''}${h.line}`} val={h.p1} market="HCP Games" outcome={`P1 HCP ${h.line}`} />
                      <OB label={`P2 ${h.line > 0 ? '-' : '+'}${Math.abs(h.line)}`} val={h.p2} market="HCP Games" outcome={`P2 HCP ${h.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'tn_oe') return (
                <>
                  <SectionHeader title="Pari/Dispari Games" />
                  <MarketRow label="Pari"><OB label="Pari" val={(sm.odd_even_games as {even:OddVal})?.even} market="P/D Games" outcome="Games Pari" /></MarketRow>
                  <MarketRow label="Dispari"><OB label="Dispari" val={(sm.odd_even_games as {odd:OddVal})?.odd} market="P/D Games" outcome="Games Dispari" /></MarketRow>
                </>
              );
              if (activeSection === 'tn_sb') return (
                <>
                  <SectionHeader title="Set Betting" />
                  {((sm.set_betting as Array<{score:string;odds:OddVal}>) ?? []).map(s => (
                    <MarketRow key={s.score} label={s.score}>
                      <OB label={s.score} val={s.odds} market="Set Betting" outcome={`SB ${s.score}`} />
                    </MarketRow>
                  ))}
                  <SectionHeader title="Totale Set" />
                  <MarketRow label="2 Set"><OB label="2 Set" val={(sm.total_sets as {two:OddVal})?.two} market="Tot Set" outcome="2 Set" /></MarketRow>
                  <MarketRow label="3 Set"><OB label="3 Set" val={(sm.total_sets as {three:OddVal})?.three} market="Tot Set" outcome="3 Set" /></MarketRow>
                </>
              );
              if (activeSection === 'tn_cs') return (
                <>
                  <SectionHeader title="Risultato Esatto Set" />
                  {((sm.exact_score as Array<{score:string;odds:OddVal}>) ?? []).map(s => (
                    <MarketRow key={s.score} label={`Ris. ${s.score}`}>
                      <OB label={s.score} val={s.odds} market="CS Set" outcome={`CS ${s.score}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'tn_combo') return (
                <>
                  <SectionHeader title="Combo Set 1 & Match" />
                  {((sm.combo_set1_match as Array<{label:string;odds:OddVal}>) ?? []).map(c => (
                    <MarketRow key={c.label} label={c.label}>
                      <OB label={c.label} val={c.odds} market="Combo S1" outcome={c.label} />
                    </MarketRow>
                  ))}
                </>
              );

              // BASEBALL
              if (activeSection === 'bb_h2h') return (
                <>
                  <SectionHeader title="Testa a Testa" />
                  <MarketRow label={event!.home.name}><OB label="Casa" val={(sm.h2h as {home:OddVal})?.home} market="T/T" outcome="Casa" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="Ospite" val={(sm.h2h as {away:OddVal})?.away} market="T/T" outcome="Ospite" /></MarketRow>
                  <SectionHeader title="T/T Esclusi Extra Inning" />
                  <MarketRow label={event!.home.name}><OB label="Casa" val={(sm.h2h_excl_extra as {home:OddVal})?.home} market="T/T EI" outcome="Casa EI" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="Ospite" val={(sm.h2h_excl_extra as {away:OddVal})?.away} market="T/T EI" outcome="Ospite EI" /></MarketRow>
                </>
              );
              if (activeSection === 'bb_hcp') return (
                <>
                  <SectionHeader title="Handicap" />
                  {((sm.handicap as Array<{line:number;home:OddVal;away:OddVal}>) ?? []).map(h => (
                    <MarketRow key={h.line} label={`Handicap ${h.line > 0 ? '+' : ''}${h.line}`}>
                      <OB label={`Casa ${h.line > 0 ? '+' : ''}${h.line}`} val={h.home} market="HCP" outcome={`Casa HCP ${h.line}`} />
                      <OB label={`Ospite ${h.line > 0 ? '-' : '+'}${Math.abs(h.line)}`} val={h.away} market="HCP" outcome={`Ospite HCP ${h.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bb_ou') return (
                <>
                  <SectionHeader title="Over/Under Run Totali" />
                  {((sm.over_under as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Totale ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U" outcome={`Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U" outcome={`Under ${o.line}`} />
                    </MarketRow>
                  ))}
                  <SectionHeader title="T/T + U/O (Incl. Extra Inning)" />
                  {((sm.total_ou_incl_ei as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Totale EI ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U EI" outcome={`EI Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U EI" outcome={`EI Under ${o.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bb_oe') return (
                <>
                  <SectionHeader title="Pari/Dispari Run Totali" />
                  <MarketRow label="Pari"><OB label="Pari" val={(sm.odd_even as {even:OddVal})?.even} market="P/D" outcome="Pari" /></MarketRow>
                  <MarketRow label="Dispari"><OB label="Dispari" val={(sm.odd_even as {odd:OddVal})?.odd} market="P/D" outcome="Dispari" /></MarketRow>
                </>
              );
              if (activeSection === 'bb_home') return (
                <>
                  <SectionHeader title={`U/O Run ${event!.home.name}`} />
                  {((sm.ou_home as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Casa ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U Casa" outcome={`Casa Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U Casa" outcome={`Casa Under ${o.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bb_away') return (
                <>
                  <SectionHeader title={`U/O Run ${event!.away.name}`} />
                  {((sm.ou_away as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Ospite ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U Ospite" outcome={`Ospite Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U Ospite" outcome={`Ospite Under ${o.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bb_1inn') return (
                <>
                  <SectionHeader title="1X2 1° Inning" />
                  <MarketRow label={event!.home.name}><OB label="1" val={(sm.h2h_1st_inning as {home:OddVal})?.home} market="1° Inn" outcome="1Inn Casa" /></MarketRow>
                  <MarketRow label="Pareggio"><OB label="X" val={(sm.h2h_1st_inning as {draw:OddVal})?.draw} market="1° Inn" outcome="1Inn X" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="2" val={(sm.h2h_1st_inning as {away:OddVal})?.away} market="1° Inn" outcome="1Inn Ospite" /></MarketRow>
                </>
              );
              if (activeSection === 'bb_5inn') return (
                <>
                  <SectionHeader title="1X2 Dopo 5 Inning" />
                  <MarketRow label={event!.home.name}><OB label="Casa" val={(sm.h2h_after5 as {home:OddVal})?.home} market="5 Inn" outcome="5Inn Casa" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="Ospite" val={(sm.h2h_after5 as {away:OddVal})?.away} market="5 Inn" outcome="5Inn Ospite" /></MarketRow>
                  <SectionHeader title="U/O Dopo 5 Inning" />
                  {((sm.ou_after5 as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`5Inn ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="5Inn O/U" outcome={`5Inn Over ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="5Inn O/U" outcome={`5Inn Under ${o.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bb_ei') return (
                <>
                  <SectionHeader title="Extra Inning Sì/No" />
                  <MarketRow label="Extra Inning Sì"><OB label="Sì" val={(sm.extra_inning as {yes:OddVal})?.yes} market="Extra Inn" outcome="EI Sì" /></MarketRow>
                  <MarketRow label="Extra Inning No"><OB label="No" val={(sm.extra_inning as {no:OddVal})?.no} market="Extra Inn" outcome="EI No" /></MarketRow>
                </>
              );

              // BOXE / MMA
              if (activeSection === 'bx_h2h') return (
                <>
                  <SectionHeader title="Testa a Testa" />
                  <MarketRow label={event!.home.name}><OB label="Casa" val={(sm.h2h as {home:OddVal})?.home} market="T/T" outcome="Casa" /></MarketRow>
                  <MarketRow label={event!.away.name}><OB label="Ospite" val={(sm.h2h as {away:OddVal})?.away} market="T/T" outcome="Ospite" /></MarketRow>
                </>
              );
              if (activeSection === 'bx_ou') return (
                <>
                  <SectionHeader title="Over/Under Round" />
                  {((sm.ou_rounds as Array<{line:number;over:OddVal;under:OddVal}>) ?? []).map(o => (
                    <MarketRow key={o.line} label={`Round ${o.line}`}>
                      <OB label={`Over ${o.line}`} val={o.over} market="O/U Round" outcome={`Over Round ${o.line}`} />
                      <OB label={`Under ${o.line}`} val={o.under} market="O/U Round" outcome={`Under Round ${o.line}`} />
                    </MarketRow>
                  ))}
                </>
              );
              if (activeSection === 'bx_method') return (
                <>
                  <SectionHeader title="Metodo di Vittoria" />
                  <MarketRow label={`${event!.home.name} per KO/TKO`}><OB label="KO Casa" val={(sm.method as {ko_home:OddVal})?.ko_home} market="Metodo" outcome="KO Casa" /></MarketRow>
                  <MarketRow label={`${event!.away.name} per KO/TKO`}><OB label="KO Ospite" val={(sm.method as {ko_away:OddVal})?.ko_away} market="Metodo" outcome="KO Ospite" /></MarketRow>
                  <MarketRow label="Decisione dei Giudici"><OB label="Decisione" val={(sm.method as {decision:OddVal})?.decision} market="Metodo" outcome="Decisione" /></MarketRow>
                </>
              );

              return null;
            })()}

          </>
        )}
      </div>

      {/* ── RIGHT SIDEBAR - SCHEDINA ── */}
      <aside style={{ 
        width: 280, 
        flexShrink: 0, 
        background: '#0d1117', 
        borderLeft: '1px solid #1a2535',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 48,
        height: 'calc(100vh - 48px)'
      }}>
        <InlineBetSlip />
      </aside>
    </div>
  );
}
