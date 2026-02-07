import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOwnedGames, getGameDetails, getGameTags } from '@/lib/steam';
import { getSimilarRecommendations, getLibrarySimilarRecommendations } from '@/lib/gemini';
import { getStatusSummaryForPrompt } from '@/lib/gameStatus';
import {
  getCachedRecommendation,
  cacheRecommendation,
  cacheGameDetails,
  getCachedGameDetails,
  getDismissedAppIds,
  getGameTagsFromCache,
} from '@/lib/cache';

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const appid = request.nextUrl.searchParams.get('appid');
  if (!appid) {
    return NextResponse.json({ error: 'Missing appid parameter' }, { status: 400 });
  }

  const appidNum = Number(appid);
  const libraryOnly = request.nextUrl.searchParams.get('libraryOnly') === 'true';
  const recType = libraryOnly ? 'library' : 'similar';

  try {
    // Check recommendation cache
    const cachedRec = getCachedRecommendation(session.steamId, appidNum, recType as 'similar' | 'library');
    if (cachedRec) {
      const parsed = JSON.parse(cachedRec.resultJson);
      return NextResponse.json(parsed);
    }

    const [games, gameDetails] = await Promise.all([
      getOwnedGames(session.steamId),
      getGameDetailsWithCache(appidNum),
    ]);

    const ownedGame = games.find(g => g.appid === appidNum);
    if (!ownedGame) {
      return NextResponse.json({ error: 'Game not found in library' }, { status: 404 });
    }

    const statusCtx = getStatusSummaryForPrompt(session.steamId);

    // Get dismissed games to include in prompt context
    const dismissedIds = getDismissedAppIds(session.steamId);

    // Get tags for this game (from cache or SteamSpy)
    let gameTags = getGameTagsFromCache(appidNum);
    if (gameTags.length === 0) {
      gameTags = await getGameTags(appidNum);
    }

    // Add dismissed games to notInterested for prompt purposes
    const enhancedStatusCtx = {
      ...statusCtx,
      notInterested: [
        ...statusCtx.notInterested,
        ...dismissedIds
          .filter(id => !statusCtx.notInterested.some(g => g.appid === id))
          .map(id => ({ name: `AppID:${id}`, appid: id })),
      ],
    };

    if (libraryOnly) {
      const recommendations = await getLibrarySimilarRecommendations(ownedGame, gameDetails, games, enhancedStatusCtx);
      const response = {
        game: {
          appid: ownedGame.appid,
          name: ownedGame.name,
          playtime_forever: ownedGame.playtime_forever,
          genres: gameDetails?.genres?.map(g => g.description) || [],
          categories: gameDetails?.categories?.map(c => c.description) || [],
          developers: gameDetails?.developers || [],
          short_description: gameDetails?.short_description || '',
          release_date: gameDetails?.release_date?.date || '',
          metacritic: gameDetails?.metacritic?.score || null,
          tags: gameTags.map(t => t.tag),
        },
        recommendations,
        libraryOnly: true,
      };

      // Cache for 24h
      cacheRecommendation(session.steamId, appidNum, 'library', JSON.stringify(response), 24);

      return NextResponse.json(response);
    }

    const recommendations = await getSimilarRecommendations(ownedGame, gameDetails, games, enhancedStatusCtx);
    const response = {
      game: {
        appid: ownedGame.appid,
        name: ownedGame.name,
        playtime_forever: ownedGame.playtime_forever,
        genres: gameDetails?.genres?.map(g => g.description) || [],
        categories: gameDetails?.categories?.map(c => c.description) || [],
        developers: gameDetails?.developers || [],
        short_description: gameDetails?.short_description || '',
        release_date: gameDetails?.release_date?.date || '',
        metacritic: gameDetails?.metacritic?.score || null,
        tags: gameTags.map(t => t.tag),
      },
      recommendations,
      libraryOnly: false,
    };

    // Cache for 24h
    cacheRecommendation(session.steamId, appidNum, 'similar', JSON.stringify(response), 24);

    return NextResponse.json(response);
  } catch (e) {
    console.error('Failed to get similar recommendations:', e);
    return NextResponse.json(
      { error: 'Failed to generate similar recommendations' },
      { status: 500 }
    );
  }
}

async function getGameDetailsWithCache(appid: number) {
  // Check cache first
  const cached = getCachedGameDetails(appid);
  if (cached) {
    // Reconstruct the SteamGameDetails shape from cached data
    return {
      appid: cached.appId,
      name: cached.name,
      type: cached.type || '',
      short_description: cached.shortDescription || '',
      header_image: cached.headerImage || '',
      genres: cached.genres.map((g, i) => ({ id: String(i), description: g })),
      developers: cached.developers || undefined,
      publishers: cached.publishers || undefined,
      metacritic: cached.metacriticScore ? { score: cached.metacriticScore } : undefined,
      release_date: cached.releaseDate ? { coming_soon: false, date: cached.releaseDate } : undefined,
    };
  }

  // Fetch from Steam API
  const { getGameDetails } = await import('@/lib/steam');
  const details = await getGameDetails(appid);

  if (details) {
    // Fetch tags in parallel (non-blocking)
    getGameTags(appid).then(tags => {
      cacheGameDetails(appid, details, tags);
    }).catch(() => {
      // Cache without tags if SteamSpy fails
      cacheGameDetails(appid, details);
    });
  }

  return details;
}

export const maxDuration = 30;
