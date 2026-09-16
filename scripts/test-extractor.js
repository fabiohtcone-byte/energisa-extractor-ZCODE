const fs = require('fs');
const path = require('path');

async function testExtractor() {
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync('/home/z/my-project/upload/33857.PDF');
  const pdfData = await pdfParse(buffer);
  const rawText = pdfData.text;
  
  // Load the compiled extractor
  const extractorPath = path.join('/home/z/my-project', 'dist', 'energisa-extractor.cjs');
  const extractor = require(extractorPath);
  
  const result = extractor.extractEnergisaData(rawText);
  
  console.log('=== Extraction Results ===');
  console.log('MesReferencia:', result.MesReferencia);
  console.log('AnoLeitura:', result.AnoLeitura);
  console.log('Vencimento:', result.Vencimento);
  console.log('UC:', result.UC);
  console.log('Cidade:', result.Cidade);
  console.log('NotaFiscal:', result.NotaFiscal);
  
  // Also manually trace the MesReferencia logic
  const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  const flat = lines.join(' ');
  
  console.log('\n=== Manual Trace ===');
  const meses = 'Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  
  // Strategy 1
  console.log('--- Strategy 1 ---');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})\\s*\\d{2}/\\d{2}/\\d{4}\\s*R\\$`, 'i'));
    if (m) {
      console.log(`  Line ${i}: Strategy 1 MATCH: ${capitalize(m[1])} / ${m[2]}`);
      console.log(`  Text: ${lines[i]}`);
    }
  }
  
  // Strategy 2
  console.log('--- Strategy 2 ---');
  for (let i = 0; i < lines.length; i++) {
    if (/VENCIMENTO|NOTA FISCAL|Nº FATURA/i.test(lines[i])) {
      const m = lines[i].match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'i'));
      if (m) console.log(`  Line ${i}: Strategy 2 MATCH: ${capitalize(m[1])} / ${m[2]}`);
    }
  }
  
  // Strategy 3
  console.log('--- Strategy 3 ---');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'i'));
    if (m && /\d{2}\/\d{2}\/\d{4}/.test(lines[i])) {
      console.log(`  Line ${i}: Strategy 3 MATCH: ${capitalize(m[1])} / ${m[2]}`);
      console.log(`  Text: ${lines[i]}`);
    }
  }
  
  // Strategy 4
  console.log('--- Strategy 4 (flat) ---');
  const allNameMatches = [...flat.matchAll(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'gi'))];
  for (const m of allNameMatches) {
    const start = Math.max(0, m.index - 15);
    const context = flat.slice(start, m.index + m[0].length).toLowerCase();
    const skip = /desde|até|a partir|inform|dispon/.test(context);
    console.log(`  Match: ${m[0]} at index ${m.index} skip=${skip} context="${context}"`);
    if (!skip) {
      console.log(`  → Would return: ${capitalize(m[1])} / ${m[2]}`);
      break;
    }
  }
  
  // Strategy 5
  console.log('--- Strategy 5 (numeric near vencimento) ---');
  const venDate = flat.match(/(\d{2})\/(\d{2})\/(\d{4})\s*R\$/);
  if (venDate) {
    console.log(`  Vencimento date: ${venDate[0]}, year: ${venDate[3]}`);
    const venIdx = flat.indexOf(venDate[0]);
    const region = flat.slice(Math.max(0, venIdx - 100), venIdx + 50);
    const numM = region.match(/(\d{2})\s*\/\s*(\d{4})/);
    const numToMonth = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
    };
    if (numM) {
      console.log(`  Numeric match: ${numM[0]}, month: ${numToMonth[numM[1]]}, year match: ${numM[2] === venDate[3]}`);
    }
  }
  
  // Strategy 6
  console.log('--- Strategy 6 (first numeric MM/YYYY) ---');
  const numToMonth = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
  };
  const numMatch = flat.match(/(\d{2})\s*[\/]\s*(\d{4})/);
  if (numMatch) {
    console.log(`  First numeric: ${numMatch[0]}, isMonth: ${!!numToMonth[numMatch[1]]}`);
  }
}

testExtractor().catch(e => console.error(e));
