'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { formatPlaytime, getGameHeaderImage } from '@/lib/steam';
import Link from 'next/link';
import GameDetailPanel from '@/components/GameDetailPanel';
import { GameStatusProvider, useGameStatuses } from '@/components/GameStatusContext';
import { StatusBadge } from '@/components/StatusButtons';
import StatusButtons from '@/components/StatusButtons';

interface Game {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url: string;
  rtime_last_played?: number;
}

interface LibraryData {
  steamId: string;
  displayName: string;
  avatar: string;
  totalGames: number;
  totalPlaytime: number;
  games: Game[];
}

interface GenreRec {
  name: string;
  appid: number | null;
  reason: string;
  tags: string[];
  storeUrl?: string;
  playtime_hours?: number;
}

interface GenreSearchResult {
  query: string;
  recommendations: GenreRec[];
  libraryOnly: boolean;
  totalGames: number;
}

type SortKey = 'playtime' | 'name' | 'recent';

const QUICK_GENRES = [
  'Roguelite', 'RPG', 'Metroidvania', 'Strategy', 'Horror',
  'Cozy', 'Souls-like', 'Survival', 'Puzzle', 'Indie Gems',
  'Open World', 'Co-op',
];

export default function LibraryPage() {
  return (
    <GameStatusProvider>
      <LibraryContent />
    </GameStatusProvider>
  );
}

function LibraryContent() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('playtime');
  const [showUnplayed, setShowUnplayed] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Genre search state
  const [genreQuery, setGenreQuery] = useState('');
  const [genreResults, setGenreResults] = useState<GenreSearchResult | null>(null);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genreError, setGenreError] = useState<string | null>(null);
  const [genreLibraryOnly, setGenreLibraryOnly] = useState(false);

  const handleClosePanel = useCallback(() => setSelectedGame(null), []);

  useEffect(() => {
    fetch('/api/library')
      .then(res => {
        if (res.status === 401) {
          window.location.href = '/';
          return null;
        }
        if (!res.ok) throw new Error('Failed to load library');
        return res.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const searchGenre = useCallback(async (query: string, libOnly: boolean) => {
    if (!query.trim()) return;
    setGenreLoading(true);
    setGenreError(null);
    setGenreResults(null);

    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (libOnly) params.set('libraryOnly', 'true');
      const res = await fetch(`/api/search-recommendations?${params}`);
      if (!res.ok) throw new Error('Failed to get recommendations');
      const d = await res.json();
      setGenreResults(d);
    } catch (e) {
      setGenreError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setGenreLoading(false);
    }
  }, []);

  const handleGenreSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    searchGenre(genreQuery, genreLibraryOnly);
  }, [genreQuery, genreLibraryOnly, searchGenre]);

  const handleQuickGenre = useCallback((genre: string) => {
    setGenreQuery(genre);
    searchGenre(genre, genreLibraryOnly);
  }, [genreLibraryOnly, searchGenre]);

  const handleGenreModeToggle = useCallback((libOnly: boolean) => {
    setGenreLibraryOnly(libOnly);
    if (genreResults || genreQuery.trim()) {
      const q = genreResults?.query || genreQuery;
      searchGenre(q, libOnly);
    }
  }, [genreResults, genreQuery, searchGenre]);

  const clearGenreSearch = useCallback(() => {
    setGenreQuery('');
    setGenreResults(null);
    setGenreError(null);
  }, []);

  const filteredGames = useMemo(() => {
    if (!data) return [];
    let games = [...data.games];
    
    if (!showUnplayed) {
      games = games.filter(g => g.playtime_forever > 0);
    }
    
    if (search) {
      const q = search.toLowerCase();
      games = games.filter(g => g.name.toLowerCase().includes(q));
    }
    
    switch (sortBy) {
      case 'name':
        games.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        games.sort((a, b) => (b.rtime_last_played || 0) - (a.rtime_last_played || 0));
        break;
      default:
        games.sort((a, b) => b.playtime_forever - a.playtime_forever);
    }
    
    return games;
  }, [data, search, sortBy, showUnplayed]);

  if (loading) return <LibrarySkeleton />;
  if (error) return (
    <div className="max-w-4xl mx-auto p-8 text-center">
      <p className="text-red-400 text-lg">{error}</p>
      <a href="/" className="btn-blue inline-block mt-4">Go Home</a>
    </div>
  );
  if (!data) return null;

  const playedCount = data.games.filter(g => g.playtime_forever > 0).length;
  const showingGenreResults = genreResults || genreLoading || genreError;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {data.avatar && (
            <img src={data.avatar} alt="Avatar" className="w-20 h-20 rounded-full border-2 border-steam-blue" />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">{data.displayName}&apos;s Library</h1>
            <div className="flex flex-wrap gap-6 mt-3">
              <Stat label="Total Games" value={data.totalGames.toString()} />
              <Stat label="Played" value={`${playedCount} (${Math.round(playedCount/data.totalGames*100)}%)`} />
              <Stat label="Total Playtime" value={formatPlaytime(data.totalPlaytime)} />
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/recommendations" className="btn-steam flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Get Recommendations
            </Link>
            <a href="/api/auth/logout" className="px-4 py-3 rounded text-steam-text-secondary hover:text-white hover:bg-[#2a3f5f]/50 transition-colors">
              Sign Out
            </a>
          </div>
        </div>
      </div>

      {/* Genre / Vibe Search */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-6 h-6 text-steam-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <h2 className="text-lg font-semibold text-white">What are you in the mood for?</h2>
        </div>

        <form onSubmit={handleGenreSubmit} className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-steam-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search by genre, tag, or vibe... (e.g. &quot;roguelite&quot;, &quot;cozy farming&quot;, &quot;like Dark Souls but easier&quot;)"
              value={genreQuery}
              onChange={e => setGenreQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#0a0f16] border border-[#2a3f5f]/50 rounded-lg text-white placeholder-steam-text-secondary focus:outline-none focus:border-steam-blue transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={genreLoading || !genreQuery.trim()}
            className="btn-blue flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            {genreLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            )}
            Search
          </button>
        </form>

        {/* Quick-pick genre pills */}
        <div className="flex flex-wrap gap-2">
          {QUICK_GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => handleQuickGenre(genre)}
              disabled={genreLoading}
              className={`text-sm px-4 py-1.5 rounded-full border transition-all duration-200 font-medium disabled:opacity-50
                ${genreResults?.query === genre
                  ? 'border-steam-blue bg-steam-blue/20 text-steam-blue'
                  : 'border-[#2a3f5f]/50 text-steam-text-secondary hover:border-steam-blue/50 hover:text-white hover:bg-[#2a3f5f]/30'
                }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Genre Search Results */}
      {showingGenreResults && (
        <div className="mb-8">
          {/* Results header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              {genreResults && (
                <h2 className="text-2xl font-bold text-white">
                  {genreResults.libraryOnly ? `${genreResults.query} games in your library` : `${genreResults.query} games for you`}
                </h2>
              )}
              {genreLoading && (
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <svg className="w-6 h-6 text-steam-blue animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Searching...
                </h2>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Discover New / In My Library toggle */}
              <div className="flex rounded-lg overflow-hidden border border-[#2a3f5f]/50 text-sm font-medium">
                <button
                  onClick={() => handleGenreModeToggle(false)}
                  className={`px-4 py-2 transition-colors ${
                    !genreLibraryOnly
                      ? 'bg-steam-blue text-white'
                      : 'bg-[#1e2837] text-steam-text-secondary hover:text-white'
                  }`}
                  disabled={genreLoading}
                >
                  Discover New
                </button>
                <button
                  onClick={() => handleGenreModeToggle(true)}
                  className={`px-4 py-2 transition-colors ${
                    genreLibraryOnly
                      ? 'bg-steam-blue text-white'
                      : 'bg-[#1e2837] text-steam-text-secondary hover:text-white'
                  }`}
                  disabled={genreLoading}
                >
                  In My Library
                </button>
              </div>
              <button
                onClick={clearGenreSearch}
                className="text-sm text-steam-text-secondary hover:text-white transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            </div>
          </div>

          {/* Loading state */}
          {genreLoading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card flex flex-col sm:flex-row overflow-hidden">
                  <div className="sm:w-72 flex-shrink-0">
                    <div className="aspect-[460/215] skeleton" />
                  </div>
                  <div className="flex-1 p-6 space-y-3">
                    <div className="h-6 w-2/3 skeleton rounded" />
                    <div className="h-4 w-full skeleton rounded" />
                    <div className="h-4 w-3/4 skeleton rounded" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 skeleton rounded-full" />
                      <div className="h-6 w-20 skeleton rounded-full" />
                      <div className="h-6 w-14 skeleton rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {genreError && (
            <div className="text-center py-12">
              <p className="text-red-400 text-lg mb-4">{genreError}</p>
              <button
                onClick={() => searchGenre(genreQuery || genreResults?.query || '', genreLibraryOnly)}
                className="btn-blue"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Results */}
          {genreResults && !genreLoading && (
            <div className="space-y-4">
              {genreResults.recommendations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-steam-text-secondary text-lg">
                    {genreResults.libraryOnly
                      ? `No "${genreResults.query}" games found in your library. Try "Discover New" instead!`
                      : `No recommendations found for "${genreResults.query}". Try a different search!`}
                  </p>
                </div>
              ) : (
                genreResults.recommendations.map((rec, i) => (
                  <GenreResultCard key={`${rec.name}-${i}`} rec={rec} index={i} isLibraryMode={genreResults.libraryOnly} />
                ))
              )}
            </div>
          )}

          {/* Divider between genre results and library */}
          <div className="mt-8 mb-4 border-t border-[#2a3f5f]/50" />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-steam-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Filter library games..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1e2837] border border-[#2a3f5f]/50 rounded-lg text-white placeholder-steam-text-secondary focus:outline-none focus:border-steam-blue transition-colors"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="px-4 py-3 bg-[#1e2837] border border-[#2a3f5f]/50 rounded-lg text-white focus:outline-none focus:border-steam-blue transition-colors cursor-pointer"
          >
            <option value="playtime">Sort by Playtime</option>
            <option value="name">Sort by Name</option>
            <option value="recent">Sort by Recently Played</option>
          </select>
          <button
            onClick={() => setShowUnplayed(!showUnplayed)}
            className={`px-4 py-3 rounded-lg border transition-colors ${
              showUnplayed 
                ? 'border-[#2a3f5f]/50 text-steam-text-secondary hover:text-white' 
                : 'border-steam-blue text-steam-blue'
            }`}
          >
            {showUnplayed ? 'Hide' : 'Show'} Unplayed
          </button>
        </div>
      </div>

      <p className="text-sm text-steam-text-secondary mb-4">
        Showing {filteredGames.length} of {data.totalGames} games
      </p>

      {/* Game Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGames.map(game => (
          <GameCard key={game.appid} game={game} onClick={() => setSelectedGame(game)} />
        ))}
      </div>

      {/* Game Detail Panel */}
      <GameDetailPanel game={selectedGame} onClose={handleClosePanel} />
    </div>
  );
}

function GenreResultCard({ rec, index, isLibraryMode }: { rec: GenreRec; index: number; isLibraryMode: boolean }) {
  const [imgError, setImgError] = useState(false);
  const { getStatus, setStatus } = useGameStatuses();

  return (
    <div className="card-hover flex flex-col sm:flex-row overflow-hidden">
      {/* Game Image */}
      <div className="sm:w-72 sm:flex-shrink-0">
        <div className="aspect-[460/215] sm:aspect-auto sm:h-full bg-[#0a0f16] relative">
          {rec.appid && !imgError ? (
            <img
              src={getGameHeaderImage(rec.appid)}
              alt={rec.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full min-h-[120px] flex items-center justify-center text-steam-text-secondary bg-gradient-to-br from-[#1e2837] to-[#0a0f16]">
              <div className="text-center p-4">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
                </svg>
                <span className="text-xs opacity-50">{rec.name}</span>
              </div>
            </div>
          )}
          {/* Rank badge */}
          <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-steam-dark/80 backdrop-blur-sm border border-steam-blue/50 flex items-center justify-center">
            <span className="text-sm font-bold text-steam-blue">#{index + 1}</span>
          </div>
          {/* Owned badge for library mode */}
          {isLibraryMode && (
            <div className="absolute top-3 right-3">
              <span className="text-[10px] bg-green-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full font-medium">
                Owned
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="text-xl font-bold text-white">{rec.name}</h3>
        </div>

        {/* Playtime for library games */}
        {isLibraryMode && rec.playtime_hours !== undefined && (
          <p className={`text-sm font-medium mb-2 ${
            rec.playtime_hours === 0
              ? 'text-yellow-400'
              : rec.playtime_hours < 3
                ? 'text-orange-400'
                : 'text-steam-text-secondary'
          }`}>
            {rec.playtime_hours === 0
              ? '✨ Never played — hidden gem!'
              : rec.playtime_hours < 3
                ? `⏱️ Only ${rec.playtime_hours}h played — give it another shot!`
                : `${rec.playtime_hours}h played`}
          </p>
        )}
        
        <p className="text-steam-text leading-relaxed mb-4">{rec.reason}</p>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {rec.tags.map(tag => (
            <span key={tag} className="text-xs bg-steam-blue/10 text-steam-blue px-3 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {rec.storeUrl && !isLibraryMode && (
            <a
              href={rec.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-steam-blue hover:text-steam-blue-hover transition-colors"
            >
              View on Steam
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
          {isLibraryMode && rec.appid && (
            <a
              href={`https://store.steampowered.com/app/${rec.appid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-steam-blue hover:text-steam-blue-hover transition-colors"
            >
              View on Steam
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
          {!isLibraryMode && rec.appid && (
            <StatusButtons
              appid={rec.appid}
              name={rec.name}
              currentStatus={getStatus(rec.appid)}
              onStatusChange={(appid, status) => setStatus(appid, status)}
              compact
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GameCard({ game, onClick }: { game: Game; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const { getStatus } = useGameStatuses();
  const status = getStatus(game.appid);
  
  return (
    <button
      onClick={onClick}
      className="card-hover group text-left w-full cursor-pointer"
    >
      <div className="relative aspect-[460/215] bg-[#0a0f16]">
        {!imgError ? (
          <img
            src={getGameHeaderImage(game.appid)}
            alt={game.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-steam-text-secondary">
            <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
            </svg>
          </div>
        )}
        {/* Status badge */}
        {status && (
          <div className="absolute top-2 left-2 z-10">
            <StatusBadge status={status} />
          </div>
        )}
        {game.playtime_2weeks && game.playtime_2weeks > 0 && (
          <div className="absolute top-2 right-2 bg-steam-blue/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium">
            Recent
          </div>
        )}
        {/* "Find Similar" hint on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium bg-steam-blue/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Find Similar
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-white text-sm leading-tight truncate group-hover:text-steam-blue-hover transition-colors">
          {game.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs font-medium ${game.playtime_forever > 0 ? 'text-steam-blue' : 'text-steam-text-secondary'}`}>
            {game.playtime_forever > 0 ? formatPlaytime(game.playtime_forever) : 'Never played'}
          </span>
          {game.playtime_2weeks && game.playtime_2weeks > 0 && (
            <span className="text-xs text-steam-text-secondary">
              {formatPlaytime(game.playtime_2weeks)} last 2 wks
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-steam-text-secondary">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full skeleton" />
          <div className="flex-1 space-y-3">
            <div className="h-8 w-64 skeleton rounded" />
            <div className="h-5 w-96 skeleton rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="card">
            <div className="aspect-[460/215] skeleton" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 skeleton rounded" />
              <div className="h-3 w-1/3 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
