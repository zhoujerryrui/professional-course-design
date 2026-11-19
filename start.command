#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if [[ ! -d node_modules ]]; then npm ci --cache /tmp/scratch-platform-npm || exit 1; fi
npm run build || exit 1
npm start
