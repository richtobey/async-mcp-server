export function parseArgs(args) {
  const config = {
    backendUrl: null,
    listenPort: null,
    listenHost: '127.0.0.1',
    headers: [],
    forceStdio: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--backend' || arg === '--backend-url') {
      config.backendUrl = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--listen' || arg === '--port') {
      config.listenPort = Number(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--host') {
      config.listenHost = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--header') {
      config.headers.push(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--stdio') {
      config.forceStdio = true;
      continue;
    }
    if (!arg.startsWith('-') && !config.backendUrl) {
      config.backendUrl = arg;
      continue;
    }
  }

  return config;
}

export function printUsage() {
  const lines = [
    'Usage:',
    '  mcp-facade <backend-graphql-url> [--header "Name: Value"] [--listen 7000] [--host 127.0.0.1]',
    '  (defaults to stdio when --listen is omitted, or use --stdio)',
    '',
    'Examples:',
    '  mcp-facade http://localhost:5000/graphql --listen 7000',
    '  mcp-facade http://localhost:5000/graphql --header "Authorization: Bearer TOKEN"',
    '  mcp-facade http://localhost:5000/graphql --stdio'
  ];
  console.log(lines.join('\n'));
}
