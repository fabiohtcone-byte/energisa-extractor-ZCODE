const http = require('http');
const fs = require('fs');

// Minimal test server that mirrors what app.cjs does
function readBody(req) {
  return new Promise((ok, fail) => {
    const c = []; req.on('data', chunk => c.push(chunk));
    req.on('end', () => ok(Buffer.concat(c))); req.on('error', fail);
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

const srv = http.createServer(async (req, res) => {
  console.log('Request:', req.method, req.url, 'Content-Type:', req.headers['content-type']?.substring(0, 80));
  if (req.url === '/api/extract-pdf' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      console.log('Body received:', body.length, 'bytes');
      const bm = (req.headers['content-type'] || '').match(/boundary=([\w\-]+)/);
      console.log('Boundary match:', bm ? bm[1] : 'NONE');
      if (!bm) { res.writeHead(400); res.end('no boundary'); return; }
      const parts = parseMultipart(body, bm[1]);
      console.log('Parts:', parts.length);
      const fp = parts.find(x => x.name === 'file' && x.body.length > 0);
      if (!fp) { res.writeHead(400); res.end('no file'); return; }
      console.log('File:', fp.filename, fp.body.length, 'bytes');
      
      const pdfParse = require('pdf-parse');
      const { extractEnergisaData } = require('./dist/energisa-extractor.cjs');
      const pd = await pdfParse(fp.body);
      const ext = extractEnergisaData(pd.text, null);
      console.log('Extraction done:', ext.Concessionaria, ext.ConsumoTotal, ext.PIS, ext.COFINS, ext.ICMS);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: ext }));
    } catch(e) {
      console.error('Error:', e.message, e.stack?.substring(0, 200));
      res.writeHead(500); res.end(e.message);
    }
  } else {
    res.writeHead(404); res.end('not found');
  }
});

srv.listen(3001, () => console.log('Debug server on :3001'));
