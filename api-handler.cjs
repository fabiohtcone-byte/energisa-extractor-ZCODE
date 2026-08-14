// Short-lived Node.js process for API calls
// Called by the C server to handle PDF extraction and Excel export
// Exits after handling one request

const fs = require('fs');
const path = require('path');

async function main() {
  const mode = process.argv[2]; // 'extract' or 'excel'
  const inputFile = process.argv[3]; // temp file with request body
  const outputFile = process.argv[4]; // temp file for response

  try {
    if (mode === 'extract') {
      // Read multipart body from stdin/file
      const body = fs.readFileSync(inputFile);
      const ct = process.argv[5] || '';
      const bm = ct.match(/boundary=([\w\-]+)/);
      if (!bm) { fs.writeFileSync(outputFile, JSON.stringify({error:'invalid'})); return; }

      // Parse multipart
      const parts = [];
      const delim = Buffer.from('--' + bm[1]);
      let s = body.indexOf(delim);
      if (s === -1) { fs.writeFileSync(outputFile, JSON.stringify({error:'no boundary'})); return; }
      s += delim.length;
      while (true) {
        if (body[s] === 0x0d && body[s+1] === 0x0a) s += 2;
        const he = body.indexOf(Buffer.from('\r\n\r\n'), s);
        if (he === -1) break;
        const hs = body.slice(s, he).toString();
        const bs = he + 4, nb = body.indexOf(delim, bs);
        if (nb === -1) break;
        parts.push({
          name: (hs.match(/name="([^"]+)"/) || [])[1] || null,
          body: body.slice(bs, nb - 2),
        });
        s = nb + delim.length;
        if (body[s] === 0x2d && body[s+1] === 0x2d) break;
      }

      const fp = parts.find(x => x.name === 'file' && x.body.length > 0);
      if (!fp) { fs.writeFileSync(outputFile, JSON.stringify({error:'no file'})); return; }

      const pdfParse = require('pdf-parse');
      const pd = await pdfParse(fp.body);

      let td = null;
      try {
        const m = require('./dist/energisa-table-extractor.cjs');
        td = await Promise.race([
          m.extractTableFromPDF(fp.body),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000))
        ]);
      } catch(e) {}

      if (!pd.text || !pd.text.trim()) {
        fs.writeFileSync(outputFile, JSON.stringify({error:'Sem texto'}));
        return;
      }

      const { extractEnergisaData } = require('./dist/energisa-extractor.cjs');
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
      fs.writeFileSync(outputFile, JSON.stringify(result));

    } else if (mode === 'excel') {
      const body = fs.readFileSync(inputFile, 'utf8');
      const parsed = JSON.parse(body);
      const { invoices } = parsed;
      if (!invoices || !Array.isArray(invoices) || !invoices.length) {
        fs.writeFileSync(outputFile, JSON.stringify({error:'empty'}));
        return;
      }

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
      fs.writeFileSync(outputFile, 'EXCEL:' + outputFile + '.xlsx');
      fs.writeFileSync(outputFile + '.xlsx', buf);
    }
  } catch(e) {
    fs.writeFileSync(outputFile, JSON.stringify({error: e.message}));
  }
}

main().then(() => process.exit(0)).catch(e => {
  fs.writeFileSync(process.argv[4] || '/tmp/api-err', JSON.stringify({error: e.message}));
  process.exit(1);
});
