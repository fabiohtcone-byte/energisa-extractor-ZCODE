const line = 'Fevereiro / 202621/03/2026R$ 462,62';
const meses = 'Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';

// Strategy 1 regex
const re1 = new RegExp(`(${meses})\\s*/\\s*(\\d{4})\\s*\\d{2}/\\d{2}/\\d{4}\\s*R\\$`, 'i');
const m1 = line.match(re1);
console.log('Strategy 1 match:', m1 ? `${m1[1]} / ${m1[2]}` : 'NO MATCH');

// Strategy 2 regex
const test2 = /VENCIMENTO|NOTA FISCAL|Nº FATURA/i.test(line);
console.log('Strategy 2 VENCIMENTO test:', test2);

// Strategy 3 regex
const re3 = new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'i');
const m3 = line.match(re3);
const hasDate = /\d{2}\/\d{2}\/\d{4}/.test(line);
console.log('Strategy 3 month match:', m3 ? `${m3[1]} / ${m3[2]}` : 'NO MATCH', 'has date:', hasDate);

// Now test in flat context with 'Desde'
const flat = 'em kWh 1000 -Desde dezembro/2025, sua Carta Demonstr Fevereiro / 202621/03/2026R$ 462,62';
const re4 = new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'gi');
const allMatches = [...flat.matchAll(re4)];
console.log('\nAll matches in flat:');
for (const m of allMatches) {
  const start = Math.max(0, m.index - 15);
  const context = flat.slice(start, m.index + m[0].length).toLowerCase();
  console.log('  Match:', m[0], 'context:', context, 'skip(desde)?', /desde|até|a partir|inform|dispon/.test(context));
}

// Test the actual extractor on the PDF
const fs = require('fs');
const pdfParse = require('pdf-parse');
const buffer = fs.readFileSync('/home/z/my-project/upload/33857.PDF');
pdfParse(buffer).then(data => {
  const lines = data.text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('\n--- Strategy 1 test on all lines ---');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re1);
    if (m) {
      console.log(`Line ${i}: MATCHED! ${m[1]} / ${m[2]}`);
      console.log(`  Line text: ${lines[i]}`);
    }
  }
  
  console.log('\n--- Strategy 3 test on all lines ---');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re3);
    if (m && /\d{2}\/\d{2}\/\d{4}/.test(lines[i])) {
      console.log(`Line ${i}: MATCHED! ${m[1]} / ${m[2]}`);
      console.log(`  Line text: ${lines[i]}`);
    }
  }
});
