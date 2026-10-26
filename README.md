# Garmin Connect MCP

Ask your AI assistant about your Garmin data in plain language: sleep, recovery, HRV, runs, training load and trends.

> "How did I sleep and should I go easy today?" · "Compare my last three long runs." · "Is my resting heart rate trending up?"

Ten task-level tools on top of Garmin's official Personal API. Responses are trimmed to what matters (a night of sleep is about 500 characters, not 245,000), so answers are fast and cheap. Everything is read-only.

## Quick start

Requires Node.js 20 or newer.

1. Create a Personal API key at <https://connect.garmin.com/app/settings/personalApiToken>. Garmin shows it once.
2. Save it:

```bash
npx @ste5an/garmin-connect-mcp setup
```

The key is stored in `~/.config/garmin/connect-personal-api-key` (owner-only). The server exchanges it for a 24-hour access token on demand and caches the token in `~/.garmin-mcp/`.

3. Add the server to your client. `setup` prints the exact snippet; this is the typical form:

```bash
claude mcp add garmin -- npx -y @ste5an/garmin-connect-mcp
```

```json
{
  "mcpServers": {
    "garmin": { "command": "npx", "args": ["-y", "@ste5an/garmin-connect-mcp"] }
  }
}
```

Use the JSON form for Claude Desktop (`claude_desktop_config.json`) and Cursor (`.cursor/mcp.json`). Restart the client and ask away.

| Command | What it does |
|---|---|
| `setup` | Save your key and check that it works |
| `status` | Check that the saved key works |
| `config` | Print the client setup snippet |
| `logout` | Delete the cached access token (the key file is kept) |

Set `GARMIN_PERSONAL_API_KEY_FILE` to read the key from another path.

## Tools

| Tool | Answers |
|---|---|
| `daily_briefing` | A day in one call: steps, calories, heart rate, stress, Body Battery, hydration, sleep, HRV, workouts done. Start here. |
| `sleep` | Score, stages with ratings, bedtime, SpO2, respiration, sleep need. One night or a range with averages. |
| `recovery` | HRV status against the balanced range, resting HR, Body Battery, stress, sleep score. A day or a trend. |
| `activities` | Recent or date-ranged workouts with distance, duration, pace, average and max heart rate, time in each heart-rate zone, cadence, power, elevation, calories, training effect and load. Filter by type. |
| `activity` | One workout in depth: moving time, pace, heart rate, cadence, stride length, ground contact time, vertical oscillation, elevation, training effect, the structured workout it followed, per-km splits and detected intervals. |
| `trends` | Daily series with min/max/average for steps, sleep, HRV, resting HR, stress, Body Battery, SpO2, respiration, weight, intensity minutes. |
| `weekly_summary` | Per-week run kilometres, longest run and its share of the week, strength sessions, total time, load and week-over-week change. |
| `body` | Weigh-ins and body composition. |
| `profile` | Units, time zone, heart-rate zones, max/resting/threshold heart rate, fitness age. |
| `garmin_api` | Read-only escape hatch for any other Personal API path. Names, ids, emails and GPS coordinates are redacted unless `GARMIN_RAW_UNREDACTED=1`. |

Dates accept `YYYY-MM-DD`, `today` and `yesterday`. Ranges take `days`, or `from` and `to`.

Garmin's lap and workout-step data is not in the Personal API, so `activity` rebuilds splits and intervals from the per-second pace and heart-rate stream (an undocumented `details` endpoint). Per-km splits are exact. Intervals are detected from pace changes: warm-up, work reps, recoveries and cool-down, each with distance, time, pace and heart rate. Boundaries can be off by several seconds, and steady runs report no intervals. If Garmin removes that endpoint, these two sections disappear and everything else keeps working.

The Personal API does not offer official lap data, weather, training readiness, training status, VO2 max, race predictions, Garmin Coach plans, saved workouts, gear, devices, goals, personal records, blood pressure or any write access, so those are not available.

## Troubleshooting

- **"No Garmin Personal API key found"**: run `setup`, or create the key file by hand.
- **"Garmin rejected the Personal API key"**: the key expired (30 days to 1 year, your choice) or was deleted. Create a new one and run `setup`.
- **404 for a metric**: your device or account has no data for it. Other tools keep working.
- **429**: Garmin is rate limiting. Wait a minute.
- Access tokens last 24 hours and have no refresh token; the server fetches a new one automatically.

## Privacy

Everything runs on your machine. The server talks only to `personal.connectapi.garmin.com` and returns data to your AI client. The key and cached token are stored with owner-only permissions.

## Development

```bash
npm install
npm run typecheck && npm test
npm run build
node build/cli.js setup
```

Source layout: `src/garmin/` (key-to-token authentication, API client), `src/tools/` (one file per tool, shared summarizers in `summaries.ts`), `src/cli/` (setup and status commands), `src/server.ts` (MCP wiring).

## License and credits

MIT. Authentication and endpoints follow Garmin's [Personal API reference client](https://github.com/garmin/connect-personal-api-python). The project started from [Nicolasvegam/garmin-connect-mcp](https://github.com/Nicolasvegam/garmin-connect-mcp) (MIT) and was rewritten around task-level tools.

Not affiliated with Garmin.
