# MOFA Overseas Safety MCP Server

An [MCP](https://modelcontextprotocol.io) server for **Japan's Ministry of Foreign Affairs (MOFA) Overseas Safety Information open data** (外務省 海外安全情報オープンデータ). It lets Claude and other LLM clients answer questions like:

- "Is it safe to travel to Egypt right now? Which regions should I avoid?"
- "What did Japanese embassies warn about in the last 48 hours?"
- "Which countries currently have Level 4 (evacuation) advisories?"
- "Were there protests in Bangkok recently?"

The server fetches MOFA's public XML feeds, normalizes them to compact English-keyed JSON, adds English country names and code tables, and caches responses for 5 minutes, which matches how often MOFA updates the data.

> The source content (titles and bodies) is in **Japanese**. The server's instructions tell Claude to translate it for the user.

---

## Tools

| Tool | What it does | Upstream feed |
|---|---|---|
| `get_country_safety` | Full profile for one country: risk level (1–4) and affected regions, infectious-disease advisory, spot/wide-area alerts, recent notices. Optional sections: basic safety data (crime, visa/entry, customs, health, emergency contacts) and terrorism/kidnapping background. | `country/{code}A.xml` |
| `get_latest_alerts` | Everything published in about the last 48 hours, filterable by area, country, type and category. | `area/newarrivalA.xml` |
| `search_notices` | Search about one year of advisories and embassy notices by country, area, type, embassy, date range and keywords. | `area/00L.xml`, `country/{code}L.xml` |
| `get_notice_detail` | Full text of a single item by `keyCd`. | `mail/{keyCd}A.xml` |
| `list_travel_advisory_levels` | Every country with a current Risk / Infectious Disease advisory, ranked by highest level. | `area/00L.xml` |
| `search_countries` | Resolve English or Japanese names to MOFA 4-digit country codes. | built-in |
| `list_embassies` | Japanese embassies and consulates (公館コード), filterable by country. | built-in |
| `get_reference_codes` | Areas, info types, level definitions and endpoint patterns. | built-in |

There are also **resources** (`mofa://codes/areas`, `mofa://codes/countries`, `mofa://codes/info-types`, `mofa://codes/risk-levels`, `mofa://codes/embassies`) and **prompts** (`travel_safety_briefing`, `recent_alerts_digest`).

All tools are read-only. Tools that take a country accept a name (`"Thailand"`, `"タイ"`, `"UAE"`) or a 4-digit code (`"0066"`).

---

## Run locally

Requires Node.js 20.10+ (22 recommended).

```bash
npm install
npm run build
npm start                # HTTP server on http://localhost:3000/mcp
# or
npm run start:stdio      # stdio transport for local clients
```

Development:

```bash
npm run dev              # HTTP with auto-reload
npm run smoke            # calls every tool against live MOFA data
MCP_URL=http://localhost:3000/mcp npm run smoke   # same, but over HTTP
npx @modelcontextprotocol/inspector              # interactive testing UI
```

### Endpoints

| Path | Purpose |
|---|---|
| `POST /mcp` | MCP Streamable HTTP endpoint. It is stateless, so it scales horizontally without sticky sessions. |
| `GET /health` | Health check: status, cache stats and memory. |
| `GET /` | Server info. |

### Environment variables

See [`.env.example`](.env.example).

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port. Render sets this for you. |
| `MCP_AUTH_TOKEN` | *(empty)* | Optional shared secret. When it's set, clients must send `Authorization: Bearer <token>` or add `?token=<token>` to the URL. |
| `CACHE_TTL_SECONDS` | `300` | How long parsed feeds are cached. |
| `CACHE_MAX_ENTRIES` | `20` | LRU cache size. A parsed country file takes about 10 MB of heap. |
| `FETCH_TIMEOUT_MS` | `30000` | Upstream request timeout. |
| `MCP_TRANSPORT` | `http` | Set to `stdio` to use stdio (same as `--stdio`). |

---

## Deploy to Render

**Option A: Blueprint (one click)**

1. Push this repo to GitHub.
2. In Render, go to **New → Blueprint** and pick the repo. Render reads [`render.yaml`](render.yaml).
3. When prompted for `MCP_AUTH_TOKEN`, leave it empty for a public server or enter a secret.
4. Deploy. Your MCP URL is `https://<service-name>.onrender.com/mcp`.

**Option B: Manual Web Service**

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |
| Env | `NODE_VERSION=22` |

Note: Render's free plan sleeps after 15 minutes idle, so the first request after that takes about 30–60 seconds. Use the Starter plan if you want it always warm. Memory use stays around 150–300 MB with the default cache size.

---

## Connect to Claude

### claude.ai (web, desktop and mobile)

1. Go to **Settings → Connectors → Add custom connector**.
2. Name: `MOFA Overseas Safety`. URL: `https://<your-service>.onrender.com/mcp`. If you set `MCP_AUTH_TOKEN`, use `https://<your-service>.onrender.com/mcp?token=<token>`.
3. Enable the connector in a chat from the tools menu.
4. Optional: create a **Project** and paste the instructions from [`docs/CLAUDE_INSTRUCTIONS.md`](docs/CLAUDE_INSTRUCTIONS.md) into its project instructions.

### Claude Code

```bash
claude mcp add --transport http mofa-safety https://<your-service>.onrender.com/mcp
# with auth:
claude mcp add --transport http mofa-safety https://<your-service>.onrender.com/mcp --header "Authorization: Bearer <token>"
```

### Claude Desktop (local, stdio)

Build first (`npm run build`), then add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mofa-safety": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-egov-foreign-safety-information/dist/index.js", "--stdio"]
    }
  }
}
```

### Claude API

Use the [MCP connector](https://docs.claude.com/en/docs/agents-and-tools/mcp-connector) with `url: "https://<your-service>.onrender.com/mcp"` (and `authorization_token` if you set one), and use the prompt in [`docs/CLAUDE_INSTRUCTIONS.md`](docs/CLAUDE_INSTRUCTIONS.md) as the `system` prompt.

---

## Instructions for the LLM

- **Automatic:** the server sends usage instructions in its `initialize` response ([`src/instructions.ts`](src/instructions.ts)). They cover data language, content types, advisory levels, which tool to use when, and answer guidelines.
- **Recommended system / Project prompt:** [`docs/CLAUDE_INSTRUCTIONS.md`](docs/CLAUDE_INSTRUCTIONS.md).

---

## About the data

Source: [外務省 海外安全情報オープンデータ](https://www.ezairyu.mofa.go.jp/html/opendata/) (usage manual v1.2). Code lists come from the official `area.xlsx`, `country.xlsx`, `infotype.xlsx` and `koukan.xlsx`.

**Content types (`infoType`)**

| Code | English | Japanese |
|---|---|---|
| T40 | Risk Information (travel advisory, Levels 1–4) | 危険情報 |
| T81 | Infectious Disease Risk Information | 感染症危険情報 |
| C30 / C31 | Spot Information (/ infectious disease) | スポット情報 |
| C50 / C51 | Wide-area Information (/ infectious disease) | 広域情報 |
| R10 / R20 | Embassy/Consulate notice, general / emergency | 領事メール(一般/緊急) |

**Areas:** 10 Asia · 20 Oceania · 30 North America · 33 Central & South America · 42 Europe (incl. Russia, Caucasus, Central Asia) · 50 Middle East · 60 Africa · `00` = all

**Levels:** 1 Exercise caution · 2 Avoid non-essential travel · 3 Avoid all travel · 4 Evacuate

**Quirks the server handles**

- Unknown codes return an HTML "sorry" page with HTTP **200** instead of a 404. The server detects this and returns a not-found error.
- Risk-level flags are `0`/`1` in the live data, though the spec says `Y`/`N`. Both are accepted.
- In the all-areas feed, some embassy notices have no `area`/`country` tags. The server infers them from the embassy code.
- Per-area feeds repeat items (the Asia light feed is about 21 MB, versus about 7 MB for the deduplicated all-areas feed). The server searches the all-areas feed and filters it in memory.
- Timestamps are JST. The server converts them to ISO 8601 with `+09:00`.

This project is not affiliated with MOFA. The content is the Japanese government's guidance for Japanese nationals. Always check official sources and your own government's travel advisories.

## Project layout

```
src/
  index.ts          entry point: HTTP (Express, Streamable HTTP) or stdio
  server.ts         MCP tools, resources, prompts
  instructions.ts   instructions sent to the LLM on initialize
  client.ts         upstream fetch, XML parsing, LRU cache
  normalize.ts      XML → compact English JSON
  codes.ts          areas, countries (EN/JA), info types, levels, embassies
  data/embassies.json
scripts/smoke.ts    end-to-end test against live data
docs/CLAUDE_INSTRUCTIONS.md
render.yaml         Render Blueprint
```
