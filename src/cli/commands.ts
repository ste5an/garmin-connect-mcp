import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthRequiredError } from '../garmin/auth';
import { GarminClient } from '../garmin/client';
import { describeError } from '../server';
import { VERSION } from '../version';
import { ask, askHidden } from './prompt';

const PACKAGE_NAME = '@ste5an/garmin-connect-mcp';
const SERVER_NAME = 'garmin';
const TOKEN_DIR = path.join(os.homedir(), '.garmin-mcp');

function launchCommand(): { command: string; args: string[] } {
  const script = process.argv[1] ?? '';
  if (script.includes('_npx') || script.includes('node_modules')) return { command: 'npx', args: ['-y', PACKAGE_NAME] };
  return { command: process.execPath, args: [fs.realpathSync(script)] };
}

export function printHelp(): void {
  console.error(`garmin-connect-mcp ${VERSION}

Usage
  garmin-connect-mcp login     Sign in to Garmin (supports MFA) and save tokens
  garmin-connect-mcp status    Check that the saved login works
  garmin-connect-mcp config    Print the setup snippet for Claude Code / Claude Desktop / Cursor
  garmin-connect-mcp logout    Delete saved tokens
  garmin-connect-mcp serve     Start the MCP server on stdio (what your AI client runs)

Quick start
  1. garmin-connect-mcp login
  2. garmin-connect-mcp config   and paste the snippet into your AI client
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

export async function login(): Promise<void> {
  console.error('Sign in to Garmin Connect. Your password is only used to obtain tokens and is never stored.\n');
  const email = process.env.GARMIN_EMAIL ?? (await ask('Garmin email: '));
  const password = process.env.GARMIN_PASSWORD ?? (await askHidden('Garmin password: '));
  if (!email || !password) throw new Error('Email and password are required.');

  const client = new GarminClient(email, password, async () => {
    console.error('\nGarmin sent you a verification code (email or authenticator app).');
    return ask('Verification code: ');
  });

  await client.login();
  const profile = (await client.getUserProfile()) as { fullName?: string };
  console.error(`\nLogged in${profile.fullName ? ` as ${profile.fullName}` : ''}. Tokens saved to ${TOKEN_DIR}\n`);
  printConfig();
}

export async function status(): Promise<void> {
  const client = new GarminClient();
  if (!client.isLoggedIn) throw new AuthRequiredError();
  await client.connect();
  const profile = (await client.getUserProfile()) as { fullName?: string };
  console.error(`Logged in${profile.fullName ? ` as ${profile.fullName}` : ''}. Tokens are valid.`);
}

export function logout(): void {
  if (!fs.existsSync(TOKEN_DIR)) {
    console.error('No saved login found.');
    return;
  }
  fs.rmSync(TOKEN_DIR, { recursive: true, force: true });
  console.error(`Removed ${TOKEN_DIR}`);
}

export function fail(error: unknown): never {
  console.error(describeError(error));
  process.exit(1);
}
