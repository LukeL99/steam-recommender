'use client';

import { useState, useEffect } from 'react';
import { getGameHeaderImage } from '@/lib/steam';
import Link from 'next/link';

interface Recommendation {
  name: string;
  appid?: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  tags: string[];
  storeUrl?: string;
}

interface RecData {
  recommendations: Recommendation[];
  basedOnGames: number;
}

export default function RecommendationsPage() {
  const [data, setData] = useState<RecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recommendations')
      .then(res => {
        if (res.status === 401) {
          window.location.href = '/';
          return null;
        }
        if (!res.ok) throw new Error('Failed to get recommendations');
        return res.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => {
    setLoading(true);
    setError(null);
    setData(null);
    fetch('/api/recommendations')
      .then(res => {
        if (!res.ok) throw new Error('Failed to get recommendations');
        return res.json();
      })
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/library" className="text-steam-text-secondary hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-white">AI Recommendations</h1>
          </div>
          {data && (
            <p className="text-steam-text-secondary">
              Based on analysis of your {data.basedOnGames} games
            </p>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="btn-blue flex items-center gap-2 disabled:opacity-50"
        >
          <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          {loading ? 'Analyzing...' : 'Regenerate'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-steam-blue/10 mb-6">
            <svg className="w-10 h-10 text-steam-blue animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Analyzing Your Library...</h2>
          <p className="text-steam-text-secondary max-w-md mx-auto">
            Gemini AI is studying your gaming patterns to find perfect matches. This usually takes 5-10 seconds.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-20">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button onClick={refresh} className="btn-blue">Try Again</button>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-6">
          {data.recommendations.map((rec, i) => (
            <RecommendationCard key={`${rec.name}-${i}`} rec={rec} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const [imgError, setImgError] = useState(false);
  
  const confidenceColors = {
    high: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-xl font-bold text-white">{rec.name}</h3>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${confidenceColors[rec.confidence]}`}>
            {rec.confidence} match
          </span>
        </div>
        
        <p className="text-steam-text leading-relaxed mb-4">{rec.reason}</p>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {rec.tags.map(tag => (
            <span key={tag} className="text-xs bg-steam-blue/10 text-steam-blue px-3 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        {rec.storeUrl && (
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
      </div>
    </div>
  );
}
