const fs = require('fs');
const pdfParse = require('pdf-parse');

// Import the extractor - compile TS first via bun
async function main() {
  const { extractEnergisaData } = await import('/home/z/my-project/src/lib/energisa-extractor.ts');
  
  const files = fs.readdirSync('/home/z/my-project/upload').filter(f => f.endsWith('.PDF'));
  
  for (const file of files.slice(0, 5)) {
    const buf = fs.readFileSync('/home/z/my-project/upload/' + file);
    const data = await pdfParse(buf);
    const result = extractEnergisaData(data.text);
    
    const filled = Object.entries(result).filter(([k,v]) => v !== '');
    const empty = Object.entries(result).filter(([k,v]) => v === '');
    
    console.log('\n===== ' + file + ' (' + filled.length + '/' + Object.keys(result).length + ' campos) =====');
    console.log('--- EXTRAÍDOS ---');
    for (const [k,v] of filled) {
      console.log('  ' + k + ': ' + v);
    }
    console.log('--- NÃO EXTRAÍDOS ---');
    for (const [k] of empty) {
      console.log('  ' + k);
    }
  }
}
main().catch(console.error);
