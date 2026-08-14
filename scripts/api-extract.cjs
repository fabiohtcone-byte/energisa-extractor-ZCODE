const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project';

let buf = fs.readFileSync(0); // read stdin
const ct = process.env.CONTENT_TYPE || '';
const bm = ct.match(/boundary=([\w\-]+)/);
if (!bm) { console.log(JSON.stringify({error:'invalid'})); process.exit(1); }

const parts = [];
const delim = Buffer.from('--' + bm[1]);
let s = buf.indexOf(delim);
if (s === -1) { console.log(JSON.stringify({error:'no boundary'})); process.exit(1); }
s += delim.length;
while (true) {
  if (buf[s] === 0x0d && buf[s+1] === 0x0a) s += 2;
  const he = buf.indexOf(Buffer.from('\r\n\r\n'), s);
  if (he === -1) break;
  const hs = buf.slice(s, he).toString();
  const bs = he + 4;
  const nb = buf.indexOf(delim, bs);
  if (nb === -1) break;
  parts.push({
    name: (hs.match(/name="([^"]+)"/) || [])[1] || null,
    filename: (hs.match(/filename="([^"]+)"/) || [])[1] || null,
    body: buf.slice(bs, nb - 2)
  });
  s = nb + delim.length;
  if (buf[s] === 0x2d && buf[s+1] === 0x2d) break;
}

const fp = parts.find(x => x.name === 'file' && x.body.length > 0);
if (!fp) { console.log(JSON.stringify({error:'no file'})); process.exit(1); }

(async () => {
  try {
    const pdfParse = require('pdf-parse');
    const pd = await pdfParse(fp.body);
    let td = null;
    try {
      const m = require(path.join(ROOT, 'dist/energisa-table-extractor.cjs'));
      td = await Promise.race([
        m.extractTableFromPDF(fp.body),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000))
      ]);
    } catch(e) {}
    if (!pd.text || !pd.text.trim()) {
      console.log(JSON.stringify({error:'Sem texto'})); process.exit(1);
    }
    const { extractEnergisaData } = require(path.join(ROOT, 'dist/energisa-extractor.cjs'));
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
        tableItems: td?.items?.length ?? 0
      }
    };
    process.stdout.write(JSON.stringify(result));
  } catch (e) {
    console.log(JSON.stringify({error: e.message})); process.exit(1);
  }
})();
