import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

type FallbackEvent = {
  id: string;
  sport_category?: string;
  league?: { name?: string };
  live?: boolean;
};

type Championship = {
  id: number;
  discipline: number;
  sport: string;
  nation: string;
  name: string;
  label: string;
};

function getDiscipline(sport: string): number {
  switch (sport) {
    case 'soccer':
      return 1;
    case 'tennis':
      return 4;
    case 'basketball':
      return 5;
    default:
      return 1;
  }
}

function parseLeagueLabel(label?: string): { nation: string; name: string; label: string } {
  const raw = (label ?? 'Internazionale — Prematch').trim();
  const sep = raw.indexOf('—');
  if (sep > 0) {
    return {
      nation: raw.slice(0, sep).trim(),
      name: raw.slice(sep + 1).trim(),
      label: raw,
    };
  }

  return {
    nation: 'Internazionale',
    name: raw,
    label: `Internazionale — ${raw}`,
  };
}

async function readFallbackEvents(): Promise<FallbackEvent[]> {
  const filePath = path.join(process.cwd(), '..', 'events_dump.json');
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed as FallbackEvent[];
}

function buildChampionships(events: FallbackEvent[]): Championship[] {
  const seen = new Map<string, Championship>();

  events
    .filter((event) => !event.live)
    .forEach((event) => {
      const sport = (event.sport_category ?? 'soccer').toLowerCase();
      const leagueInfo = parseLeagueLabel(event.league?.name);
      const key = `${sport}::${leagueInfo.label}`;

      if (!seen.has(key)) {
        seen.set(key, {
          id: seen.size + 1,
          discipline: getDiscipline(sport),
          sport,
          nation: leagueInfo.nation,
          name: leagueInfo.name,
          label: leagueInfo.label,
        });
      }
    });

  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, 'it'));
}

export async function GET(
  req: NextRequest,
  context: { params: { slug?: string[] } }
) {
  try {
    const slug = context.params.slug ?? [];
    const events = await readFallbackEvents();
    const championships = buildChampionships(events);

    if (slug.length === 1 && slug[0] === 'events') {
      return NextResponse.json(events);
    }

    if (slug.length === 1 && slug[0] === 'championships') {
      return NextResponse.json(championships);
    }

    if (slug.length === 2 && slug[0] === 'league') {
      const championshipId = Number(slug[1]);
      const selected = championships.find((item) => item.id === championshipId);

      if (!selected) {
        return NextResponse.json({ error: 'Campionato non trovato' }, { status: 404 });
      }

      const filtered = events.filter((event) => {
        if (event.live) return false;
        const sport = (event.sport_category ?? 'soccer').toLowerCase();
        return sport === selected.sport && parseLeagueLabel(event.league?.name).label === selected.label;
      });

      return NextResponse.json(filtered);
    }

    return NextResponse.json({ error: 'Endpoint fallback non trovato' }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore interno fallback';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
