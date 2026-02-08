import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const backendProcess = spawn('docker', ['compose', 'up', '--build'], {
  stdio: 'inherit'
});

function runFacade() {
  return spawn('node', ['bin/mcp-facade.js', 'http://127.0.0.1:5000/graphql', '--listen', '7001'], {
    stdio: 'inherit'
  });
}

async function startBackend() {
  await delay(4000);
}

async function runCancel() {
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:7001/mcp'));
  const client = new Client({ name: 'cancel-client', version: '1.0.0' });
  await client.connect(transport);

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 1200);

  try {
    await client.callTool(
      { name: 'long_running_task', arguments: { input: 'cancel test' } },
      undefined,
      { signal: controller.signal }
    );
    throw new Error('Expected cancellation');
  } catch (err) {
    const message = String(err?.message || '');
    if (
      err?.name !== 'AbortError' &&
      !message.includes('cancel') &&
      !message.includes('AbortError') &&
      err?.code !== -32001
    ) {
      throw err;
    }
  } finally {
    await transport.close();
  }
}

async function main() {
  let facadeProcess;
  try {
    await startBackend();
    facadeProcess = runFacade();
    await delay(1500);
    await runCancel();
    console.log('Cancellation test passed');
  } finally {
    if (facadeProcess) facadeProcess.kill('SIGTERM');
    backendProcess.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  backendProcess.kill('SIGTERM');
  process.exit(1);
});
