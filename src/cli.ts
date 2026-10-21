import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fail, login, logout, printConfig, printHelp, status } from './cli/commands';
import { GarminClient } from './garmin/client';
import { createServer } from './server';
import { VERSION } from './version';

async function serve(): Promise<void> {
  const client = new GarminClient(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);
  if (!client.isLoggedIn && !process.env.GARMIN_EMAIL) {
    console.error('Not logged in yet. Run `npx garmin-connect-mcp login` in a terminal.');
  }
  await createServer(client).connect(new StdioServerTransport());
  console.error(`Garmin Connect MCP ${VERSION} running on stdio`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case undefined:
      if (process.stdin.isTTY) return printHelp();
      return serve();
    case 'serve':
      return serve();
    case 'login':
    case 'setup':
      return login();
    case 'status':
      return status();
    case 'logout':
      return logout();
    case 'config':
      return printConfig();
    case '--version':
    case '-v':
      return console.log(VERSION);
    default:
      return printHelp();
  }
}

main().catch(fail);
