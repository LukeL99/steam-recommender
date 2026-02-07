import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPlayerSummary } from '@/lib/steam';
import { cacheUserProfile } from '@/lib/cache';

function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_URL) return process.env.NEXT_PUBLIC_URL;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  const searchParams = request.nextUrl.searchParams;

  // Verify the OpenID response with Steam
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    params.set(key, value);
  });
  params.set('openid.mode', 'check_authentication');

  const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const verifyBody = await verifyRes.text();

  if (!verifyBody.includes('is_valid:true')) {
    return NextResponse.redirect(new URL('/?error=auth_failed', baseUrl));
  }

  // Extract Steam ID from claimed_id
  const claimedId = searchParams.get('openid.claimed_id');
  const steamIdMatch = claimedId?.match(/\/id\/(\d+)$/) || claimedId?.match(/(\d+)$/);
  
  if (!steamIdMatch) {
    return NextResponse.redirect(new URL('/?error=no_steamid', baseUrl));
  }

  const steamId = steamIdMatch[1];

  // Get player info
  try {
    const player = await getPlayerSummary(steamId);
    
    const session = await getSession();
    session.steamId = steamId;
    session.displayName = player?.personaname || 'Steam User';
    session.avatar = player?.avatarfull || player?.avatar || '';
    await session.save();

    // Cache the user profile in SQLite
    cacheUserProfile(steamId, {
      displayName: player?.personaname || 'Steam User',
      avatarUrl: player?.avatarfull || player?.avatar || null,
      profileUrl: player?.profileurl || null,
    });
  } catch (e) {
    console.error('Failed to get player summary:', e);
    const session = await getSession();
    session.steamId = steamId;
    session.displayName = 'Steam User';
    session.avatar = '';
    await session.save();
  }

  return NextResponse.redirect(new URL('/library', baseUrl));
}
