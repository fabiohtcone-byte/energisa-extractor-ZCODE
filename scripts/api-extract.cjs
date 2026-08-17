const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project';

// ---- Persistent worker mode: pre-load modules, process requests from stdin ----
// Protocol: each request is a JSON line: {buf_len:N, content_type:"..."}
// followed by N bytes of raw body. Response: JSON line to stdout.

const USE_WORKER = process.argv[2] === '--worker';

if (USE_WORKER) {
  // Pre-load ALL modules once
  const pdfParse = require('pdf-parse');
  const tableMod = (() => { try { return require(path.join(ROOT, 'dist/energisa-table-extractor.cjs')); } catch(e) { return null; } })();
  const { extractEnergisaData } = require(path.join(ROOT, 'dist/energisa-extractor.cjs'));

  // Reusable buffer for reading stdin
  let rbuf = Buffer.alloc(0);

  const processBuf = () => {
    while (true) {
      // Need at least 4 bytes for JSON length prefix
      if (rbuf.length < 4) break;
      const msgLen = rbuf.readUInt32BE(0);
      if (rbuf.length < 4 + msgLen) break;
      const msg = JSON.parse(rbuf.slice(4, 4 + msgLen).toString());
      const bodyBuf = rbuf.slice(4 + msgLen, 4 + msgLen + msgLen);
      // Wait - the JSON contains buf_len, parse that
      const hdr = JSON.parse(rbuf.slice(4, 4 + msgLen).toString());
      const totalNeeded = 4 + msgLen + hdr.buf_len;
      if (rbuf.length < totalNeeded) break;
      const body = Buffer.from(rbuf.slice(4 + msgLen, totalNeeded));
      rbuf = rbuf.slice(totalNeeded);

      // Process async
      handleRequest(hdr.content_type, body, pdfParse, tableMod, extractEnergisaData).catch(() => {});
    }
  };

  // Actually, let's use a simpler protocol: length-prefixed JSON messages
  // Format: [4 bytes BE length][JSON body bytes]
  // For requests with file data, the JSON has {type:"extract",ct:"...",buf_len:N}
  // followed immediately by N raw bytes after the JSON
  
  // Simpler: use newline-delimited JSON for control, raw bytes on a separate fd
  // Simplest: each request = one stdin read of exact size
  
  // ULTRA SIMPLE: read a line of JSON metadata, then read buf_len bytes of body
  let lineBuf = '';
  
  process.stdin.on('data', (chunk) => {
    rbuf = Buffer.concat([rbuf, chunk]);
    drain();
  });

  let state = 'meta'; // 'meta' = reading JSON line, 'body' = reading raw body
  let bodyRemaining = 0;
  let currentCt = '';

  async function drain() {
    while (rbuf.length > 0) {
      if (state === 'meta') {
        const nl = rbuf.indexOf(0x0a); // newline
        if (nl === -1) break;
        const line = rbuf.slice(0, nl).toString();
        rbuf = rbuf.slice(nl + 1);
        try {
          const meta = JSON.parse(line);
          if (meta.buf_len > 0) {
            currentCt = meta.ct || '';
            bodyRemaining = meta.buf_len;
            state = 'body';
          } else {
            // Ping/keepalive
            respond({ pong: true });
          }
        } catch(e) {
          // ignore malformed lines
        }
      } else if (state === 'body') {
        if (rbuf.length < bodyRemaining) break;
        const body = rbuf.slice(0, bodyRemaining);
        rbuf = rbuf.slice(bodyRemaining);
        bodyRemaining = 0;
        state = 'meta';
        // Process asynchronously but don't block the drain loop
        handleRequest(currentCt, body, pdfParse, tableMod, extractEnergisaData);
      }
    }
  }

  function respond(data) {
    const out = JSON.stringify(data) + '\n';
    process.stdout.write(out);
  }

  async function handleRequest(ct, rawBody, pdfParse, tableMod, extractEnergisaData) {
    const t0 = Date.now();
    try {
      const { fileBuf } = parseMultipart(rawBody, ct);
      if (!fileBuf) { respond({ error: 'no file' }); return; }

      // PARALLEL: pdf-parse (text) + pdfjs-dist (table) at the same time
      const [pd, td] = await Promise.all([
        pdfParse(fileBuf),
        tableMod ? Promise.race([
          tableMod.extractTableFromPDF(fileBuf),
          new Promise((_, r) => setTimeout(() => r(null), 8000))
        ]) : Promise.resolve(null)
      ]);

      if (!pd.text || !pd.text.trim()) { respond({ error: 'Sem texto' }); return; }

      const ext = extractEnergisaData(pd.text, td);
      const vals = Object.values(ext);
      const cnt = vals.filter(v => v !== '').length;
      respond({
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
      });
    } catch (e) {
      respond({ error: e.message, processingTimeMs: Date.now() - t0 });
    }
  }

  // Signal ready
  process.stderr.write('WORKER_READY\n');

} else {
  // ---- One-shot mode (original, for fallback) ----
  let buf = fs.readFileSync(0);
  const ct = process.env.CONTENT_TYPE || '';
  const { fileBuf } = parseMultipart(buf, ct);
  if (!fileBuf) { console.log(JSON.stringify({error:'no file'})); process.exit(1); }

  (async () => {
    const t0 = Date.now();
    try {
      const pdfParse = require('pdf-parse');
      const tableMod = (() => { try { return require(path.join(ROOT, 'dist/energisa-table-extractor.cjs')); } catch(e) { return null; } })();
      const { extractEnergisaData } = require(path.join(ROOT, 'dist/energisa-extractor.cjs'));

      // PARALLEL: pdf-parse (text) + pdfjs-dist (table)
      const [pd, td] = await Promise.all([
        pdfParse(fileBuf),
        tableMod ? Promise.race([
          tableMod.extractTableFromPDF(fileBuf),
          new Promise((_, r) => setTimeout(() => r(null), 8000))
        ]) : Promise.resolve(null)
      ]);

      if (!pd.text || !pd.text.trim()) { console.log(JSON.stringify({error:'Sem texto'})); process.exit(1); }

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
      console.log(JSON.stringify({ error: e.message, processingTimeMs: Date.now() - t0 }));
      process.exit(1);
    }
  })();
}

// ---- Shared multipart parser ----
function parseMultipart(buf, ct) {
  const bm = ct.match(/boundary=([\w\-]+)/);
  if (!bm) return { fileBuf: null };
  const delim = Buffer.from('--' + bm[1]);
  let s = buf.indexOf(delim);
  if (s === -1) return { fileBuf: null };
  s += delim.length;
  let fileBuf = null;
  while (s < buf.length) {
    if (buf[s] === 0x0d && buf[s+1] === 0x0a) s += 2;
    const he = buf.indexOf(Buffer.from('\r\n\r\n'), s);
    if (he === -1) break;
    const hs = buf.slice(s, he).toString();
    const bs = he + 4;
    const nb = buf.indexOf(delim, bs);
    if (nb === -1) break;
    const name = (hs.match(/name="([^"]+)"/) || [])[1] || null;
    if (name === 'file') fileBuf = buf.slice(bs, nb - 2);
    s = nb + delim.length;
    if (s < buf.length && buf[s] === 0x2d && buf[s+1] === 0x2d) break;
  }
  return { fileBuf };
}
