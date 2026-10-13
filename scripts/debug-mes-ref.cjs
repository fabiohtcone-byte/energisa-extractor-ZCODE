const fs = require('fs');
const pdfParse = require('pdf-parse');

const buf = fs.readFileSync('/home/z/my-project/upload/89431905152.PDF');
pdfParse(buf).then(pd => {
  const text = pd.text;
  const flat = text.replace(/\n/g, ' ').replace(/\r/g, ' ');
  const lines = text.split('\n');
  
  const meses = 'Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';
  const numToMonth = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
  };
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  
  // Vencimento check - the pattern used in the extractor
  const venMoneyMatch = flat.match(/(\d{2})\/(\d{2})\/(\d{4})\s*R\$/);
  console.log('venMoneyMatch:', venMoneyMatch ? venMoneyMatch[0] : 'NOT FOUND');
  const venMonth = venMoneyMatch ? parseInt(venMoneyMatch[2], 10) : 0;
  const venYear = venMoneyMatch ? parseInt(venMoneyMatch[3], 10) : 0;
  console.log('Vencimento month:', venMonth, 'year:', venYear);
  
  const isConsistentWithVencimento = (month, year) => {
    if (!venMonth || !venYear) return true;
    const venTotal = venYear * 12 + venMonth;
    const refTotal = year * 12 + month;
    const diff = venTotal - refTotal;
    return diff >= 1 && diff <= 3;
  };
  
  // Strategy 1a
  console.log('\n=== Strategy 1a ===');
  for (const line of lines) {
    const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})\\s*\\d{2}/\\d{2}/\\d{4}\\s*R\\$`, 'i'));
    if (m) console.log('MATCH:', m[0], '→', m[1], '/', m[2]);
  }
  console.log('No match for 1a');
  
  // Strategy 1b
  console.log('\n=== Strategy 1b ===');
  for (const line of lines) {
    const m = line.match(new RegExp(`\\d{2}/\\d{2}/\\d{4}\\s*R\\$\\s*[\\d.,]+\\s*(${meses})\\s*/\\s*(\\d{4})`, 'i'));
    if (m) console.log('MATCH:', m[0].substring(0, 80), '→', m[1], '/', m[2]);
  }
  console.log('No match for 1b');
  
  // Strategy 2
  console.log('\n=== Strategy 2 ===');
  for (const line of lines) {
    if (/VENCIMENTO|NOTA FISCAL|Nº FATURA/i.test(line)) {
      const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'i'));
      if (m) console.log('MATCH:', m[0], '→', m[1], '/', m[2]);
    }
  }
  console.log('No match for 2');
  
  // Strategy 3
  console.log('\n=== Strategy 3 ===');
  for (const line of lines) {
    const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'i'));
    if (m && /\d{2}\/\d{2}\/\d{4}/.test(line)) {
      const monthIdx = Object.values(numToMonth).indexOf(capitalize(m[1]));
      const monthNum = monthIdx + 1;
      console.log('Candidate:', m[0], 'monthNum:', monthNum, 'consistent:', isConsistentWithVencimento(monthNum, parseInt(m[2], 10)));
      if (isConsistentWithVencimento(monthNum, parseInt(m[2], 10))) {
        console.log('MATCH Strategy 3:', m[0]);
      }
    }
  }
  
  // Strategy 4
  console.log('\n=== Strategy 4 ===');
  const allNameMatches = [...flat.matchAll(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'gi'))];
  for (const m of allNameMatches) {
    const start = Math.max(0, m.index - 20);
    const context = flat.slice(start, m.index + m[0].length).toLowerCase();
    const skipContext = /desde|até|a partir|inform|dispon|referência|ref\b/.test(context);
    const monthIdx = Object.values(numToMonth).indexOf(capitalize(m[1]));
    const monthNum = monthIdx + 1;
    const consistent = isConsistentWithVencimento(monthNum, parseInt(m[2], 10));
    console.log('Match:', m[0], '| context test skip:', skipContext, '| consistent:', consistent);
    if (!skipContext && consistent) {
      console.log('  → Would return:', capitalize(m[1]), '/', m[2]);
    }
  }
  
  // Strategy 5
  console.log('\n=== Strategy 5: Leitura Atual ===');
  const lm = flat.match(/Leitura\s+Atual\s*:\s*\d{2}\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i);
  console.log('Leitura Atual match:', lm ? lm[0] : 'NOT FOUND');
  if (lm) console.log('Month:', lm[1], 'Year:', lm[2]);
  
  // Also check Referência: pattern
  console.log('\n=== Referência: pattern ===');
  const refMatch = flat.match(/Referência:\s*(\d{2})\/(\d{4})/i);
  console.log('Referência match:', refMatch ? refMatch[0] : 'NOT FOUND');
  
  // Look at lines around "Setembro / 2026"
  console.log('\n=== Lines with Setembro ===');
  for (let i = 0; i < lines.length; i++) {
    if (/setembro/i.test(lines[i])) {
      console.log(`Line ${i}:`, JSON.stringify(lines[i]));
      if (i > 0) console.log(`Line ${i-1}:`, JSON.stringify(lines[i-1]));
      if (i < lines.length - 1) console.log(`Line ${i+1}:`, JSON.stringify(lines[i+1]));
    }
  }
  
  // Look at lines around "21/10/2026"
  console.log('\n=== Lines with 21/10/2026 ===');
  for (let i = 0; i < lines.length; i++) {
    if (/21\/10\/2026/.test(lines[i])) {
      console.log(`Line ${i}:`, JSON.stringify(lines[i].substring(0, 120)));
    }
  }
}).catch(e => console.error(e));
