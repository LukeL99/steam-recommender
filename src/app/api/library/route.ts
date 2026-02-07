import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOwnedGames } from '@/lib/steam';
import { cacheUserLibrary, getCachedLibrary } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  try {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedLibrary(session.steamId);
      if (cached) {
        // We need game names from the games table or from Steam API
        // For cached responses, re-fetch from Steam to get full game info
        // (The cache here primarily saves the Steam API call when within TTL)
        // Since cached user_games doesn't store name/icon, we still need the full data
        // Let's fetch from Steam but cache the result
      }
    }

    const games = await getOwnedGames(session.steamId);

    // Cache the library data
    cacheUserLibrary(session.steamId, games);
    
    // Sort by playtime by default
    games.sort((a, b) => b.playtime_forever - a.playtime_forever);
    
    return NextResponse.json({
      steamId: session.steamId,
      displayName: session.displayName,
      avatar: session.avatar,
      totalGames: games.length,
      totalPlaytime: games.reduce((sum, g) => sum + g.playtime_forever, 0),
      games,
    });
  } catch (e) {
    console.error('Failed to fetch library:', e);
    return NextResponse.json({ error: 'Failed to fetch Steam library' }, { status: 500 });
  }
}
