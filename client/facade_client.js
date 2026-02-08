import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const baseUrl = process.argv[2] || 'http://127.0.0.1:7000';

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  const client = new Client({ name: 'facade-client', version: '1.0.0' });

  await client.connect(transport);

  const result = await client.callTool(
    {
      name: 'long_running_task',
      arguments: { input: 'hello from client' }
    },
    undefined,
    {
      onprogress: (progress) => {
        console.log('Event:', progress);
      }
    }
  );

  const text = result?.content?.[0]?.text ?? '';
  console.log('Final result:', text);

  await transport.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
