const STEAM_API_KEY = process.env.STEAM_API_KEY || '';

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number; // minutes
  playtime_2weeks?: number;
  img_icon_url: string;
  has_community_visible_stats?: boolean;
  rtime_last_played?: number;
}

export interface SteamGameDetails {
  appid: number;
  name: string;
  type: string;
  short_description: string;
  header_image: string;
  genres?: { id: string; description: string }[];
  categories?: { id: number; description: string }[];
  developers?: string[];
  publishers?: string[];
  metacritic?: { score: number };
  release_date?: { coming_soon: boolean; date: string };
  price_overview?: { final_formatted: string };
}

export async function getOwnedGames(steamId: string): Promise<SteamGame[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;
  
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Steam API error: ${res.status}`);
  
  const data = await res.json();
  return data.response?.games || [];
}

export async function getPlayerSummary(steamId: string) {
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API error: ${res.status}`);
  
  const data = await res.json();
  return data.response?.players?.[0];
}

export async function getGameDetails(appid: number): Promise<SteamGameDetails | null> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    
    const data = await res.json();
    if (!data[appid]?.success) return null;
    
    return data[appid].data;
  } catch {
    return null;
  }
}

export function getGameHeaderImage(appid: number): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`;
}

export function getGameCapsuleImage(appid: number): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/capsule_231x87.jpg`;
}

export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours >= 100) return `${hours}h`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
