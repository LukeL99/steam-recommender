import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOwnedGames, getGameDetails } from '@/lib/steam';
import { getSimilarRecommendations } from '@/lib/gemini';

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const appid = request.nextUrl.searchParams.get('appid');
  if (!appid) {
    return NextResponse.json({ error: 'Missing appid parameter' }, { status: 400 });
  }

  try {
    const [games, gameDetails] = await Promise.all([
      getOwnedGames(session.steamId),
      getGameDetails(Number(appid)),
    ]);

    const ownedGame = games.find(g => g.appid === Number(appid));
    if (!ownedGame) {
      return NextResponse.json({ error: 'Game not found in library' }, { status: 404 });
    }

    const recommendations = await getSimilarRecommendations(ownedGame, gameDetails, games);

    return NextResponse.json({
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
      },
      recommendations,
    });
  } catch (e) {
    console.error('Failed to get similar recommendations:', e);
    return NextResponse.json(
      { error: 'Failed to generate similar recommendations' },
      { status: 500 }
    );
  }
}

export const maxDuration = 30;
