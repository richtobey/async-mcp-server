#!/usr/bin/env node
import { startServer } from '../src/server.js';
import { parseArgs, printUsage } from '../src/cli.js';

const config = parseArgs(process.argv.slice(2));
if (!config.backendUrl) {
  printUsage();
  process.exit(1);
}

startServer(config).catch((err) => {
  console.error(err);
  process.exit(1);
});
