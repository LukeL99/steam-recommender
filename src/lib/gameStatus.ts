import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';

export type GameStatusType = 'played' | 'liked' | 'not_interested';

export interface GameStatusEntry {
  appid: number;
  name: string;
  status: GameStatusType;
  updatedAt: string;
}

export interface UserStatuses {
  [appidOrName: string]: GameStatusEntry;
}

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'game-statuses.db');
const LEGACY_JSON_PATH = join(DATA_DIR, 'game-statuses.json');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS game_statuses (
      steam_id TEXT NOT NULL,
      app_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('played', 'liked', 'not_interested')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (steam_id, app_id)
    );
  `);

  // Migrate legacy JSON data if it exists
  migrateFromJson();

  return db;
}

function migrateFromJson(): void {
  if (!existsSync(LEGACY_JSON_PATH)) return;

  try {
    const raw = readFileSync(LEGACY_JSON_PATH, 'utf-8');
    const store: Record<string, Record<string, { appid: number; name: string; status: string; updatedAt: string }>> = JSON.parse(raw);

    const insert = getDb().prepare(`
      INSERT OR REPLACE INTO game_statuses (steam_id, app_id, name, status, updated_at)
      VALUES (@steamId, @appId, @name, @status, @updatedAt)
    `);

    const migrate = getDb().transaction(() => {
      for (const [steamId, statuses] of Object.entries(store)) {
        for (const entry of Object.values(statuses)) {
          insert.run({
            steamId,
            appId: entry.appid,
            name: entry.name,
            status: entry.status,
            updatedAt: entry.updatedAt || new Date().toISOString(),
          });
        }
      }
    });

    migrate();
    renameSync(LEGACY_JSON_PATH, LEGACY_JSON_PATH + '.bak');
  } catch {
    // If migration fails, continue — the JSON file stays as-is for manual recovery
  }
}

export function getUserStatuses(steamId: string): UserStatuses {
  const rows = getDb().prepare(
    'SELECT app_id, name, status, updated_at FROM game_statuses WHERE steam_id = ?'
  ).all(steamId) as { app_id: number; name: string; status: GameStatusType; updated_at: string }[];

  const result: UserStatuses = {};
  for (const row of rows) {
    result[String(row.app_id)] = {
      appid: row.app_id,
      name: row.name,
      status: row.status,
      updatedAt: row.updated_at,
    };
  }
  return result;
}

export function setGameStatus(
  steamId: string,
  appid: number,
  name: string,
  status: GameStatusType
): GameStatusEntry {
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO game_statuses (steam_id, app_id, name, status, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(steam_id, app_id) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run(steamId, appid, name, status, now);

  return { appid, name, status, updatedAt: now };
}

export function removeGameStatus(steamId: string, appid: number): boolean {
  const result = getDb().prepare(
    'DELETE FROM game_statuses WHERE steam_id = ? AND app_id = ?'
  ).run(steamId, appid);

  return result.changes > 0;
}

export function getGamesByStatus(steamId: string, status: GameStatusType): GameStatusEntry[] {
  const rows = getDb().prepare(
    'SELECT app_id, name, status, updated_at FROM game_statuses WHERE steam_id = ? AND status = ?'
  ).all(steamId, status) as { app_id: number; name: string; status: GameStatusType; updated_at: string }[];

  return rows.map(row => ({
    appid: row.app_id,
    name: row.name,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

/** Get a summary object suitable for passing to Gemini prompts */
export function getStatusSummaryForPrompt(steamId: string) {
  const statuses = getUserStatuses(steamId);
  const played: { name: string; appid: number }[] = [];
  const liked: { name: string; appid: number }[] = [];
  const notInterested: { name: string; appid: number }[] = [];

  for (const entry of Object.values(statuses)) {
    const item = { name: entry.name, appid: entry.appid };
    switch (entry.status) {
      case 'played':
        played.push(item);
        break;
      case 'liked':
        liked.push(item);
        break;
      case 'not_interested':
        notInterested.push(item);
        break;
    }
  }

  return { played, liked, notInterested };
}
