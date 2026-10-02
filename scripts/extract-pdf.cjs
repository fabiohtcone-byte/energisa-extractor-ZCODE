// Standalone extraction script
// Usage: node extract-pdf.cjs <pdf-file-path>
// Outputs JSON to stdout
// This runs in a SEPARATE process so if pdf-parse/V8 crashes, the server stays alive

const { extractEnergisaData } = require('../dist/energisa-extractor.cjs');
const { extractTableFromPDF } = require('../dist/energisa-table-extractor.cjs');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const pdfPath = process.argv[2];
if (!pdfPath) {
  process.stdout.write(JSON.stringify({ error: 'no path' }));
  process.exit(0);
}

(async () => {
  try {
    const buf = fs.readFileSync(path.resolve(pdfPath));
    
    // Text extraction with timeout
    const pd = await Promise.race([
      pdfParse(buf),
      new Promise((_, r) => setTimeout(() => r(new Error('pdf-parse timeout')), 10000))
    ]);
    
    if (!pd.text || !pd.text.trim()) {
      process.stdout.write(JSON.stringify({ error: 'Sem texto', status: 422 }));
      process.exit(0);
    }
    
    // Table extraction with timeout
    let td = null;
    try {
      td = await Promise.race([
        extractTableFromPDF(buf),
        new Promise((_, r) => setTimeout(() => r(new Error('table timeout')), 10000))
      ]);
      if (!td || !td.items || td.items.length === 0) td = null;
    } catch (e) {
      td = null;
    }
    
    // Field extraction
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
    process.stdout.write(JSON.stringify({ error: e.message || 'Unknown error' }));
  }
  process.exit(0);
})();
