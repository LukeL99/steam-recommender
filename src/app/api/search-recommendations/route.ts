import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOwnedGames } from '@/lib/steam';
import { getGenreSearchRecommendations, getGenreLibraryRecommendations } from '@/lib/gemini';
import { getStatusSummaryForPrompt } from '@/lib/gameStatus';

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  const libraryOnly = request.nextUrl.searchParams.get('libraryOnly') === 'true';

  try {
    const games = await getOwnedGames(session.steamId);
    const statusCtx = getStatusSummaryForPrompt(session.steamId);

    if (libraryOnly) {
      const recommendations = await getGenreLibraryRecommendations(query.trim(), games, statusCtx);
      return NextResponse.json({
        query: query.trim(),
        recommendations,
        libraryOnly: true,
        totalGames: games.length,
      });
    }

    const recommendations = await getGenreSearchRecommendations(query.trim(), games, statusCtx);
    return NextResponse.json({
      query: query.trim(),
      recommendations,
      libraryOnly: false,
      totalGames: games.length,
    });
  } catch (e) {
    console.error('Failed to get genre search recommendations:', e);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

export const maxDuration = 30;
