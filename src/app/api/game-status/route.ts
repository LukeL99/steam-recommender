import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getUserStatuses,
  setGameStatus,
  removeGameStatus,
  GameStatusType,
} from '@/lib/gameStatus';

const VALID_STATUSES: GameStatusType[] = ['played', 'liked', 'not_interested'];

/** GET /api/game-status — get all statuses for current user */
export async function GET() {
  const session = await getSession();
  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const statuses = getUserStatuses(session.steamId);
  return NextResponse.json({ statuses });
}

/** POST /api/game-status — set a game's status */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { appid, name, status } = body;

    if (!appid || !name || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: appid, name, status' },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const entry = setGameStatus(session.steamId, Number(appid), name, status);
    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

/** DELETE /api/game-status — remove a game's status */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.steamId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const appid = request.nextUrl.searchParams.get('appid');
  if (!appid) {
    return NextResponse.json({ error: 'Missing appid parameter' }, { status: 400 });
  }

  const removed = removeGameStatus(session.steamId, Number(appid));
  return NextResponse.json({ removed });
}
