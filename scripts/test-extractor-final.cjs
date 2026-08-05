const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// We need to transpile TS first - use tsx
const { execSync } = require('child_process');

async function main() {
  const pdfPath = path.join(__dirname, '..', 'upload', '356205159.PDF');
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  const text = data.text;

  // Write raw text to file for inspection
  fs.writeFileSync(path.join(__dirname, '..', 'upload', 'raw-text.txt'), text);
  console.log('Raw text saved. Length:', text.length);
  console.log('---');
  
  // Now test extraction by calling the API
  console.log('Testing via API call...');
}

main().catch(e => { console.error(e); process.exit(1); });
