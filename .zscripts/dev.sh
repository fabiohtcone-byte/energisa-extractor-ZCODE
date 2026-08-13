#!/bin/bash
# Custom dev script for container startup
# Uses app.cjs (Node.js static server) instead of next dev to save memory

set -e
cd /home/z/my-project

# Ensure build exists
if [ ! -f ".next/server/app/index.html" ]; then
  echo "[DEV] No build found, running next build..."
  npx next build
fi

# Ensure CJS modules exist
if [ ! -f "dist/energisa-extractor.cjs" ]; then
  echo "[DEV] Building CJS modules..."
  npx esbuild src/lib/energisa-extractor.ts --bundle --platform=node --format=cjs --outfile=dist/energisa-extractor.cjs --external:pdf-parse --external:pdfjs-dist
fi
if [ ! -f "dist/energisa-table-extractor.cjs" ]; then
  echo "[DEV] Building CJS table extractor..."
  npx esbuild src/lib/energisa-table-extractor.ts --bundle --platform=node --format=cjs --outfile=dist/energisa-table-extractor.cjs --external:pdf-parse --external:pdfjs-dist
fi

echo "[DEV] Starting Node.js static server on port 3000..."
setsid node /home/z/my-project/app.cjs >> /home/z/my-project/server.log 2>&1 &
echo "[DEV] Server started"

# Keep this script running so start.sh's wait doesn't exit
sleep infinity &
wait