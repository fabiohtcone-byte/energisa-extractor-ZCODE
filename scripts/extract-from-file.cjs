#!/usr/bin/env node
/**
 * Extract Energisa data from a PDF file path.
 * Usage: node extract-from-file.cjs /path/to/file.pdf
 * Outputs JSON to stdout.
 */
const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project';

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  process.stdout.write(JSON.stringify({ error: 'File not found: ' + filePath }));
  process.exit(1);
}

(async () => {
  const t0 = Date.now();
  try {
    const pdfParse = require('pdf-parse');
    const { extractEnergisaData } = require(path.join(ROOT, 'dist/energisa-extractor.cjs'));

    const buf = fs.readFileSync(filePath);
    const pd = await pdfParse(buf);

    // Table extraction via child process (pdfjs-dist crashes in-process)
    let td = null;
    try {
      const { execFile } = require('child_process');
      td = await new Promise((resolve) => {
        execFile('node', [path.join(ROOT, 'scripts/extract-table.cjs'), filePath], {
          timeout: 14000,
          maxBuffer: 10 * 1024 * 1024,
        }, (err, stdout) => {
          if (err || !stdout) { resolve(null); return; }
          try {
            const result = JSON.parse(stdout);
            if (result.error) { resolve(null); return; }
            resolve(result.items?.length > 0 ? result : null);
          } catch(e) { resolve(null); }
        });
      });
    } catch(e) {
      td = null;
    }

    if (!pd.text || !pd.text.trim()) {
      process.stdout.write(JSON.stringify({ error: 'Sem texto' }));
      process.exit(1);
    }

    const ext = extractEnergisaData(pd.text, td);
    const vals = Object.values(ext);
    const cnt = vals.filter(v => v !== '').length;
    const result = {
      success: true,
      data: ext,
      stats: {
        extractedCount: cnt,
        totalFields: vals.length,
        extractionRate: Math.round(cnt / vals.length * 100),
        pageCount: pd.numpages,
        tableItems: td?.items?.length ?? 0,
        processingTimeMs: Date.now() - t0
      }
    };
    process.stdout.write(JSON.stringify(result));
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: e.message, processingTimeMs: Date.now() - t0 }));
    process.exit(1);
  }
})();
