'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { getCasinoGames, getLiveCasinoGames } from '../lib/xcodetecApi';
import { Gamepad2, ImageOff } from 'lucide-react';

interface Game {
  id: string;
  name: string;
  image: string;
  provider: string;
  category?: string;
}

interface CasinoGamesProps {
  variant?: 'casino' | 'live';
  limit?: number;
}

const FALLBACK_IMAGES: Record<string, string> = {
  pragmatic: '/images/providers/pragmatic.png',
  evolution: '/images/providers/evolution.png',
  netent: '/images/providers/netent.png',
  playngo: '/images/providers/playngo.png',
  microgaming: '/images/providers/microgaming.png',
  default: '/images/game-placeholder.svg',
};

function getGameImage(game: Game): string {
  if (game.image && game.image.startsWith('http')) return game.image;

  const provider = game.provider?.toLowerCase() || '';
  for (const [key, url] of Object.entries(FALLBACK_IMAGES)) {
    if (provider.includes(key)) return url;
  }

  return FALLBACK_IMAGES.default;
}

function normalizeGames(payload: unknown): Game[] {
  const source = payload as { data?: unknown; games?: unknown; list?: unknown } | null;
  const rawList = Array.isArray(payload) ? payload : source?.data ?? source?.games ?? source?.list;
  if (!Array.isArray(rawList)) return [];

  const normalized: Game[] = [];

  rawList.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;

    const name =
      (typeof obj.name === 'string' && obj.name) ||
      (typeof obj.title === 'string' && obj.title) ||
      `Game ${index + 1}`;

    const image =
      (typeof obj.image === 'string' && obj.image) ||
      (typeof obj.thumb === 'string' && obj.thumb) ||
      (typeof obj.thumbnail === 'string' && obj.thumbnail) ||
      '';

    const provider =
      (typeof obj.provider === 'string' && obj.provider) ||
      (typeof obj.vendor === 'string' && obj.vendor) ||
      'Unknown';

    const id =
      (typeof obj.id === 'string' && obj.id) ||
      (typeof obj.game_id === 'string' && obj.game_id) ||
      `game-${index}`;

    normalized.push({
      id,
      name,
      image,
      provider,
      category: typeof obj.category === 'string' ? obj.category : undefined,
    });
  });

  return normalized;
}

export default function CasinoGames({ variant = 'casino', limit = 8 }: CasinoGamesProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadGames() {
      setLoading(true);
      try {
        const data = variant === 'casino' ? await getCasinoGames() : await getLiveCasinoGames();
        if (cancelled) return;
        setGames(normalizeGames(data));
      } catch (err) {
        console.error('Failed to load games:', err);
        if (!cancelled) setGames([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGames();

    return () => {
      cancelled = true;
    };
  }, [variant]);

  const visibleGames = useMemo(() => games.slice(0, limit), [games, limit]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="aspect-[3/4] bg-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (visibleGames.length === 0) return null;

  const title = variant === 'casino' ? 'Casino' : 'Live Casino';

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white">{title}</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {visibleGames.map((game) => {
          const imageUrl = getGameImage(game);
          const hasError = imageErrors.has(game.id);

          return (
            <button
              key={game.id}
              className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 transition-all hover:scale-[1.02] border border-white/10"
            >
              {!hasError ? (
                <img
                  src={imageUrl}
                  alt={game.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() =>
                    setImageErrors((prev) => {
                      const newSet = new Set(prev);
                      newSet.add(game.id);
                      return newSet;
                    })
                  }
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 p-4">
                  <ImageOff className="w-12 h-12 text-gray-500 mb-2" />
                  <Gamepad2 className="w-8 h-8 text-[#14805e]" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-[#14805e] hover:bg-[#1a9c70] text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                  GIOCA
                </span>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white font-medium text-sm truncate">{game.name}</p>
                <p className="text-gray-400 text-xs">{game.provider}</p>
              </div>

              {game.category && (
                <span className="absolute top-2 right-2 bg-[#14805e]/80 text-white text-[10px] px-2 py-0.5 rounded">
                  {game.category}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
