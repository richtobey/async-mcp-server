# Contributing

Thanks for your interest in contributing!

## Quick start
1) Fork the repo and create your branch from `main`.
2) Make your changes with clear, focused commits.
3) Run any relevant tests or scripts.
4) Open a pull request with a clear description and screenshots/logs when applicable.

## Development setup
- Backend (Python + GraphQL)
  - `docker compose up --build`
- Facade (Node)
  - `npm install`
  - `node bin/mcp-facade.js http://localhost:5000/graphql --listen 7000`

## Reporting issues
Please use the GitHub issue templates and include:
- what you expected to happen
- what actually happened
- steps to reproduce
- logs or screenshots if helpful

## Code style
- Keep changes minimal and focused.
- Prefer readable, well-documented behavior over cleverness.
- Avoid introducing non-ASCII text unless required.

## License
By contributing, you agree that your contributions will be licensed under the MIT License.
