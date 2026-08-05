const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

async function main() {
  const pdfPath = path.join(__dirname, '..', 'upload', '356205159.PDF');
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF not found:', pdfPath);
    process.exit(1);
  }
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  console.log('=== META ===');
  console.log('Pages:', data.numpages);
  console.log('Text length:', data.text.length);
  console.log('=== RAW TEXT ===');
  console.log(data.text);
}

main().catch(e => { console.error(e); process.exit(1); });
