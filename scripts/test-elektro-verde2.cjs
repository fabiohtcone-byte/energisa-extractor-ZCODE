// Test script to debug Elektro Group A HORÁRIA VERDE extraction
// Simulates more realistic pdf-parse output from Elektro invoices
const { extractEnergisaData } = require('../dist/energisa-extractor.cjs');

// More realistic text simulating what pdf-parse produces from an Elektro HORÁRIA VERDE invoice
// Elektro invoices often have the "Grandezas Contratadas" section with demand info
// and consumption in the "Itens da Fatura" section
const elektroVerdeText2 = `
ELEKTRO
DISTRIBUIDORA DE ENERGIA
R Baldomero Leituga, 2032 - Jd Primavera
CEP: 79610-270 - Tres Lagoas  (Ms) - MS
CNPJ 02.328.280/0002-78
1.818.189.045-27
Classificação: MTV-MOD.TARIFÁRIA HORÁRIA VERDE / A4  SERVIÇO PÚBLICO
HORÁRIA VERDE
Agosto / 2025
21/09/2025
R$ 8.277,66
NOTA FISCAL Nº: 011.736.844 - Série: 002
DATA DE EMISSÃO:31/08/2025
Itens da Fatura
Quant Unid Preço Unit. Valor (R$) PIS/COFINS (R$) ICMS (R$) ICMS (%) (R$) Tarifa
Consumo em kWh - Ponta
KWH
1.346
0,617830
822,70
Consumo em kWh - Fora Ponta
KWH
12.929
0,400304
5.171,60
Energia Reativa Exced em KWh - Fponta
UN
79,68
0,357120
28,53
Demanda de Potência Medida - Fora Ponta
KW
37,00
60,672800
2.254,83
TOTAL:8277,66
Grandezas Contratadas
Demanda Todos os Período - kW
37
Tributo
Base de Cálc. Alíquota(%) Valor(R$)
PIS
5.013,01 1,65 82,72
COFINS
5.013,01 7,60 381,15
ICMS
5.013,01 18,00 902,34
`;

console.log('=== Testing Elektro Group A HORÁRIA VERDE extraction (realistic text) ===\n');

// Test without table data
console.log('--- WITHOUT table data ---');
const result = extractEnergisaData(elektroVerdeText2, null);
console.log('UC:', result.UC);
console.log('Concessionaria:', result.Concessionaria);
console.log('ModalidadeTarifaria:', result.ModalidadeTarifaria);
console.log('Subgrupo:', result.Subgrupo);
console.log('ConsumoPonta:', result.ConsumoPonta, '(expected: 1.346)');
console.log('ConsumoForaPonta:', result.ConsumoForaPonta, '(expected: 12.929)');
console.log('ConsumoTotal:', result.ConsumoTotal);
console.log('DemandaContratadaPonta:', result.DemandaContratadaPonta, '(expected: 37)');
console.log('DemandaContratadaForaPonta:', result.DemandaContratadaForaPonta, '(expected: 37)');
console.log('DemandaMedidaPonta:', result.DemandaMedidaPonta);
console.log('DemandaMedidaForaPonta:', result.DemandaMedidaForaPonta);
console.log('ValorConsumoPonta:', result.ValorConsumoPonta);
console.log('ValorConsumoForaPonta:', result.ValorConsumoForaPonta);
console.log('ValorTotal:', result.ValorTotal);

// Also test with common pdf-parse garbled format where demand and consumption values 
// are merged with labels
console.log('\n=== Testing with pdf-parse garbled format ===');
const elektroGarbled = `
ELEKTRO
1.818.189.045-27
Classificação: MTV-MOD.TARIFÁRIA HORÁRIA VERDE / A4  SERVIÇO 
HORÁRIA VERDE
Agosto / 2025
21/09/2025
R$ 8.277,66
NOTA FISCAL Nº: 011.736.844 - Série: 002
Demanda Todos os Período - kW
37
1.095,68
Demanda fora ponta - kW
Consumo em kWh - Ponta
Consumo em kWh - Fora Ponta
Demanda de Potência Medida - Fora Ponta
Itens da Fatura
QuantUnidPreço Unit.Valor (R$)PIS/COFINS (R$)ICMS (R$)ICMS (%)(R$)Tarifa
1.346KWH0,61783822,70
12.929KWH0,400305.171,60
79,68UN0,3571228,53
37,00KW60,67282.254,83
TOTAL:8277,66
Grandezas Contratadas
Demanda Todos os Período - kW 37
`;

const result2 = extractEnergisaData(elektroGarbled, null);
console.log('ConsumoPonta:', result2.ConsumoPonta, '(expected: 1.346)');
console.log('ConsumoForaPonta:', result2.ConsumoForaPonta, '(expected: 12.929)');
console.log('ConsumoTotal:', result2.ConsumoTotal);
console.log('DemandaContratadaPonta:', result2.DemandaContratadaPonta, '(expected: 37)');
console.log('DemandaContratadaForaPonta:', result2.DemandaContratadaForaPonta, '(expected: 37)');

// Test with W90 compressed data format (like Energisa)
console.log('\n=== Testing with W90 compressed format ===');
const elektroW90 = `
ELEKTRO
1.818.189.045-27
Classificação: MTV-MOD.TARIFÁRIA HORÁRIA VERDE / A4  SERVIÇO 
HORÁRIA VERDE
Demanda TUSDG - kW
W901818189045Ponta
Energia ativa em kWh
101346,001000,000
W901818189045Fora Ponta
Energia ativa em kWh
1012929,0010000,000
Agosto / 2025
21/09/2025
R$ 8.277,66
NOTA FISCAL Nº: 011.736.844 - Série: 002
37Demanda Todos os Período - kW
Consumo em kWh - Ponta
Consumo em kWh - Fora Ponta
Itens da Fatura
1.346KWH0,61783822,70
12.929KWH0,400305.171,60
TOTAL:8277,66
Grandezas Contratadas
Demanda Todos os Período - kW 37
`;

const result3 = extractEnergisaData(elektroW90, null);
console.log('ConsumoPonta:', result3.ConsumoPonta, '(expected: 1.346)');
console.log('ConsumoForaPonta:', result3.ConsumoForaPonta, '(expected: 12.929)');
console.log('ConsumoTotal:', result3.ConsumoTotal);
console.log('DemandaContratadaPonta:', result3.DemandaContratadaPonta, '(expected: 37)');
console.log('DemandaContratadaForaPonta:', result3.DemandaContratadaForaPonta, '(expected: 37)');
