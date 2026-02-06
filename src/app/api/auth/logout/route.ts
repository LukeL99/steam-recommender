import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const REALM = process.env.NEXT_PUBLIC_URL || 'https://steam.lukelab.click';

export async function GET() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL('/', REALM));
}
