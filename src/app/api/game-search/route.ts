import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

interface SteamSearchResult {
  appid: number;
  name: string;
  icon: string;
  logo: string;
}

/** GET /api/game-search?q=... — search Steam store for games */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Use Steam's store search suggest API
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    const items: SteamSearchResult[] = (data.items || []).slice(0, 10).map(
      (item: { id: number; name: string; tiny_image: string; logo: string }) => ({
        appid: item.id,
        name: item.name,
        icon: item.tiny_image || '',
        logo: item.logo || '',
      })
    );

    return NextResponse.json({ results: items });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
