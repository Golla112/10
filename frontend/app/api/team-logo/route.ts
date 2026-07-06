import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const src = req.nextUrl.searchParams.get('src') ?? 'fd';

  if (!id || !/^\d+$/.test(id)) {
    return new NextResponse(null, { status: 400 });
  }

  const urls =
    src === 'espn'
      ? [
          `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`,
          `https://a.espncdn.com/i/teamlogos/soccer/500-dark/${id}.png`,
        ]
      : [
          `https://crests.football-data.org/${id}.png`,
          `https://crests.football-data.org/${id}.svg`,
        ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BigBet365/1.0)',
          Accept: 'image/*',
        },
        next: { revalidate: 86400 },
      });

      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') ?? 'image/png';
      // Only accept image responses
      if (!contentType.startsWith('image/') && !contentType.includes('svg')) continue;

      const buf = await res.arrayBuffer();
      if (buf.byteLength < 100) continue; // skip empty/error responses

      return new NextResponse(buf, {
        headers: {
          'Content-Type': contentType.includes('svg') ? 'image/svg+xml' : 'image/png',
          'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        },
      });
    } catch {
      continue;
    }
  }

  return new NextResponse(null, { status: 404 });
}
