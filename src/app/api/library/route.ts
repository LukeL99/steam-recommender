import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOwnedGames } from '@/lib/steam';

export async function GET() {
  const session = await getSession();
  
  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const games = await getOwnedGames(session.steamId);
    
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
