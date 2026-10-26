import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fail, login, logout, printConfig, printHelp, setup, status } from './cli/commands';
import { GarminClient } from './garmin/client';
import { createServer } from './server';
import { VERSION } from './version';

async function serve(): Promise<void> {
  await createServer(new GarminClient()).connect(new StdioServerTransport());
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
    case 'setup':
      return setup();
    case 'login':
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
