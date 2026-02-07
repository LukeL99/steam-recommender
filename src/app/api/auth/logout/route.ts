import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_URL) return process.env.NEXT_PUBLIC_URL;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL('/', baseUrl));
}
