import { GoogleGenerativeAI } from '@google/generative-ai';
import { SteamGame, SteamGameDetails } from './steam';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export interface Recommendation {
  name: string;
  appid?: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  tags: string[];
  storeUrl?: string;
}

export interface SimilarRecommendation {
  name: string;
  appid: number | null;
  reason: string;
  tags: string[];
  storeUrl?: string;
}

export async function getRecommendations(games: SteamGame[]): Promise<Recommendation[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Sort by playtime and take top games for context
  const topGames = [...games]
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 50)
    .map(g => ({
      name: g.name,
      appid: g.appid,
      playtime_hours: Math.round(g.playtime_forever / 60),
      recently_played: (g.playtime_2weeks || 0) > 0,
    }));

  const ownedAppIds = new Set(games.map(g => g.appid));
  const ownedNames = new Set(games.map(g => g.name.toLowerCase()));

  const prompt = `You are a Steam game recommendation engine. Analyze this user's game library (sorted by playtime) and recommend 10 games they would enjoy but DON'T already own.

USER'S TOP GAMES (by playtime):
${JSON.stringify(topGames, null, 2)}

TOTAL GAMES OWNED: ${games.length}

Instructions:
1. Identify patterns: genres, themes, mechanics, studios they prefer
2. Recommend 10 games they'd love but DON'T own (check against the list above!)
3. Mix well-known titles with hidden gems
4. For each recommendation, explain WHY based on their specific library
5. Include the Steam appid if you know it (look it up from memory)

Respond ONLY with a valid JSON array (no markdown, no code blocks) of objects with these fields:
- name: string (exact Steam store name)
- appid: number or null (Steam app ID if known)
- reason: string (2-3 sentences explaining why, referencing specific games they play)
- confidence: "high" | "medium" | "low"
- tags: string[] (3-5 genre/mechanic tags)`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  
  // Parse JSON - handle potential markdown code blocks
  let jsonStr = text;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  
  try {
    const recommendations: Recommendation[] = JSON.parse(jsonStr);
    
    // Filter out games the user already owns
    return recommendations
      .filter(r => {
        if (r.appid && ownedAppIds.has(r.appid)) return false;
        if (ownedNames.has(r.name.toLowerCase())) return false;
        return true;
      })
      .map(r => ({
        ...r,
        storeUrl: r.appid 
          ? `https://store.steampowered.com/app/${r.appid}` 
          : `https://store.steampowered.com/search/?term=${encodeURIComponent(r.name)}`,
      }));
  } catch (e) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Failed to parse recommendations');
  }
}

export async function getSimilarRecommendations(
  game: SteamGame,
  gameDetails: SteamGameDetails | null,
  ownedGames: SteamGame[]
): Promise<SimilarRecommendation[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const ownedAppIds = new Set(ownedGames.map(g => g.appid));
  const ownedNames = new Set(ownedGames.map(g => g.name.toLowerCase()));

  const gameInfo: Record<string, unknown> = {
    name: game.name,
    appid: game.appid,
    playtime_hours: Math.round(game.playtime_forever / 60),
  };

  if (gameDetails) {
    gameInfo.genres = gameDetails.genres?.map(g => g.description) || [];
    gameInfo.categories = gameDetails.categories?.map(c => c.description) || [];
    gameInfo.developers = gameDetails.developers || [];
    gameInfo.short_description = gameDetails.short_description || '';
  }

  const prompt = `You are a Steam game recommendation engine. A user wants games similar to a specific game they own.

GAME THEY WANT SIMILAR TO:
${JSON.stringify(gameInfo, null, 2)}

THE USER ALREADY OWNS THESE GAMES (do NOT recommend any of these):
${JSON.stringify(ownedGames.map(g => ({ name: g.name, appid: g.appid })).slice(0, 200), null, 2)}

Instructions:
1. Recommend 6 games that are SIMILAR to "${game.name}" in terms of genre, mechanics, themes, mood, and style
2. Do NOT recommend any game the user already owns (check the owned list!)
3. For each recommendation, explain specifically what makes it similar to "${game.name}"
4. Include the Steam appid if you know it
5. Mix popular titles with lesser-known gems

Respond ONLY with a valid JSON array (no markdown, no code blocks) of objects with these fields:
- name: string (exact Steam store name)
- appid: number or null (Steam app ID if known)
- reason: string (1-2 sentences explaining why it's similar to "${game.name}" specifically)
- tags: string[] (3-5 genre/mechanic tags)`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  let jsonStr = text;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const recommendations: SimilarRecommendation[] = JSON.parse(jsonStr);

    return recommendations
      .filter(r => {
        if (r.appid && ownedAppIds.has(r.appid)) return false;
        if (ownedNames.has(r.name.toLowerCase())) return false;
        return true;
      })
      .map(r => ({
        ...r,
        storeUrl: r.appid
          ? `https://store.steampowered.com/app/${r.appid}`
          : `https://store.steampowered.com/search/?term=${encodeURIComponent(r.name)}`,
      }));
  } catch (e) {
    console.error('Failed to parse Gemini similar response:', text);
    throw new Error('Failed to parse similar recommendations');
  }
}
