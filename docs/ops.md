# Ops Notes

- Add rate limiting at the facade if clients can burst.
- Log and propagate job IDs across the facade and backend.
- Consider retries for GraphQL subscription drops.
- Replace the in-memory job store with durable storage for real use.
- Backend enforces `GRAPHQL_API_TOKEN` if set; pass `Authorization: Bearer <token>` via the facade.
