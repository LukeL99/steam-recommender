import { getDb } from './db';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CachedUserProfile {
  steamId: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  lastSyncedAt: string;
}

export interface CachedUserGame {
  appId: number;
  playtimeForever: number;
  playtime2weeks: number;
  lastPlayedAt: number | null;
  syncedAt: string;
}

export interface CachedGameDetails {
  appId: number;
  name: string;
  type: string | null;
  shortDescription: string | null;
  headerImage: string | null;
  developers: string[] | null;
  publishers: string[] | null;
  metacriticScore: number | null;
  releaseDate: string | null;
  price: string | null;
  genres: string[];
  tags: { tag: string; rank: number }[];
  lastFetchedAt: string;
}

export interface CachedRecommendation {
  id: number;
  steamId: string;
  sourceAppId: number | null;
  recType: string;
  resultJson: string;
  createdAt: string;
  expiresAt: string;
}

// ─── User Profile Cache ─────────────────────────────────────────────────────

export function cacheUserProfile(
  steamId: string,
  profileData: {
    displayName: string;
    avatarUrl?: string | null;
    profileUrl?: string | null;
  }
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO user_profiles (steam_id, display_name, avatar_url, profile_url, last_synced_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(steam_id) DO UPDATE SET
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      profile_url = excluded.profile_url,
      last_synced_at = datetime('now')
  `).run(
    steamId,
    profileData.displayName,
    profileData.avatarUrl ?? null,
    profileData.profileUrl ?? null
  );
}

export function getCachedProfile(steamId: string): CachedUserProfile | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT steam_id, display_name, avatar_url, profile_url, last_synced_at
    FROM user_profiles
    WHERE steam_id = ?
      AND datetime(last_synced_at) > datetime('now', '-24 hours')
  `).get(steamId) as {
    steam_id: string;
    display_name: string;
    avatar_url: string | null;
    profile_url: string | null;
    last_synced_at: string;
  } | undefined;

  if (!row) return null;

  return {
    steamId: row.steam_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    profileUrl: row.profile_url,
    lastSyncedAt: row.last_synced_at,
  };
}

// ─── User Library Cache ─────────────────────────────────────────────────────

export function cacheUserLibrary(
  steamId: string,
  games: {
    appid: number;
    name: string;
    playtime_forever: number;
    playtime_2weeks?: number;
    rtime_last_played?: number;
  }[]
): void {
  const db = getDb();

  const upsertUserGame = db.prepare(`
    INSERT INTO user_games (steam_id, app_id, playtime_forever, playtime_2weeks, last_played_at, synced_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(steam_id, app_id) DO UPDATE SET
      playtime_forever = excluded.playtime_forever,
      playtime_2weeks = excluded.playtime_2weeks,
      last_played_at = excluded.last_played_at,
      synced_at = datetime('now')
  `);

  const upsertGameName = db.prepare(`
    INSERT INTO games (app_id, name, last_fetched_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(app_id) DO UPDATE SET
      name = CASE WHEN games.name = '' OR games.name IS NULL THEN excluded.name ELSE games.name END
  `);

  const transaction = db.transaction(() => {
    // Clear old entries for this user before re-inserting
    db.prepare('DELETE FROM user_games WHERE steam_id = ?').run(steamId);

    for (const game of games) {
      upsertUserGame.run(
        steamId,
        game.appid,
        game.playtime_forever,
        game.playtime_2weeks ?? 0,
        game.rtime_last_played ?? null
      );
      // Also ensure the game exists in the games table (at least with name)
      upsertGameName.run(game.appid, game.name);
    }
  });

  transaction();
}

export function getCachedLibrary(steamId: string): CachedUserGame[] | null {
  const db = getDb();

  // Check if we have a recent sync (within 5 minutes)
  const newest = db.prepare(`
    SELECT synced_at FROM user_games
    WHERE steam_id = ?
      AND datetime(synced_at) > datetime('now', '-5 minutes')
    LIMIT 1
  `).get(steamId) as { synced_at: string } | undefined;

  if (!newest) return null;

  const rows = db.prepare(`
    SELECT app_id, playtime_forever, playtime_2weeks, last_played_at, synced_at
    FROM user_games
    WHERE steam_id = ?
  `).all(steamId) as {
    app_id: number;
    playtime_forever: number;
    playtime_2weeks: number;
    last_played_at: number | null;
    synced_at: string;
  }[];

  return rows.map(row => ({
    appId: row.app_id,
    playtimeForever: row.playtime_forever,
    playtime2weeks: row.playtime_2weeks,
    lastPlayedAt: row.last_played_at,
    syncedAt: row.synced_at,
  }));
}

// ─── Game Details Cache ─────────────────────────────────────────────────────

export function cacheGameDetails(
  appId: number,
  details: {
    name: string;
    type?: string;
    short_description?: string;
    header_image?: string;
    developers?: string[];
    publishers?: string[];
    metacritic?: { score: number };
    release_date?: { coming_soon: boolean; date: string };
    price_overview?: { final_formatted: string };
    genres?: { id: string; description: string }[];
  },
  tags?: { tag: string; rank: number }[]
): void {
  const db = getDb();

  const transaction = db.transaction(() => {
    // Upsert game metadata
    db.prepare(`
      INSERT INTO games (app_id, name, type, short_description, header_image, developers, publishers, metacritic_score, release_date, price, last_fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(app_id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        short_description = excluded.short_description,
        header_image = excluded.header_image,
        developers = excluded.developers,
        publishers = excluded.publishers,
        metacritic_score = excluded.metacritic_score,
        release_date = excluded.release_date,
        price = excluded.price,
        last_fetched_at = datetime('now')
    `).run(
      appId,
      details.name,
      details.type ?? null,
      details.short_description ?? null,
      details.header_image ?? null,
      details.developers ? JSON.stringify(details.developers) : null,
      details.publishers ? JSON.stringify(details.publishers) : null,
      details.metacritic?.score ?? null,
      details.release_date?.date ?? null,
      details.price_overview?.final_formatted ?? null
    );

    // Replace genres
    db.prepare('DELETE FROM game_genres WHERE app_id = ?').run(appId);
    if (details.genres && details.genres.length > 0) {
      const insertGenre = db.prepare(
        'INSERT OR IGNORE INTO game_genres (app_id, genre) VALUES (?, ?)'
      );
      for (const genre of details.genres) {
        insertGenre.run(appId, genre.description);
      }
    }

    // Replace tags
    if (tags && tags.length > 0) {
      db.prepare('DELETE FROM game_tags WHERE app_id = ?').run(appId);
      const insertTag = db.prepare(
        'INSERT OR IGNORE INTO game_tags (app_id, tag, rank) VALUES (?, ?, ?)'
      );
      for (const t of tags) {
        insertTag.run(appId, t.tag, t.rank);
      }
    }
  });

  transaction();
}

export function getCachedGameDetails(appId: number): CachedGameDetails | null {
  const db = getDb();

  const row = db.prepare(`
    SELECT app_id, name, type, short_description, header_image, developers, publishers,
           metacritic_score, release_date, price, last_fetched_at
    FROM games
    WHERE app_id = ?
      AND datetime(last_fetched_at) > datetime('now', '-7 days')
  `).get(appId) as {
    app_id: number;
    name: string;
    type: string | null;
    short_description: string | null;
    header_image: string | null;
    developers: string | null;
    publishers: string | null;
    metacritic_score: number | null;
    release_date: string | null;
    price: string | null;
    last_fetched_at: string;
  } | undefined;

  if (!row) return null;

  const genres = db.prepare(
    'SELECT genre FROM game_genres WHERE app_id = ?'
  ).all(appId) as { genre: string }[];

  const tags = db.prepare(
    'SELECT tag, rank FROM game_tags WHERE app_id = ? ORDER BY rank ASC'
  ).all(appId) as { tag: string; rank: number }[];

  return {
    appId: row.app_id,
    name: row.name,
    type: row.type,
    shortDescription: row.short_description,
    headerImage: row.header_image,
    developers: row.developers ? JSON.parse(row.developers) : null,
    publishers: row.publishers ? JSON.parse(row.publishers) : null,
    metacriticScore: row.metacritic_score,
    releaseDate: row.release_date,
    price: row.price,
    genres: genres.map(g => g.genre),
    tags: tags.map(t => ({ tag: t.tag, rank: t.rank })),
    lastFetchedAt: row.last_fetched_at,
  };
}

// ─── Recommendation Cache ───────────────────────────────────────────────────

export function cacheRecommendation(
  steamId: string,
  sourceAppId: number | null,
  recType: 'similar' | 'library' | 'general',
  resultJson: string,
  ttlHours: number
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO recommendations (steam_id, source_app_id, rec_type, result_json, created_at, expires_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+' || ? || ' hours'))
  `).run(steamId, sourceAppId, recType, resultJson, ttlHours);
}

export function getCachedRecommendation(
  steamId: string,
  sourceAppId: number | null,
  recType: 'similar' | 'library' | 'general'
): CachedRecommendation | null {
  const db = getDb();

  // Get the most recent non-expired recommendation matching criteria
  const row = db.prepare(`
    SELECT id, steam_id, source_app_id, rec_type, result_json, created_at, expires_at
    FROM recommendations
    WHERE steam_id = ?
      AND (source_app_id IS ? OR (source_app_id = ? AND ? IS NOT NULL))
      AND rec_type = ?
      AND datetime(expires_at) > datetime('now')
    ORDER BY created_at DESC
    LIMIT 1
  `).get(steamId, sourceAppId, sourceAppId, sourceAppId, recType) as {
    id: number;
    steam_id: string;
    source_app_id: number | null;
    rec_type: string;
    result_json: string;
    created_at: string;
    expires_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    steamId: row.steam_id,
    sourceAppId: row.source_app_id,
    recType: row.rec_type,
    resultJson: row.result_json,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

// ─── Cache Invalidation ─────────────────────────────────────────────────────

export function invalidateUserCache(steamId: string): void {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM user_games WHERE steam_id = ?').run(steamId);
    db.prepare('DELETE FROM user_profiles WHERE steam_id = ?').run(steamId);
  });
  transaction();
}

// ─── Recommendation Feedback ────────────────────────────────────────────────

export function recordRecommendationFeedback(
  steamId: string,
  recommendedAppId: number,
  action: 'saved' | 'dismissed' | 'clicked'
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO recommendation_feedback (steam_id, recommended_app_id, action, created_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(steam_id, recommended_app_id) DO UPDATE SET
      action = excluded.action,
      created_at = datetime('now')
  `).run(steamId, recommendedAppId, action);
}

export function getDismissedAppIds(steamId: string): number[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT recommended_app_id FROM recommendation_feedback
    WHERE steam_id = ? AND action = 'dismissed'
  `).all(steamId) as { recommended_app_id: number }[];
  return rows.map(r => r.recommended_app_id);
}

export function getGameTagsFromCache(appId: number): { tag: string; rank: number }[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT tag, rank FROM game_tags WHERE app_id = ? ORDER BY rank ASC'
  ).all(appId) as { tag: string; rank: number }[];
  return rows;
}
