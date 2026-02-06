import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOwnedGames } from '@/lib/steam';
import { getRecommendations } from '@/lib/gemini';
import { getStatusSummaryForPrompt } from '@/lib/gameStatus';

export async function GET() {
  const session = await getSession();
  
  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const games = await getOwnedGames(session.steamId);
    
    if (games.length === 0) {
      return NextResponse.json({ error: 'No games found in library' }, { status: 404 });
    }

    const statusCtx = getStatusSummaryForPrompt(session.steamId);
    const recommendations = await getRecommendations(games, statusCtx);
    
    return NextResponse.json({
      recommendations,
      basedOnGames: games.length,
    });
  } catch (e) {
    console.error('Failed to get recommendations:', e);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

export const maxDuration = 30;
