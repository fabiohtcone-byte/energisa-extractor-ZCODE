const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project';
const BUILD = path.join(ROOT, '.next');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function sendFile(res, fp, cache) {
  try {
    const d = fs.readFileSync(fp);
    const h = { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' };
    if (cache) h['Cache-Control'] = 'public, max-age=31536000, immutable';
    res.writeHead(200, h);
    res.end(d);
  } catch { res.writeHead(404); res.end('Not found'); }
}

function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const c = [];
    req.on('data', chunk => c.push(chunk));
    req.on('end', () => ok(Buffer.concat(c)));
    req.on('error', fail);
    req.socket.setTimeout(120000);
  });
}

function parseMultipart(buf, boundary) {
  const parts = [], delim = Buffer.from('--' + boundary);
  let s = buf.indexOf(delim);
  if (s === -1) return parts;
  s += delim.length;
  while (true) {
    if (buf[s] === 0x0d && buf[s+1] === 0x0a) s += 2;
    const he = buf.indexOf(Buffer.from('\r\n\r\n'), s);
    if (he === -1) break;
    const hs = buf.slice(s, he).toString();
    const bs = he + 4, nb = buf.indexOf(delim, bs);
    if (nb === -1) break;
    parts.push({
      name: (hs.match(/name="([^"]+)"/) || [])[1] || null,
      filename: (hs.match(/filename="([^"]+)"/) || [])[1] || null,
      body: buf.slice(bs, nb - 2),
    });
    s = nb + delim.length;
    if (buf[s] === 0x2d && buf[s+1] === 0x2d) break;
  }
  return parts;
}

const srv = http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://x').pathname;

    // API: extract PDF
    if (p === '/api/extract-pdf' && req.method === 'POST') {
      const body = await readBody(req);
      const bm = (req.headers['content-type'] || '').match(/boundary=([\w\-]+)/);
      if (!bm) return json(res, { error: 'invalid' }, 400);
      const parts = parseMultipart(body, bm[1]);
      const fp = parts.find(x => x.name === 'file' && x.body.length > 0);
      if (!fp) return json(res, { error: 'no file' }, 400);
      let pd;
      try { pd = (await require('pdf-parse').default(fp.body)) || (await require('pdf-parse')(fp.body)); } catch(e) { return json(res, {error:'PDF: '+e.message}, 500); }
      // pdf-parse returns the data directly when using await
      if (!pd || !pd.text) {
        // try again with direct call
        try {
          const pp = require('pdf-parse');
          pd = await pp(fp.body);
        } catch(e2) { return json(res, {error:'PDF2: '+e2.message}, 500); }
      }
      let tableData = null;
      try {
        const { extractTableFromPDF } = require('./dist/energisa-table-extractor.cjs');
        tableData = await Promise.race([extractTableFromPDF(fp.body), new Promise((_,r) => setTimeout(() => r(new Error('timeout')), 10000))]);
      } catch(e) { console.log('Table skip:', e.message); }
      const text = pd.text;
      if (!text || !text.trim()) return json(res, { error: 'Sem texto' }, 422);
      const { extractEnergisaData } = require('./dist/energisa-extractor.cjs');
      const ext = extractEnergisaData(text, tableData);
      const vals = Object.values(ext), cnt = vals.filter(v => v !== '').length;
      return json(res, { success: true, data: ext, stats: { extractedCount: cnt, totalFields: vals.length, extractionRate: Math.round(cnt/vals.length*100), pageCount: pd.numpages, tableItems: tableData?.items?.length ?? 0 } });
    }

    // API: export excel
    if (p === '/api/export-excel' && req.method === 'POST') {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body.toString()); } catch { return json(res, {error:'bad json'}, 400); }
      const { invoices } = parsed;
      if (!invoices || !Array.isArray(invoices) || !invoices.length) return json(res, {error:'empty'}, 400);
      const XLSX = require('xlsx');
      const { FIELD_LABELS } = require('./dist/energisa-extractor.cjs');
      const fk = Object.keys(FIELD_LABELS);
      const hdrs = [...fk.map(k => FIELD_LABELS[k]), 'Gerência', 'LOCINS'];
      const rows = invoices.map(inv => [...fk.map(k => inv[k] || ''), '', '']);
      const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows]);
      ws['!cols'] = hdrs.map(() => ({ wch: 28 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Faturas ENERGISA');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.writeHead(200, { 'Content-Type': MIME['.xlsx'], 'Content-Disposition': 'attachment; filename="faturas_energisa.xlsx"' });
      res.end(buf);
      return;
    }

    // Static _next/*
    if (p.startsWith('/_next/')) return sendFile(res, path.join(BUILD, p.replace('/_next', '')), true);

    // Page /
    if (p === '/' || p === '/index.html') return sendFile(res, path.join(BUILD, 'server', 'app', 'index.html'), false);

    // Favicon
    if (p === '/favicon.ico') return sendFile(res, path.join(ROOT, 'public', p), false);

    res.writeHead(404); res.end('404');
  } catch (e) {
    console.error('Err:', e.message);
    if (!res.headersSent) json(res, { error: e.message }, 500);
  }
});

process.on('SIGTERM', () => console.log('SIGTERM'));
process.on('SIGHUP', () => console.log('SIGHUP'));

srv.listen(3000, '0.0.0.0', () => console.log('> Ready on :3000'));
