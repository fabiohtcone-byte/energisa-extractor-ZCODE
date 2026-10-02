const http = require('http');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { extractEnergisaData } = require('./dist/energisa-extractor.cjs');

function json(res, data, s) { res.writeHead(s||200,{'Content-Type':'application/json'}); res.end(JSON.stringify(data)); }
function readBody(req) { return new Promise((ok,f) => { const c=[]; req.on('data',chunk=>c.push(chunk)); req.on('end',()=>ok(Buffer.concat(c))); req.on('error',f); }); }

const srv = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  try {
    if (p === '/health') return json(res, {ok:true});
    if (p === '/extract' && req.method === 'POST') {
      const body = await readBody(req);
      const ct = req.headers['content-type'] || '';
      let fileBuffer = body;
      if (ct.includes('multipart/form-data')) {
        const bm = ct.match(/boundary=([\w\-]+)/);
        if (!bm) return json(res, {error:'no boundary'},400);
        const delim = Buffer.from('--' + bm[1]);
        let s = body.indexOf(delim) + delim.length;
        if (body[s]===0x0d&&body[s+1]===0x0a) s += 2;
        const he = body.indexOf(Buffer.from('\r\n\r\n'),s);
        if (he===-1) return json(res,{error:'bad'},400);
        const bs = he+4, nb = body.indexOf(delim,bs);
        if (nb===-1) return json(res,{error:'no end'},400);
        fileBuffer = body.slice(bs,nb-2);
      }
      const pd = await pdfParse(fileBuffer);
      const ext = extractEnergisaData(pd.text, null);
      return json(res, {success:true, data:ext, stats:{fields:Object.values(ext).filter(v=>v!=='').length}});
    }
    res.writeHead(404); res.end();
  } catch(e) { console.error('ERR:',e.message); if(!res.headersSent) json(res,{error:e.message},500); }
});
srv.listen(3000, () => console.log('> Ready :3000'));
process.on('uncaughtException', e => console.error('UNCAUGHT:', e.message));
