// TODO: This module uses file-based JSON storage which won't persist on ephemeral
// filesystems (e.g., AWS Amplify, serverless). Migrate to a database backend
// (DynamoDB or similar) for reliable persistence across deployments and instances.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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

interface StatusStore {
  [steamId: string]: UserStatuses;
}

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const STATUS_FILE = join(DATA_DIR, 'game-statuses.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): StatusStore {
  ensureDataDir();
  if (!existsSync(STATUS_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(STATUS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeStore(store: StatusStore) {
  ensureDataDir();
  writeFileSync(STATUS_FILE, JSON.stringify(store, null, 2));
}

export function getUserStatuses(steamId: string): UserStatuses {
  const store = readStore();
  return store[steamId] || {};
}

export function setGameStatus(
  steamId: string,
  appid: number,
  name: string,
  status: GameStatusType
): GameStatusEntry {
  const store = readStore();
  if (!store[steamId]) store[steamId] = {};

  const key = String(appid);
  const entry: GameStatusEntry = {
    appid,
    name,
    status,
    updatedAt: new Date().toISOString(),
  };

  store[steamId][key] = entry;
  writeStore(store);
  return entry;
}

export function removeGameStatus(steamId: string, appid: number): boolean {
  const store = readStore();
  if (!store[steamId]) return false;

  const key = String(appid);
  if (!store[steamId][key]) return false;

  delete store[steamId][key];
  writeStore(store);
  return true;
}

export function getGamesByStatus(steamId: string, status: GameStatusType): GameStatusEntry[] {
  const statuses = getUserStatuses(steamId);
  return Object.values(statuses).filter(s => s.status === status);
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
