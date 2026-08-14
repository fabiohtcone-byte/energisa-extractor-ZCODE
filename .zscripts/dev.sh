#!/bin/bash
set -e
cd /home/z/my-project

# Install deps if needed
if [ ! -d "node_modules/next" ]; then
  echo "[DEV] Installing dependencies..."
  npm install --no-fund --no-audit 2>&1 | tail -3
fi

# Build if needed
if [ ! -f ".next/server/app/index.html" ]; then
  echo "[DEV] Running next build..."
  npx next build 2>&1 | tail -5
fi

# Build CJS modules if needed
if [ ! -f "dist/energisa-extractor.cjs" ]; then
  echo "[DEV] Building CJS extractor..."
  npx esbuild src/lib/energisa-extractor.ts --bundle --platform=node --format=cjs --outfile=dist/energisa-extractor.cjs --external:pdf-parse --external:pdfjs-dist
fi
if [ ! -f "dist/energisa-table-extractor.cjs" ]; then
  echo "[DEV] Building CJS table extractor..."
  npx esbuild src/lib/energisa-table-extractor.ts --bundle --platform=node --format=cjs --outfile=dist/energisa-table-extractor.cjs --external:pdf-parse --external:pdfjs-dist
fi

echo "[DEV] Starting server loop..."
while true; do
  node /home/z/my-project/app.cjs >> /home/z/my-project/server.log 2>&1
  echo "[$(date '+%H:%M:%S')] Server exited, restarting in 2s..." >> /home/z/my-project/server.log
  sleep 2
done
