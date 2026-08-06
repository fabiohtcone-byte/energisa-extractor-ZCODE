const { extractEnergisaData } = require('/home/z/my-project/dist/energisa-extractor.cjs');
const fs = require('fs');

// Test 1: Original test text (UC 43.210.051-68, 1 oUC + 1 mUC)
const text1 = fs.readFileSync('/home/z/my-project/scripts/test-gdi-text.txt', 'utf8');
const r1 = extractEnergisaData(text1);
console.log('=== Test 1 (UC 43.210.051-68, 1oUC+1mUC) ===');
console.log('UC:', r1.UC);
console.log('oUC Qtd:', r1.EnergiaAtvInjetadaGDIoUC_Qtd, '(esperado: 1.135,00)');
console.log('oUC Valor:', r1.EnergiaAtvInjetadaGDIoUC_Valor, '(esperado: -73,68)');
console.log('mUC Qtd:', r1.EnergiaAtvInjetadaGDImUC_Qtd, '(esperado: 453,00)');
console.log('mUC Valor:', r1.EnergiaAtvInjetadaGDImUC_Valor);
console.log();

// Test 2: 1 oUC + 2 mUC (UC 131.752.051-07)
const text2 = `DANF3E - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA
UC 131.752.051-07
Energia Atv Injetada GDI oUC 6/2026 mPT
Energia Atv Injetada GDI mUC 1/2026 mPT
Energia Atv Injetada GDI mUC 12/2025 mPT
Consumo em kWh
0,986600
0,986600
0,986600
-73,68
-37,08
-45,75
chave de acesso:
757,00
470,00
381,00
Importante: seu número
TOTAL A PAGAR
R$ 500,00`;
const r2 = extractEnergisaData(text2);
console.log('=== Test 2 (UC 131.752.051-07, 1oUC+2mUC) ===');
console.log('UC:', r2.UC);
console.log('oUC Qtd:', r2.EnergiaAtvInjetadaGDIoUC_Qtd, '(esperado: 757,00)');
console.log('oUC Valor:', r2.EnergiaAtvInjetadaGDIoUC_Valor, '(esperado: -73,68)');
console.log('mUC Qtd:', r2.EnergiaAtvInjetadaGDImUC_Qtd, '(esperado: 851,00)');
console.log('mUC Valor:', r2.EnergiaAtvInjetadaGDImUC_Valor, '(esperado: -82,83)');
