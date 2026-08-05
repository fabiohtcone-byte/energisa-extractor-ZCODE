import fs from 'fs';
import { extractEnergisaData } from '../src/lib/energisa-extractor';

const rawText = fs.readFileSync('/home/z/my-project/scripts/test-gdi-text.txt', 'utf8');
const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);

console.log('=== ALL LINES WITH INDEX ===');
lines.forEach((l, i) => {
  if (
    /GDI|gdi|injet/i.test(l) ||
    /^1\.135,00$/i.test(l) ||
    /^453,00$/i.test(l) ||
    /^-110,49/i.test(l) ||
    /^-44,09/i.test(l) ||
    /chave de acesso/i.test(l)
  ) {
    console.log(`  ${String(i).padStart(3)}: [MATCH] ${l}`);
  }
});

console.log('\n=== GDI AREA (lines 40-80) ===');
lines.slice(40, 85).forEach((l, i) => {
  console.log(`  ${String(40 + i).padStart(3)}: ${l}`);
});

console.log('\n=== EXTRACTION TEST ===');
const result = extractEnergisaData(rawText);
console.log('UC:', result.UC);
console.log('GDI oUC Qtd:', result.EnergiaAtvInjetadaGDIoUC_Qtd || '(vazio)');
console.log('GDI oUC Valor:', result.EnergiaAtvInjetadaGDIoUC_Valor || '(vazio)');
console.log('GDI mUC Qtd:', result.EnergiaAtvInjetadaGDImUC_Qtd || '(vazio)');
console.log('GDI mUC Valor:', result.EnergiaAtvInjetadaGDImUC_Valor || '(vazio)');
