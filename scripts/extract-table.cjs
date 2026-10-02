// Standalone table extraction script
// Usage: node extract-table.cjs <pdf-file-path>
// Outputs JSON to stdout
const { extractTableFromPDF } = require('../dist/energisa-table-extractor.cjs');
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
    const result = await Promise.race([
      extractTableFromPDF(buf),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 12000))
    ]);
    process.stdout.write(JSON.stringify(result || { items: [], pisTotal: '', cofinsTotal: '', icmsTotal: '' }));
  } catch(e) {
    process.stdout.write(JSON.stringify({ error: e.message, items: [], pisTotal: '', cofinsTotal: '', icmsTotal: '' }));
  }
  process.exit(0);
})();
