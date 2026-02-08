import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

function runFacade() {
  return spawn('node', ['bin/mcp-facade.js', 'http://127.0.0.1:5000/graphql', '--listen', '7002'], {
    stdio: 'inherit'
  });
}

function runBackend() {
  return spawn('docker', ['compose', 'up', '--build'], {
    stdio: 'inherit'
  });
}

async function runClient() {
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:7002/mcp'));
  const client = new Client({ name: 'retry-client', version: '1.0.0' });
  await client.connect(transport);

  const result = await client.callTool({
    name: 'long_running_task',
    arguments: { input: 'retry test' }
  });

  await transport.close();
  if (!result?.content?.[0]?.text) {
    throw new Error('No result content');
  }
}

async function main() {
  let facadeProcess;
  let backendProcess;
  try {
    facadeProcess = runFacade();
    await delay(1000);
    const clientPromise = runClient();
    await delay(2000);
    backendProcess = runBackend();
    await clientPromise;
    console.log('Retry test passed');
  } finally {
    if (facadeProcess) facadeProcess.kill('SIGTERM');
    if (backendProcess) backendProcess.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
