import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'game-statuses.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create all tables in one place
  db.exec(`
    -- Game statuses (original table)
    CREATE TABLE IF NOT EXISTS game_statuses (
      steam_id TEXT NOT NULL,
      app_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('played', 'liked', 'not_interested')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (steam_id, app_id)
    );

    -- Cache Steam profiles
    CREATE TABLE IF NOT EXISTS user_profiles (
      steam_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      profile_url TEXT,
      last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cache game metadata
    CREATE TABLE IF NOT EXISTS games (
      app_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      short_description TEXT,
      header_image TEXT,
      developers TEXT,
      publishers TEXT,
      metacritic_score INTEGER,
      release_date TEXT,
      price TEXT,
      last_fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Game genres (many-to-many)
    CREATE TABLE IF NOT EXISTS game_genres (
      app_id INTEGER NOT NULL,
      genre TEXT NOT NULL,
      PRIMARY KEY (app_id, genre),
      FOREIGN KEY (app_id) REFERENCES games(app_id) ON DELETE CASCADE
    );

    -- Community tags (many-to-many, ranked)
    CREATE TABLE IF NOT EXISTS game_tags (
      app_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      rank INTEGER DEFAULT 0,
      PRIMARY KEY (app_id, tag),
      FOREIGN KEY (app_id) REFERENCES games(app_id) ON DELETE CASCADE
    );

    -- User's library (cached from Steam)
    CREATE TABLE IF NOT EXISTS user_games (
      steam_id TEXT NOT NULL,
      app_id INTEGER NOT NULL,
      playtime_forever INTEGER DEFAULT 0,
      playtime_2weeks INTEGER DEFAULT 0,
      last_played_at INTEGER,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (steam_id, app_id)
    );

    -- Cache Gemini recommendations
    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      steam_id TEXT NOT NULL,
      source_app_id INTEGER,
      rec_type TEXT NOT NULL CHECK(rec_type IN ('similar', 'library', 'general')),
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- Track recommendation quality
    CREATE TABLE IF NOT EXISTS recommendation_feedback (
      steam_id TEXT NOT NULL,
      recommended_app_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('saved', 'dismissed', 'clicked')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (steam_id, recommended_app_id)
    );
  `);

  return db;
}
