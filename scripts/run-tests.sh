#!/usr/bin/env bash
set -euo pipefail

npm install

node tests/facade_happy_path.js
node tests/facade_cancel.js
node tests/facade_retry.js
