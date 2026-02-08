# API

## Facade HTTP endpoints

### POST /mcp
Accepts JSON-RPC requests. Supports:
- `tools/list` to list the example tool
- `tools/call` to start a long-running job

If the request includes `Accept: text/event-stream`, the response is streamed as SSE with MCP notifications and a final JSON-RPC response.
Otherwise, the response contains a `job_id` and a stream URL.

Example:
```
curl -s http://127.0.0.1:7000/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"long_running_task\",
      \"arguments\": { \"input\": \"hello\" }
    }
  }'
```

### GET /mcp/stream?job_id=...
Streams MCP notifications and a final JSON-RPC response for a job.

## Backend GraphQL

### Mutation
```
mutation StartJob($input: String!) {
  startJob(input: $input) { id }
}
```

### Subscription
```
subscription JobUpdates($id: ID!) {
  jobUpdates(id: $id) {
    id
    status
    progress
    message
    result
  }
}
```
