import { existsSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';
import { getDb } from './db';

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
const LEGACY_JSON_PATH = join(DATA_DIR, 'game-statuses.json');

let migrated = false;

function ensureMigrated(): void {
  if (migrated) return;
  migrated = true;
  migrateFromJson();
}

function migrateFromJson(): void {
  if (!existsSync(LEGACY_JSON_PATH)) return;

  try {
    const raw = readFileSync(LEGACY_JSON_PATH, 'utf-8');
    const store: Record<string, Record<string, { appid: number; name: string; status: string; updatedAt: string }>> = JSON.parse(raw);

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO game_statuses (steam_id, app_id, name, status, updated_at)
      VALUES (@steamId, @appId, @name, @status, @updatedAt)
    `);

    const migrate = db.transaction(() => {
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
  ensureMigrated();
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
  ensureMigrated();
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
  ensureMigrated();
  const result = getDb().prepare(
    'DELETE FROM game_statuses WHERE steam_id = ? AND app_id = ?'
  ).run(steamId, appid);

  return result.changes > 0;
}

export function getGamesByStatus(steamId: string, status: GameStatusType): GameStatusEntry[] {
  ensureMigrated();
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
