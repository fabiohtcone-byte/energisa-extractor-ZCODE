const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project';
const BUILD = path.join(ROOT, '.next');
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2',
  '.json':'application/json; charset=utf-8',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
function sendFile(res, fp, cache) {
  try {
    const d = fs.readFileSync(fp);
    const h = { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' };
    if (cache) h['Cache-Control'] = 'public, max-age=31536000, immutable';
    res.writeHead(200, h); res.end(d);
  } catch { res.writeHead(404); res.end('Not found'); }
}
function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((ok, fail) => {
    const c = []; req.on('data', chunk => c.push(chunk));
    req.on('end', () => ok(Buffer.concat(c))); req.on('error', fail);
    req.socket.setTimeout(120000);
  });
}
function parseMultipart(buf, boundary) {
  const parts = [], delim = Buffer.from('--' + boundary);
  let s = buf.indexOf(delim); if (s === -1) return parts; s += delim.length;
  while (true) {
    if (buf[s] === 0x0d && buf[s+1] === 0x0a) s += 2;
    const he = buf.indexOf(Buffer.from('\r\n\r\n'), s); if (he === -1) break;
    const hs = buf.slice(s, he).toString(); const bs = he + 4, nb = buf.indexOf(delim, bs); if (nb === -1) break;
    parts.push({ name: (hs.match(/name="([^"]+)"/) || [])[1] || null, filename: (hs.match(/filename="([^"]+)"/) || [])[1] || null, body: buf.slice(bs, nb - 2) });
    s = nb + delim.length; if (buf[s] === 0x2d && buf[s+1] === 0x2d) break;
  }
  return parts;
}

// Keep-alive: respond to health checks so container stays alive
let lastReq = Date.now();
setInterval(() => { if (Date.now() - lastReq > 300000) process.exit(1); }, 60000);

const srv = http.createServer(async (req, res) => {
  lastReq = Date.now();
  try {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/api/extract-pdf' && req.method === 'POST') {
      const body = await readBody(req);
      const bm = (req.headers['content-type'] || '').match(/boundary=([\w\-]+)/);
      if (!bm) return json(res, { error: 'invalid' }, 400);
      const parts = parseMultipart(body, bm[1]);
      const fp = parts.find(x => x.name === 'file' && x.body.length > 0);
      if (!fp) return json(res, { error: 'no file' }, 400);
      const pdfParse = require('pdf-parse');
      const pd = await pdfParse(fp.body);
      let td = null;
      try { const m = require('./dist/energisa-table-extractor.cjs'); td = await Promise.race([m.extractTableFromPDF(fp.body), new Promise((_,r) => setTimeout(() => r(new Error('t')), 10000))]); } catch(e) {}
      if (!pd.text || !pd.text.trim()) return json(res, { error: 'Sem texto' }, 422);
      const { extractEnergisaData } = require('./dist/energisa-extractor.cjs');
      const ext = extractEnergisaData(pd.text, td);
      const vals = Object.values(ext), cnt = vals.filter(v => v !== '').length;
      return json(res, { success: true, data: ext, stats: { extractedCount: cnt, totalFields: vals.length, extractionRate: Math.round(cnt/vals.length*100), pageCount: pd.numpages, tableItems: td?.items?.length ?? 0 } });
    }
    if (p === '/api/export-excel' && req.method === 'POST') {
      const body = await readBody(req); let parsed;
      try { parsed = JSON.parse(body.toString()); } catch { return json(res, {error:'bad json'}, 400); }
      const { invoices } = parsed; if (!invoices || !Array.isArray(invoices) || !invoices.length) return json(res, {error:'empty'}, 400);
      const XLSX = require('xlsx'); const { FIELD_LABELS } = require('./dist/energisa-extractor.cjs');
      const fk = Object.keys(FIELD_LABELS); const hdrs = [...fk.map(k => FIELD_LABELS[k]), 'Gerência', 'LOCINS'];
      const rows = invoices.map(inv => [...fk.map(k => inv[k] || ''), '', '']);
      const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows]); ws['!cols'] = hdrs.map(() => ({ wch: 28 }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Faturas ENERGISA');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.writeHead(200, { 'Content-Type': MIME['.xlsx'], 'Content-Disposition': 'attachment; filename="faturas_energisa.xlsx"' }); res.end(buf); return;
    }
    if (p.startsWith('/_next/')) return sendFile(res, path.join(BUILD, p.replace('/_next', '')), true);
    if (p === '/' || p === '/index.html') return sendFile(res, path.join(BUILD, 'server', 'app', 'index.html'), false);
    res.writeHead(404); res.end('404');
  } catch (e) { if (!res.headersSent) json(res, { error: e.message }, 500); }
});

// Ignore all signals - never exit
['SIGTERM','SIGHUP','SIGINT','SIGUSR1','SIGUSR2'].forEach(s => process.on(s, () => {}));

srv.listen(3000, '0.0.0.0', () => console.log('> Ready on :3000'));

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => { console.error('uncaught:', err.message); });
process.on('unhandledRejection', (err) => { console.error('unhandled:', err?.message || err); });