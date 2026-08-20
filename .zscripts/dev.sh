#!/bin/bash
set -e
cd /home/z/my-project

# 1. Ensure node_modules and next exist
if [ ! -d "node_modules/next" ]; then
  echo "> Installing next..."
  npm install next --save-dev 2>&1 | tail -3
fi

# 2. Build CJS extraction bundles if needed
if [ ! -f "dist/energisa-extractor.cjs" ]; then
  echo "> Building extractor bundle..."
  npx esbuild src/lib/energisa-extractor.ts --bundle --platform=node --format=cjs --outfile=dist/energisa-extractor.cjs --external:pdf-parse --external:pdfjs-dist 2>&1 | tail -3
fi
if [ ! -f "dist/energisa-table-extractor.cjs" ]; then
  echo "> Building table extractor bundle..."
  npx esbuild src/lib/energisa-table-extractor.ts --bundle --platform=node --format=cjs --outfile=dist/energisa-table-extractor.cjs --external:pdf-parse --external:pdfjs-dist 2>&1 | tail -3
fi

# 3. Build Next.js static export if .next is missing or empty
if [ ! -f ".next/server/app/index.html" ]; then
  echo "> Building Next.js..."
  npx next build 2>&1 | tail -8
fi

# 4. Start daemon (double-fork, survives container cleanup)
echo "> Starting server daemon..."
exec python3 /home/z/my-project/daemon-server.py
