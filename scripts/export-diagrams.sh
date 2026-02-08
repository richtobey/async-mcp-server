#!/usr/bin/env bash
set -euo pipefail

mkdir -p docs/diagrams

npx -y @mermaid-js/mermaid-cli \
  -i docs/diagrams/architecture.mmd \
  -o docs/diagrams/architecture.svg

npx -y @mermaid-js/mermaid-cli \
  -i docs/diagrams/architecture.mmd \
  -o docs/diagrams/architecture.png
