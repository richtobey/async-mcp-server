# Design Notes

- The facade is a thin MCP server that starts a backend job via GraphQL and streams progress as MCP notifications.
- SSE is the delivery transport; messages are MCP JSON-RPC notifications and responses.
- The job store is in-memory for demo simplicity. For production, replace with Redis or a database.
- The backend publishes updates via GraphQL subscriptions (WebSocket transport).
- Auth headers provided to the facade CLI (and any incoming Authorization header) are forwarded to the backend for GraphQL HTTP + subscription auth.
