import { NextRequest, NextResponse } from 'next/server';

function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_URL) return process.env.NEXT_PUBLIC_URL;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${baseUrl}/api/auth/callback`,
    'openid.realm': baseUrl,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  return NextResponse.redirect(
    `https://steamcommunity.com/openid/login?${params.toString()}`
  );
}
