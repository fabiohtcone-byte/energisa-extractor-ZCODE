#!/usr/bin/env node
"use strict";
// Batch PDF extraction: processes multiple files in a single Node.js process.
// Modules are loaded ONCE, then reused for all files — no cold-start overhead.
//
// Input (stdin): raw multipart body with multiple file parts (name="file")
// Env: CONTENT_TYPE=the multipart content-type header
// Output (stdout): JSON array of results [{fileName, data, stats}, ...]

const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project';

// ---- Load modules ONCE ----
const pdfParse = require('pdf-parse');
let tableMod = null;
try { tableMod = require(path.join(ROOT, 'dist/energisa-table-extractor.cjs')); } catch(e) {}
const { extractEnergisaData } = require(path.join(ROOT, 'dist/energisa-extractor.cjs'));

// ---- Multipart parser: extracts ALL file parts named "file" ----
function parseMultipartMulti(buf, ct) {
  const bm = ct.match(/boundary=([\w\-]+)/);
  if (!bm) return [];
  const delim = Buffer.from('--' + bm[1]);
  let s = buf.indexOf(delim);
  if (s === -1) return [];
  s += delim.length;
  const files = [];

  while (s < buf.length) {
    if (buf[s] === 0x0d && buf[s+1] === 0x0a) s += 2;
    const he = buf.indexOf(Buffer.from('\r\n\r\n'), s);
    if (he === -1) break;
    const hs = buf.slice(s, he).toString();
    const bs = he + 4;
    const nb = buf.indexOf(delim, bs);
    if (nb === -1) break;
    const name = (hs.match(/name="([^"]+)"/) || [])[1] || null;
    const fnameMatch = hs.match(/filename="([^"]+)"/) || [];
    const fname = fnameMatch[1] || `file_${files.length}.pdf`;
    if (name === 'file') {
      files.push({ fileName: fname, buf: buf.slice(bs, nb - 2) });
    }
    s = nb + delim.length;
    if (s < buf.length && buf[s] === 0x2d && buf[s+1] === 0x2d) break;
  }
  return files;
}

// ---- Process one file ----
async function processOne(file) {
  const t0 = Date.now();
  try {
    const [pd, td] = await Promise.all([
      pdfParse(file.buf),
      tableMod ? Promise.race([
        tableMod.extractTableFromPDF(file.buf),
        new Promise((_, r) => setTimeout(() => r(null), 8000))
      ]) : Promise.resolve(null)
    ]);

    if (!pd.text || !pd.text.trim()) {
      return { fileName: file.fileName, error: 'Sem texto', processingTimeMs: Date.now() - t0 };
    }

    const ext = extractEnergisaData(pd.text, td);
    const vals = Object.values(ext);
    const cnt = vals.filter(v => v !== '').length;
    return {
      fileName: file.fileName,
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
  } catch (e) {
    return { fileName: file.fileName, error: e.message, processingTimeMs: Date.now() - t0 };
  }
}

// ---- Main ----
(async () => {
  const buf = fs.readFileSync(0);
  const ct = process.env.CONTENT_TYPE || '';
  const files = parseMultipartMulti(buf, ct);

  if (files.length === 0) {
    console.log(JSON.stringify({ error: 'nenhum arquivo PDF encontrado' }));
    process.exit(1);
  }

  // Process files sequentially (pdf-parse is not fully thread-safe)
  // but modules are already loaded so no cold-start overhead
  const results = [];
  for (const file of files) {
    results.push(await processOne(file));
  }

  process.stdout.write(JSON.stringify(results));
})();
