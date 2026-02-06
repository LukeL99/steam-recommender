# Steam Game Recommender

AI-powered game recommendations based on your Steam library. Uses Gemini AI to analyze your playtime patterns and suggest games you'll love.

## Features

- **Steam Login** — Sign in via Steam OpenID 2.0
- **Library View** — Browse your complete game library with playtime stats
- **AI Recommendations** — Gemini-powered personalized game suggestions
- **Modern UI** — Steam-themed dark interface with game covers

## Setup

```bash
cp .env.example .env
# Fill in your API keys
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STEAM_API_KEY` | Steam Web API key |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `SESSION_SECRET` | Random 32+ char string for session encryption |
| `NEXT_PUBLIC_URL` | Public URL (e.g., `https://steam.lukelab.click`) |

## Deployment

Deployed via Docker to homelab with Traefik reverse proxy.

```bash
docker build -t steam-recommender .
docker run -p 3000:3000 --env-file .env steam-recommender
```
