import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';

const TOOL_NAME = 'long_running_task';
const START_JOB_MUTATION = `mutation StartJob($input: String!) {
  startJob(input: $input) {
    id
  }
}`;
const JOB_UPDATES_SUBSCRIPTION = `subscription JobUpdates($id: ID!) {
  jobUpdates(id: $id) {
    id
    status
    progress
    message
    result
  }
}`;

export async function startServer(config) {
  const app = createMcpExpressApp();
  const headerMap = parseHeaders(config.headers);
  const backendUrl = config.backendUrl;
  const backendWsUrl = toWebSocketUrl(backendUrl);
  const sessions = new Map();

  const createServer = () => {
    const server = new McpServer({
      name: 'mcp-facade',
      version: '1.0.0'
    });

    server.registerTool(
      TOOL_NAME,
      {
        description:
          'Start a simulated long-running job and stream progress updates (demo/test).',
        inputSchema: z.object({
          input: z.string().default('')
        })
      },
      async (args, extra) => {
        const input = args?.input ?? '';
        const requestHeaders = pickAuthHeaders(extra?.requestInfo?.headers);
        const effectiveHeaders = mergeHeaders(headerMap, requestHeaders);
        const progressToken = extra?._meta?.progressToken ?? extra.requestId;

        const job = await startJob({ backendUrl, headerMap: effectiveHeaders, input });
        const wsClient = createClient({
          url: backendWsUrl,
          webSocketImpl: WebSocket,
          connectionParams: effectiveHeaders
        });

        const notifyProgress = async (progress, message, total = 100) => {
          if (!progressToken) return;
          await extra.sendNotification({
            method: 'notifications/progress',
            params: {
              progressToken,
              progress,
              total,
              message
            }
          });
        };

        const heartbeatMs = 5000;
        const heartbeat = setInterval(() => {
          notifyProgress(0, 'heartbeat').catch(() => {});
        }, heartbeatMs);

        return new Promise((resolve, reject) => {
          const dispose = wsClient.subscribe(
            {
              query: JOB_UPDATES_SUBSCRIPTION,
              variables: { id: job.id }
            },
            {
              next: (result) => {
                const update = result?.data?.jobUpdates;
                if (!update) return;
                notifyProgress(update.progress ?? 0, update.message ?? '').catch(() => {});
                if (update.status === 'complete') {
                  cleanup();
                  resolve({
                    content: [
                      {
                        type: 'text',
                        text: update.result ?? ''
                      }
                    ]
                  });
                }
              },
              error: (err) => {
                cleanup();
                reject(err);
              },
              complete: () => {
                cleanup();
              }
            }
          );

          const onAbort = () => {
            cleanup();
            reject(new Error('Request cancelled'));
          };

          extra?.signal?.addEventListener('abort', onAbort, { once: true });

          function cleanup() {
            clearInterval(heartbeat);
            if (dispose) dispose();
            wsClient.dispose();
            extra?.signal?.removeEventListener('abort', onAbort);
          }
        });
      }
    );

    return server;
  };

  if (config.forceStdio || !Number.isFinite(config.listenPort)) {
    try {
      const server = createServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      return;
    } catch (error) {
      console.error('Failed to start stdio server:', error);
      throw error;
    }
  }

  app.post('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];
      let transport;

      if (sessionId && sessions.has(sessionId)) {
        transport = sessions.get(sessionId).transport;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            sessions.set(newSessionId, { transport, server });
          }
        });

        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided'
          },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    }
  });

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = sessions.get(sessionId).transport;
    await transport.handleRequest(req, res);
  });

  app.listen(config.listenPort, config.listenHost, (error) => {
    if (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
    console.error(`Server listening at http://${config.listenHost}:${config.listenPort}`);
  });

  process.on('SIGINT', async () => {
    for (const [sessionId, { transport }] of sessions.entries()) {
      await transport.close();
      sessions.delete(sessionId);
    }
    process.exit(0);
  });
}

async function startJob({ backendUrl, headerMap, input }) {
  return withRetry(async () => {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headerMap
      },
      body: JSON.stringify({
        query: START_JOB_MUTATION,
        variables: { input }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      const err = new Error(`Backend error ${response.status}: ${text}`);
      err.retryable = response.status >= 500;
      throw err;
    }

    const data = await response.json();
    if (data.errors?.length) {
      const message = data.errors.map((err) => err.message).join('; ');
      const err = new Error(message);
      err.retryable = false;
      throw err;
    }

    return data.data.startJob;
  });
}

async function withRetry(fn, { retries = 5, delayMs = 1000 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const retryable = err?.retryable ?? true;
      if (!retryable || attempt > retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function parseHeaders(headers) {
  const result = {};
  for (const header of headers || []) {
    const index = header.indexOf(':');
    if (index === -1) continue;
    const name = header.slice(0, index).trim();
    const value = header.slice(index + 1).trim();
    if (name) result[name] = value;
  }
  return result;
}

function pickAuthHeaders(headers) {
  if (!headers) return {};
  const auth = headers.authorization || headers.Authorization;
  if (!auth) return {};
  return { Authorization: auth };
}

function mergeHeaders(base, extra) {
  return { ...base, ...extra };
}

function toWebSocketUrl(url) {
  if (url.startsWith('https://')) return url.replace('https://', 'wss://');
  if (url.startsWith('http://')) return url.replace('http://', 'ws://');
  return url;
}
