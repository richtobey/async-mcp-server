import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const backendProcess = spawn('docker', ['compose', 'up', '--build'], {
  stdio: 'inherit'
});

function runFacade() {
  return spawn('node', ['bin/mcp-facade.js', 'http://127.0.0.1:5000/graphql', '--listen', '7000'], {
    stdio: 'inherit'
  });
}

async function startBackend() {
  await delay(4000);
}

async function runClient() {
  return new Promise((resolve, reject) => {
    const client = spawn('node', ['client/facade_client.js', 'http://127.0.0.1:7000'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    client.stdout.on('data', (data) => {
      output += data.toString();
    });
    client.stderr.on('data', (data) => {
      output += data.toString();
    });

    client.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`client exit code ${code}`));
      }
      if (!output.includes('Final result:')) {
        return reject(new Error('Did not receive final result'));
      }
      resolve();
    });
  });
}

async function main() {
  let facadeProcess;
  try {
    await startBackend();
    facadeProcess = runFacade();
    await delay(1500);
    await runClient();
    console.log('Happy path test passed');
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
