#!/bin/bash
cd /home/z/my-project

# Build CJS modules if needed
if [ ! -f "dist/energisa-extractor.cjs" ]; then
  npx esbuild src/lib/energisa-extractor.ts --bundle --platform=node --format=cjs --outfile=dist/energisa-extractor.cjs --external:pdf-parse --external:pdfjs-dist 2>&1 | tail -3
fi
if [ ! -f "dist/energisa-table-extractor.cjs" ]; then
  npx esbuild src/lib/energisa-table-extractor.ts --bundle --platform=node --format=cjs --outfile=dist/energisa-table-extractor.cjs --external:pdf-parse --external:pdfjs-dist 2>&1 | tail -3
fi

# Use exec to replace this shell with Python - stays in Caddy's process tree
exec python3 /home/z/my-project/server.py
