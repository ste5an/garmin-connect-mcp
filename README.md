# Garmin Connect MCP

Ask your AI assistant about your Garmin data in plain language: sleep, recovery, training load, runs, race predictions and your Garmin Coach plan.

> "How did I sleep and should I do tomorrow's tempo?" · "Compare my last three long runs." · "Is my resting heart rate trending up?"

19 task-level tools instead of a hundred raw endpoints. Responses are trimmed to what matters (a night of sleep is about 600 characters, not 245,000), so answers are fast and cheap.

## Quick start

Requires Node.js 20 or newer.

```bash
npx @ste5an/garmin-connect-mcp login
```

Enter your Garmin email and password (and the verification code if you use MFA). Tokens are saved in `~/.garmin-mcp/`; the password is never stored.

Then add the server to your client. The `login` command prints the exact snippet; this is the typical form:

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
| `login` | Sign in and save tokens |
| `status` | Check that the saved login works |
| `config` | Print the client setup snippet |
| `logout` | Delete saved tokens |

## Tools

| Tool | Answers |
|---|---|
| `daily_briefing` | Everything about a day in one call: activity totals, sleep, readiness, HRV, training status, workouts done, coach workouts. Start here. |
| `sleep` | Score, stages with ratings, bedtime, HRV, SpO2. One night or a range with averages. |
| `recovery` | Training readiness and its factors, HRV status, resting HR, Body Battery, stress. |
| `activities` | Recent or date-ranged workouts with pace, heart rate, effect and load. Filter by type. |
| `activity` | One workout in depth: laps, heart-rate zones, weather, gear, strength sets. |
| `training` | Training status and load balance, VO2 max, race predictions, endurance and hill scores, lactate threshold. |
| `coach_plan` | Upcoming Garmin Coach workouts with their interval structure. |
| `trends` | Daily series with min/max/average for steps, sleep, HRV, resting HR, stress, Body Battery, readiness, SpO2, respiration, VO2 max, weight, intensity minutes. |
| `body` | Weigh-ins, body composition, blood pressure. |
| `profile` | Profile, devices, gear, goals, personal records. |
| `workouts` | Saved workouts and their steps. |
| `log_weight`, `log_hydration`, `log_blood_pressure`, `log_activity` | Write entries to Garmin Connect. Only registered when `GARMIN_ENABLE_WRITE=1` is set in the server env. |
| `rename_activity`, `assign_gear` | Edit activities. |
| `delete_activity` | Permanent delete; requires explicit confirmation. |
| `garmin_api` | Read-only escape hatch for any endpoint not covered above. |

Dates accept `YYYY-MM-DD`, `today` and `yesterday`. Ranges take `days`, or `from` and `to`.

## Troubleshooting

- **"Not logged in"**: run `login` in a terminal. The MCP server cannot prompt for a password or MFA code itself.
- **"Garmin rejected the saved login"**: tokens expired or the password changed. Run `login` again.
- **404 for a metric**: your device or account has no data for it. Other tools keep working.
- **429**: Garmin is rate limiting. Wait a minute.
- Alternative to `login`: set `GARMIN_EMAIL` and `GARMIN_PASSWORD` in the client's environment. MFA accounts must use `login`.

## Privacy

Everything runs on your machine. The server talks only to Garmin and returns data to your AI client. Tokens live in `~/.garmin-mcp/` with owner-only permissions.

## Development

```bash
npm install
npm run typecheck && npm test
npm run build
node build/cli.js login
```

Source layout: `src/garmin/` (authentication, API client), `src/tools/` (one file per tool, shared summarizers in `summaries.ts`), `src/cli/` (login and setup commands), `src/server.ts` (MCP wiring).

## License and credits

MIT. Garmin authentication follows the flow used by [python-garminconnect](https://github.com/cyberjunky/python-garminconnect) and [garth](https://github.com/matin/garth). The project started from [Nicolasvegam/garmin-connect-mcp](https://github.com/Nicolasvegam/garmin-connect-mcp) (MIT) and was rewritten around task-level tools.

Not affiliated with Garmin. Uses unofficial endpoints that can change without notice.
