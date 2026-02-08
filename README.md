# Async MCP Facade Example

This repo accompanies the Medium article on the MCP facade pattern. It ships:
- a JavaScript facade adapter (CLI invoked via `npx`)
- a Python GraphQL backend (subscriptions for job updates)
- an in-memory job store (demo)
- a simple SSE client example

## Components, Flow, and Ports

Components:
- **Facade adapter (Node.js + MCP SDK)**: MCP-facing server that forwards work to the backend and streams progress over Streamable HTTP/SSE using the official MCP SDK.
- **Backend (Python GraphQL)**: Executes the long-running job and publishes updates via subscriptions.
- **Example client**: Calls the facade and prints SSE progress + final MCP response.

Flow:
1) Client calls `/mcp` on the facade.
2) Facade starts a backend GraphQL job (mutation).
3) Backend emits updates on a GraphQL subscription.
4) Facade relays updates as MCP notifications over SSE.
5) Facade returns final MCP response when complete.

Ports:
- Backend GraphQL: `http://127.0.0.1:5000/graphql`
- Facade adapter: `http://127.0.0.1:7000`

## Quickstart

1) Start the backend
```
GRAPHQL_API_TOKEN=dev-token docker compose up --build
```

2) Install Node dependencies
```
npm install
```

3) Start the facade adapter
```
node bin/mcp-facade.js http://127.0.0.1:5000/graphql --listen 7000 --header "Authorization: Bearer dev-token"
```

To pass auth to the backend GraphQL service:
```
node bin/mcp-facade.js http://127.0.0.1:5000/graphql --header "Authorization: Bearer YOUR_TOKEN"
```

4) Run the example client
```
node client/facade_client.js http://127.0.0.1:7000
```

### How to trigger the demo tool
The facade exposes one MCP tool named `long_running_task`. Example prompts:
- "Run the long_running_task with input: demo"
- "Start a long-running job and stream progress"
- "Use long_running_task to process: hello world"

### Tool catalog
- `long_running_task`
  - Description: Start a simulated long-running job and stream progress updates (demo/test).
  - Input: `{ "input": "string" }`

## MCP config example (npx + GitHub repo reference)
```json
{
  "mcpServers": {
    "myMcp": {
      "command": "npx",
      "args": [
        "-y",
        "github:richtobey/async-mcp-server",
        "http://127.0.0.1:5000/graphql",
        "--stdio",
        "--header",
        "Authorization: Bearer dev-token"
      ]
    }
  }
}
```

### Use in Cursor
1) Clone the repo locally.
2) Start the backend:
   - `docker compose up -d backend`
   - (or run the full demo with `make demo`)
3) In Cursor, open Settings -> MCP and add the config block above.
4) Ensure the backend is reachable at `http://127.0.0.1:5000/graphql`.

Notes:
- `npx github:richtobey/async-mcp-server` runs the `async-mcp-server` bin from this repo.
- The facade uses stdio mode by default when `--listen` is omitted (ideal for Cursor). `--stdio` forces stdio.
- The repo must be public for `npx` to fetch it.

## Docs
- `docs/architecture.md`
- `docs/api.md`
- `docs/design.md`
- `docs/ops.md`

## Diagrams
Generate SVG/PNG from Mermaid:
```
scripts/export-diagrams.sh
```

## Run Tests
```
npm test
```

## Demo
Run the whole flow (backend + facade + client):
```
scripts/run-demo.sh
```

## Makefile
If you prefer `make`:
```
make diagrams
make test
make demo
```

## Troubleshooting

- **`fetch failed` or connection refused**: ensure the backend is running (`docker compose up --build`) and that the facade points to `http://127.0.0.1:5000/graphql`.
- **Port already in use**: stop the existing process or choose a new port via `--listen`.
- **No progress events**: confirm the backend is reachable and the GraphQL subscription is accepted.
- **Unauthorized errors**: if `GRAPHQL_API_TOKEN` is set, pass `Authorization: Bearer <token>` via `--header`.

## Contributing
See `CONTRIBUTING.md` for setup and guidelines.

## Code of Conduct
See `CODE_OF_CONDUCT.md`.

## Security
See `SECURITY.md`.

## Changelog
See `CHANGELOG.md`.

## License
MIT. See `LICENSE`.
