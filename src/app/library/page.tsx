'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { formatPlaytime, getGameHeaderImage } from '@/lib/steam';
import Link from 'next/link';
import GameDetailPanel from '@/components/GameDetailPanel';
import { GameStatusProvider, useGameStatuses } from '@/components/GameStatusContext';
import { StatusBadge } from '@/components/StatusButtons';

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

type SortKey = 'playtime' | 'name' | 'recent';

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

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-steam-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search games..."
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
