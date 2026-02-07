import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { invalidateUserCache } from '@/lib/cache';

export async function POST() {
  const session = await getSession();

  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    invalidateUserCache(session.steamId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Failed to invalidate cache:', e);
    return NextResponse.json({ error: 'Failed to refresh' }, { status: 500 });
  }
}
