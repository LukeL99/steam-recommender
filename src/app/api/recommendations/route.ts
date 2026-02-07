import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOwnedGames } from '@/lib/steam';
import { getRecommendations } from '@/lib/gemini';
import { getStatusSummaryForPrompt } from '@/lib/gameStatus';
import {
  getCachedRecommendation,
  cacheRecommendation,
  getDismissedAppIds,
} from '@/lib/cache';

export async function GET() {
  const session = await getSession();
  
  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Check recommendation cache (general recs: sourceAppId = null)
    const cachedRec = getCachedRecommendation(session.steamId, null, 'general');
    if (cachedRec) {
      const parsed = JSON.parse(cachedRec.resultJson);
      return NextResponse.json(parsed);
    }

    const games = await getOwnedGames(session.steamId);
    
    if (games.length === 0) {
      return NextResponse.json({ error: 'No games found in library' }, { status: 404 });
    }

    const statusCtx = getStatusSummaryForPrompt(session.steamId);

    // Get dismissed games to exclude
    const dismissedIds = getDismissedAppIds(session.steamId);
    const enhancedStatusCtx = {
      ...statusCtx,
      notInterested: [
        ...statusCtx.notInterested,
        ...dismissedIds
          .filter(id => !statusCtx.notInterested.some(g => g.appid === id))
          .map(id => ({ name: `AppID:${id}`, appid: id })),
      ],
    };

    const recommendations = await getRecommendations(games, enhancedStatusCtx);
    
    const response = {
      recommendations,
      basedOnGames: games.length,
    };

    // Cache for 12h
    cacheRecommendation(session.steamId, null, 'general', JSON.stringify(response), 12);

    return NextResponse.json(response);
  } catch (e) {
    console.error('Failed to get recommendations:', e);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

export const maxDuration = 30;
