import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  steamId?: string;
  displayName?: string;
  avatar?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_placeholder',
  cookieName: 'steam-recommender-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session;
}
