# Garmin Connect MCP

Ask your AI assistant about your Garmin data in plain language: sleep, recovery, HRV, runs, training load and trends.

> "How did I sleep and should I go easy today?" · "Compare my last three long runs." · "Is my resting heart rate trending up?"

Twelve task-level tools on top of Garmin's official Personal API, plus an optional email login for your Garmin Coach plan. Responses are trimmed to what matters (a night of sleep is about 500 characters, not 245,000), so answers are fast and cheap. Everything is read-only.

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
| `login` | Optional: sign in with email and password (and MFA code) to unlock `coach_plan` |
| `status` | Check that the saved key and the optional login work |
| `config` | Print the client setup snippet |
| `logout` | Delete the cached access token and the email login tokens (the key file is kept) |

Set `GARMIN_PERSONAL_API_KEY_FILE` to read the key from another path.

### Optional: email login for Coach plan, readiness and training status

The Personal API does not include training plans, training readiness, training status, VO2 max, race predictions or endurance and hill scores, so those tools use Garmin's unofficial endpoints instead. To enable them:

```bash
npx @ste5an/garmin-connect-mcp login
```

Enter your Garmin email and password (and the verification code if you use MFA). Tokens are saved in `~/.garmin-mcp/`; the password is never stored. Without this login everything else works, and the tools that need it explain how to set it up. Use `login` rather than putting `GARMIN_PASSWORD` in a client config file, where it would sit in plain text. This part can break without notice because it is not an official API.

## Tools

| Tool | Answers |
|---|---|
| `daily_briefing` | A day in one call: steps, calories, heart rate, stress, Body Battery, hydration, sleep, HRV, workouts done, and with the optional login training readiness, training status and the coach workouts planned. Start here. |
| `sleep` | Score, stages with ratings, bedtime, SpO2, respiration, sleep need. One night or a range with averages. |
| `recovery` | HRV status against the balanced range, resting HR, Body Battery, stress, sleep score, and training readiness with the optional login. A day or a trend. |
| `activities` | Recent or date-ranged workouts with distance, duration, pace, average and max heart rate, time in each heart-rate zone, cadence, power, elevation, calories, training effect and load. Filter by type. |
| `activity` | One workout in depth: moving time, pace, heart rate, cadence, stride length, ground contact time, vertical oscillation, elevation, training effect, the structured workout it followed, per-km splits and per-step laps (every warm-up, work rep, recovery and cool-down with pace against the target range, heart rate, power, cadence, stride, ground contact, vertical oscillation and elevation). |
| `training` | Training status, acute/chronic load and balance, VO2 max, race time predictions, endurance and hill scores, lactate threshold. Needs the optional email login. |
| `coach_plan` | Upcoming Garmin Coach workouts with their interval structure. Needs the optional email login. |
| `trends` | Daily series with min/max/average for steps, sleep, HRV, resting HR, stress, Body Battery, SpO2, respiration, weight, intensity minutes, and with the optional login readiness and VO2 max. |
| `weekly_summary` | Per-week run kilometres, longest run and its share of the week, strength sessions, total time, load and week-over-week change. |
| `body` | Weigh-ins and body composition. |
| `profile` | Units, time zone, heart-rate zones, max/resting/threshold heart rate, fitness age. |
| `garmin_api` | Read-only escape hatch for any other Personal API path. Names, ids, emails and GPS coordinates are redacted unless `GARMIN_RAW_UNREDACTED=1`. |

Dates accept `YYYY-MM-DD`, `today` and `yesterday`. Ranges take `days`, or `from` and `to`.

Garmin's lap endpoints (`/laps`, `/splits`, `/typedsplits`) are not in the Personal API, so `activity` rebuilds splits and laps from the per-second stream (an undocumented `details` endpoint). Per-km splits are exact. Laps come from the timed steps of the structured workout the watch followed: the steps are unrolled (repeats included, and a skipped final recovery is handled), cut on the activity timer and measured from the stream, then checked against Garmin's own step totals (`splitSummaries`). If the counts or durations disagree, or the workout has distance, lap-button or open steps, `activity` falls back to intervals detected from pace changes, whose boundaries can be off by several seconds. Steady runs report no laps or intervals. If Garmin removes the `details` endpoint, these sections disappear and everything else keeps working.

The Personal API does not offer manual lap-button laps, weather, saved workouts, gear, devices, goals, personal records, blood pressure or any write access, so those are not available.

## Troubleshooting

- **"No Garmin Personal API key found"**: run `setup`, or create the key file by hand.
- **"Garmin rejected the request"**: for Personal API data, the key expired (30 days to 1 year, your choice) or was deleted: create a new one and run `setup`. For the Coach plan, run `login` again.
- **"Garmin Coach needs the optional email login"** (also shown for `training`, readiness and VO2 max): run `login` in a terminal. The MCP server cannot prompt for a password or MFA code itself.
- **404 for a metric**: your device or account has no data for it. Other tools keep working.
- **429**: Garmin is rate limiting. Wait a minute.
- Access tokens last 24 hours and have no refresh token; the server fetches a new one automatically.

## Privacy

Everything runs on your machine. The server talks only to `personal.connectapi.garmin.com` and returns data to your AI client. The key, the cached token and the optional login tokens are stored with owner-only permissions.

## Development

```bash
npm install
npm run typecheck && npm test
npm run build
node build/cli.js setup
```

Source layout: `src/garmin/` (key-to-token authentication, API client), `src/tools/` (one file per tool, shared summarizers in `summaries.ts`), `src/cli/` (setup and status commands), `src/server.ts` (MCP wiring).

## License and credits

MIT. Authentication and endpoints follow Garmin's [Personal API reference client](https://github.com/garmin/connect-personal-api-python). The optional email login follows the flow used by [python-garminconnect](https://github.com/cyberjunky/python-garminconnect) and [garth](https://github.com/matin/garth). The project started from [Nicolasvegam/garmin-connect-mcp](https://github.com/Nicolasvegam/garmin-connect-mcp) (MIT) and was rewritten around task-level tools.

Not affiliated with Garmin. The optional login features use unofficial endpoints that can change without notice.
