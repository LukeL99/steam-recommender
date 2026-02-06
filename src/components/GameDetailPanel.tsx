'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatPlaytime, getGameHeaderImage } from '@/lib/steam';
import StatusButtons from '@/components/StatusButtons';
import { useGameStatuses } from '@/components/GameStatusContext';

interface Game {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url: string;
  rtime_last_played?: number;
}

interface SimilarRec {
  name: string;
  appid: number | null;
  reason: string;
  tags: string[];
  storeUrl?: string;
}

interface GameDetailData {
  game: {
    appid: number;
    name: string;
    playtime_forever: number;
    genres: string[];
    categories: string[];
    developers: string[];
    short_description: string;
    release_date: string;
    metacritic: number | null;
  };
  recommendations: SimilarRec[];
}

interface GameDetailPanelProps {
  game: Game | null;
  onClose: () => void;
}

export default function GameDetailPanel({ game, onClose }: GameDetailPanelProps) {
  const [data, setData] = useState<GameDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getStatus, setStatus } = useGameStatuses();

  const fetchSimilar = useCallback(async (appid: number) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/similar?appid=${appid}`);
      if (!res.ok) throw new Error('Failed to load recommendations');
      const d = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (game) {
      fetchSimilar(game.appid);
    } else {
      setData(null);
      setError(null);
    }
  }, [game, fetchSimilar]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (game) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [game, onClose]);

  if (!game) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-steam-darker z-50 shadow-2xl overflow-y-auto border-l border-[#2a3f5f]/50 animate-slide-in">
        {/* Header with game image */}
        <div className="relative">
          <div className="aspect-[460/215] bg-[#0a0f16]">
            <img
              src={getGameHeaderImage(game.appid)}
              alt={game.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-steam-darker via-transparent to-transparent" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Game title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">{game.name}</h2>
            <div className="flex items-center gap-4 mt-2">
              <span className={`text-sm font-medium ${game.playtime_forever > 0 ? 'text-steam-blue' : 'text-steam-text-secondary'}`}>
                {game.playtime_forever > 0 ? formatPlaytime(game.playtime_forever) : 'Never played'}
              </span>
              {game.playtime_2weeks && game.playtime_2weeks > 0 && (
                <span className="text-sm text-steam-text-secondary">
                  {formatPlaytime(game.playtime_2weeks)} last 2 weeks
                </span>
              )}
              <a
                href={`https://store.steampowered.com/app/${game.appid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-steam-blue hover:text-steam-blue-hover transition-colors flex items-center gap-1"
              >
                Steam Store
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Status buttons for this game */}
        <div className="px-6 pt-4">
          <StatusButtons
            appid={game.appid}
            name={game.name}
            currentStatus={getStatus(game.appid)}
            onStatusChange={(appid, status) => setStatus(appid, status)}
          />
        </div>

        {/* Game details */}
        <div className="px-6 pt-3 pb-2">
          {data?.game?.short_description && (
            <p className="text-sm text-steam-text leading-relaxed mb-4">{data.game.short_description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            {data?.game?.genres && data.game.genres.length > 0 && (
              <div>
                <span className="text-steam-text-secondary">Genres: </span>
                <span className="text-white">{data.game.genres.join(', ')}</span>
              </div>
            )}
            {data?.game?.developers && data.game.developers.length > 0 && (
              <div>
                <span className="text-steam-text-secondary">Developer: </span>
                <span className="text-white">{data.game.developers.join(', ')}</span>
              </div>
            )}
            {data?.game?.release_date && (
              <div>
                <span className="text-steam-text-secondary">Released: </span>
                <span className="text-white">{data.game.release_date}</span>
              </div>
            )}
            {data?.game?.metacritic && (
              <div>
                <span className="text-steam-text-secondary">Metacritic: </span>
                <span className={`font-semibold ${data.game.metacritic >= 75 ? 'text-green-400' : data.game.metacritic >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {data.game.metacritic}
                </span>
              </div>
            )}
          </div>

          {data?.game?.genres && data.game.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {data.game.genres.map(genre => (
                <span key={genre} className="text-xs bg-steam-blue/10 text-steam-blue px-3 py-1 rounded-full">
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-6 my-4 border-t border-[#2a3f5f]/50" />

        {/* Similar Games Section */}
        <div className="px-6 pb-8">
          <div className="flex items-center gap-3 mb-5">
            <svg className="w-5 h-5 text-steam-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Games Like {game.name}</h3>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-5 h-5 text-steam-blue animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-steam-text-secondary text-sm">Finding similar games with AI...</span>
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-lg bg-[#1e2837]">
                  <div className="w-40 flex-shrink-0 aspect-[460/215] skeleton rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-3/4 skeleton rounded" />
                    <div className="h-4 w-full skeleton rounded" />
                    <div className="h-4 w-2/3 skeleton rounded" />
                    <div className="flex gap-2 mt-2">
                      <div className="h-5 w-16 skeleton rounded-full" />
                      <div className="h-5 w-20 skeleton rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-8">
              <p className="text-red-400 mb-3">{error}</p>
              <button
                onClick={() => fetchSimilar(game.appid)}
                className="btn-blue text-sm px-4 py-2"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Results */}
          {data && !loading && (
            <div className="space-y-4">
              {data.recommendations.map((rec, i) => (
                <SimilarGameCard key={`${rec.name}-${i}`} rec={rec} />
              ))}
              {data.recommendations.length === 0 && (
                <p className="text-steam-text-secondary text-center py-8">
                  No recommendations found. Try another game!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SimilarGameCard({ rec }: { rec: SimilarRec }) {
  const [imgError, setImgError] = useState(false);
  const { getStatus, setStatus } = useGameStatuses();

  return (
    <div className="flex gap-4 p-4 rounded-lg bg-[#1e2837] border border-[#2a3f5f]/30 hover:border-steam-blue/30 transition-all group">
      {/* Game image */}
      <div className="w-40 flex-shrink-0">
        <div className="aspect-[460/215] bg-[#0a0f16] rounded overflow-hidden">
          {rec.appid && !imgError ? (
            <img
              src={getGameHeaderImage(rec.appid)}
              alt={rec.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-steam-text-secondary">
              <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-white group-hover:text-steam-blue-hover transition-colors truncate">
          {rec.name}
        </h4>
        <p className="text-sm text-steam-text mt-1 leading-relaxed line-clamp-2">{rec.reason}</p>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {rec.tags.map(tag => (
            <span key={tag} className="text-[11px] bg-steam-blue/10 text-steam-blue px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-2">
          {rec.storeUrl && (
            <a
              href={rec.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-steam-blue hover:text-steam-blue-hover transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              View on Steam
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>

        {/* Status buttons */}
        {rec.appid && (
          <div className="mt-2">
            <StatusButtons
              appid={rec.appid}
              name={rec.name}
              currentStatus={getStatus(rec.appid)}
              onStatusChange={(appid, status) => setStatus(appid, status)}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}
