const fs = require('fs');
const pdfParse = require('pdf-parse');

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/144378605167.PDF');
  const data = await pdfParse(buf);
  const lines = data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Debug specific patterns
  for (let i = 0; i < lines.length; i++) {
    if (/ENERGISA/i.test(lines[i])) console.log(i + ': ENERGISA -> ' + lines[i]);
    if (/Classifica/i.test(lines[i])) console.log(i + ': CLASSIF -> ' + lines[i]);
    if (/NOTA FISCAL/i.test(lines[i])) console.log(i + ': NF -> ' + lines[i]);
    if (/VENCIMENTO/i.test(lines[i])) console.log(i + ': VENC -> ' + lines[i]);
    if (/ICMS/i.test(lines[i])) console.log(i + ': ICMS -> ' + lines[i]);
    if (/Grandezas/i.test(lines[i])) console.log(i + ': GRAND -> ' + lines[i]);
    if (/Demanda (?:ponta|fora)/i.test(lines[i])) console.log(i + ': DEMANDA -> ' + lines[i]);
    if (lines[i].includes('PIS') && !lines[i].includes('PIS/')) console.log(i + ': PIS -> ' + lines[i]);
    if (/COFINS/i.test(lines[i])) console.log(i + ': COFINS -> ' + lines[i]);
    if (/chave de acesso/i.test(lines[i])) console.log(i + ': CHAVE -> ' + lines[i]);
    if (/KWH/i.test(lines[i])) console.log(i + ': KWH -> ' + lines[i]);
    if (/TOTAL A PAGAR/i.test(lines[i])) console.log(i + ': TOTAL -> ' + lines[i]);
  }
  
  // Show lines 85-100
  console.log('\n--- Lines 85-100 ---');
  for (let i = 85; i < 100; i++) {
    if (lines[i]) console.log(i + ': ' + lines[i]);
  }
  
  // Show lines around Grandezas
  const gIdx = lines.findIndex(l => /Grandezas/i.test(l));
  console.log('\n--- Grandezas section ---');
  for (let i = gIdx; i < Math.min(gIdx + 20, lines.length); i++) {
    console.log(i + ': ' + lines[i]);
  }
}
main().catch(console.error);
