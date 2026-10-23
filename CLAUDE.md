# Garmin Connect MCP

MCP server for Garmin Connect in TypeScript. 20 task-level tools that return trimmed, human-readable data.

## Layout

```
src/
  cli.ts            Entry point: serve | login | status | logout | config
  cli/              login prompts and setup commands
  server.ts         MCP wiring: registers every tool, formats results and errors
  garmin/           auth.ts (SSO + OAuth1/2), client.ts (endpoint methods), endpoints.ts
  tools/            one file per tool, plus define.ts, dates.ts, format.ts, summaries.ts
```

## Design rules

- Tools answer questions, not endpoints. Combine calls inside a tool (`gather`) and return only useful fields in friendly units (km, min/km, minutes, hh:mm).
- Never return raw Garmin payloads from a tool. Put the mapping in `summaries.ts` or the tool file and drop nulls with `compact`. The `garmin_api` tool is the only raw escape hatch.
- A section that fails must not fail the whole tool: use `gather` and report it in `unavailable`.
- Dates: accept `YYYY-MM-DD`, `today`, `yesterday` through `resolveDate`/`resolveRange`. All date math is local-calendar or UTC-string based, never `toISOString()` on a local time.
- Write tools use `mode: 'write'`; destructive ones use `mode: 'destructive'` and require a `confirm: true` input.
- Errors shown to the user come from `describeError` and must say what to do next.
- Never log to stdout (it is the MCP transport). Use `console.error`.

## Conventions

- Tool input types come from the zod shape in `defineTool`; there is no separate DTO type.
- Local imports have no extension. Library imports keep their full path (`@modelcontextprotocol/sdk/server/mcp.js`).
- Files are kebab-case or single lowercase words; functions start with a verb; constants are UPPER_SNAKE_CASE.
- Code carries no comments; names and small functions explain themselves.
- Add a unit test for every summarizer and date helper. Tests never call the network.

## Auth

Tokens live in `~/.garmin-mcp/` (owner-only). `login` obtains them with email, password and optional MFA code. The server never prompts; without tokens every tool returns the `AuthRequiredError` message. OAuth2 is refreshed from OAuth1 on 401.

## Commands

`npm run typecheck`, `npm test`, `npm run build`, `node build/cli.js <command>`.
