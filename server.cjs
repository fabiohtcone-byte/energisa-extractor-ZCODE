const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse: parseUrl } = require('url');

const { extractEnergisaData, FIELD_LABELS } = require('./dist/energisa-extractor.cjs');

// ===== MIME =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// ===== Read body =====
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
    req.socket.setTimeout(120000);
  });
}

// ===== Multipart parser =====
function parseMultipart(buf, boundary) {
  const parts = [];
  const delim = Buffer.from('--' + boundary);
  let start = buf.indexOf(delim);
  if (start === -1) return parts;
  start += delim.length;
  while (true) {
    if (buf[start] === 0x0d && buf[start+1] === 0x0a) start += 2;
    const he = buf.indexOf(Buffer.from('\r\n\r\n'), start);
    if (he === -1) break;
    const hs = buf.slice(start, he).toString('utf8');
    const bs = he + 4;
    const nb = buf.indexOf(delim, bs);
    if (nb === -1) break;
    parts.push({
      name: (hs.match(/name="([^"]+)"/) || [])[1] || null,
      filename: (hs.match(/filename="([^"]+)"/) || [])[1] || null,
      body: buf.slice(bs, nb - 2),
    });
    start = nb + delim.length;
    if (buf[start] === 0x2d && buf[start+1] === 0x2d) break;
  }
  return parts;
}

// ===== Serve file =====
function serveFile(res, filePath, cache) {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (cache) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = parseUrl(req.url, true);
    const p = parsedUrl.pathname;

    // ===== API: Extract PDF =====
    if (p === '/api/extract-pdf' && req.method === 'POST') {
      const body = await readBody(req);
      const bm = (req.headers['content-type'] || '').match(/boundary=([\w\-]+)/);
      if (!bm) { res.writeHead(400, {'Content-Type':'application/json'}); res.end('{"error":"invalid"}'); return; }
      const parts = parseMultipart(body, bm[1]);
      const fp = parts.find(x => x.name === 'file' && x.body.length > 0);
      if (!fp) { res.writeHead(400, {'Content-Type':'application/json'}); res.end('{"error":"no file"}'); return; }
      const pdfParse = require('pdf-parse');
      const pd = await pdfParse(fp.body);
      const text = pd.text;
      if (!text || !text.trim()) { res.writeHead(422, {'Content-Type':'application/json'}); res.end('{"error":"no text"}'); return; }
      const ext = extractEnergisaData(text);
      const vals = Object.values(ext);
      const cnt = vals.filter(v => v !== '').length;
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({
        success: true, data: ext,
        stats: { extractedCount: cnt, totalFields: vals.length, extractionRate: Math.round(cnt/vals.length*100), pageCount: pd.numpages },
        rawText: text
      }));
      return;
    }

    // ===== API: Export Excel =====
    if (p === '/api/export-excel' && req.method === 'POST') {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body.toString('utf8')); } catch { res.writeHead(400, {'Content-Type':'application/json'}); res.end('{"error":"bad json"}'); return; }
      const { invoices } = parsed;
      if (!invoices || !Array.isArray(invoices) || invoices.length === 0) { res.writeHead(400, {'Content-Type':'application/json'}); res.end('{"error":"empty"}'); return; }
      const XLSX = require('xlsx');
      const fk = Object.keys(FIELD_LABELS);
      const hdrs = [...fk.map(k => FIELD_LABELS[k]), 'Gerencia', 'LOCINS'];
      const rows = invoices.map(inv => [...fk.map(k => inv[k] || ''), '', '']);
      const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows]);
      ws['!cols'] = hdrs.map(() => ({ wch: 28 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Faturas ENERGISA');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.writeHead(200, {'Content-Type': MIME['.xlsx'], 'Content-Disposition': 'attachment; filename="faturas_energisa.xlsx"'});
      res.end(buf);
      return;
    }

    // ===== Static: _next/* (chunks, css, fonts) =====
    // URL /_next/static/chunks/X.js -> file .next/static/chunks/X.js
    if (p.startsWith('/_next/')) {
      const filePath = path.join(__dirname, '.next', p.replace('/_next', ''));
      return serveFile(res, filePath, true);
    }

    // ===== Page: / =====
    if (p === '/' || p === '/index.html') {
      return serveFile(res, path.join(__dirname, '.next', 'server', 'app', 'index.html'), false);
    }

    // ===== Favicon =====
    if (p === '/favicon.ico' || p === '/logo.svg') {
      return serveFile(res, path.join(__dirname, 'public', p), false);
    }

    // ===== 404 =====
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.end('<h1>404</h1>');

  } catch (error) {
    console.error('Error:', error.message);
    if (!res.headersSent) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: error.message }));
    }
  }
});

server.on('error', err => console.error('Server error:', err.message));

// Keep process alive
process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down...'); process.exit(0); });
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err.message); });

server.listen(3000, '0.0.0.0', () => {
  console.log('> Server ready on http://localhost:3000');
});
