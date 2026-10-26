import fs from 'node:fs';
import path from 'node:path';
import { keyFilePath } from '../garmin/auth';
import { GarminClient } from '../garmin/client';
import { describeError } from '../server';
import { VERSION } from '../version';
import { askHidden } from './prompt';

const PACKAGE_NAME = '@ste5an/garmin-connect-mcp';
const SERVER_NAME = 'garmin';

function launchCommand(): { command: string; args: string[] } {
  const script = process.argv[1] ?? '';
  if (script.includes('_npx') || script.includes('node_modules')) return { command: 'npx', args: ['-y', PACKAGE_NAME] };
  return { command: process.execPath, args: [fs.realpathSync(script), 'serve'] };
}

export function printHelp(): void {
  console.error(`garmin-connect-mcp ${VERSION}

Usage
  garmin-connect-mcp setup     Save your Garmin Personal API key and check that it works
  garmin-connect-mcp status    Check that the saved key works
  garmin-connect-mcp config    Print the setup snippet for Claude Code / Claude Desktop / Cursor
  garmin-connect-mcp logout    Delete the cached access token (the key file is kept)
  garmin-connect-mcp serve     Start the MCP server on stdio (what your AI client runs)

Quick start
  1. Create a key at https://connect.garmin.com/app/settings/personalApiToken
  2. garmin-connect-mcp setup
  3. garmin-connect-mcp config   and paste the snippet into your AI client
`);
}

export function printConfig(): void {
  const { command, args } = launchCommand();
  const shell = [command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(' ');
  const json = JSON.stringify({ mcpServers: { [SERVER_NAME]: { command, args } } }, null, 2);
  console.error(`Claude Code
  claude mcp add ${SERVER_NAME} -- ${shell}

Claude Desktop (claude_desktop_config.json), Cursor (.cursor/mcp.json) and most other clients
${json}
`);
}

export async function setup(): Promise<void> {
  const file = keyFilePath();
  const key = await askHidden('Garmin Personal API key (input is hidden): ');
  if (!key) throw new Error('A key is required.');

  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${key}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);

  const client = new GarminClient();
  client.clearCache();
  await client.connect();
  console.error(`\nKey accepted and saved to ${file}\n`);
  printConfig();
}

export async function status(): Promise<void> {
  const client = new GarminClient();
  await client.connect();
  console.error('Personal API key is valid.');
}

export function logout(): void {
  new GarminClient().clearCache();
  console.error(`Removed the cached access token. The key file ${keyFilePath()} was not touched.`);
}

export function fail(error: unknown): never {
  console.error(describeError(error));
  process.exit(1);
}
