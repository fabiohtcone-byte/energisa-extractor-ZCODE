// Test script to debug Elektro Group A HORÁRIA VERDE extraction
const { extractEnergisaData } = require('../dist/energisa-extractor.cjs');

// Simulated text from an Elektro Group A HORÁRIA VERDE invoice
// Based on typical pdf-parse output for Elektro invoices
const elektroVerdeText = `
ELEKTRO
DISTRIBUIDORA DE ENERGIA
CNPJ 02.328.280/0002-78
1.818.189.045-27
Classificação: MTV-MOD.TARIFÁRIA HORÁRIA VERDE / A4  SERVIÇO PÚBLICO
HORÁRIA VERDE
Agosto / 2025
21/09/2025
NOTA FISCAL Nº: 011.736.844 - Série: 002
Demanda Todos os Período - kW
37
Consumo em kWh - Ponta
Consumo em kWh - Fora Ponta
Demanda de Potência Medida - Fora Ponta
Itens da Fatura
Quant Unid Preço Unit. Valor (R$) PIS/COFINS (R$) ICMS (R$) ICMS (%) (R$) Tarifa
Consumo em kWh - Ponta KWH 1.346 0,61 822,70
Consumo em kWh - Fora Ponta KWH 12.929 0,40 5.171,60
Energia Reativa Exced em KWh - Fponta UN 79,68 0,36 28,53
Demanda de Potência Medida - Fora Ponta KW 37,00 60,67 2.254,83
TOTAL: 8.277,66
Tributo
PIS
COFINS
ICMS
Grandezas Contratadas
Demanda Todos os Período - kW 37
KW Ponta:Fora Ponta:37TUSDG:
`;

console.log('=== Testing Elektro Group A HORÁRIA VERDE extraction ===\n');

// Test without table data
console.log('--- WITHOUT table data ---');
const resultNoTable = extractEnergisaData(elektroVerdeText, null);
console.log('UC:', resultNoTable.UC);
console.log('Concessionaria:', resultNoTable.Concessionaria);
console.log('ModalidadeTarifaria:', resultNoTable.ModalidadeTarifaria);
console.log('Subgrupo:', resultNoTable.Subgrupo);
console.log('ConsumoPonta:', resultNoTable.ConsumoPonta, '(expected: 1.346)');
console.log('ConsumoForaPonta:', resultNoTable.ConsumoForaPonta, '(expected: 12.929)');
console.log('ConsumoTotal:', resultNoTable.ConsumoTotal);
console.log('DemandaContratadaPonta:', resultNoTable.DemandaContratadaPonta, '(expected: 37)');
console.log('DemandaContratadaForaPonta:', resultNoTable.DemandaContratadaForaPonta, '(expected: 37)');
console.log('DemandaMedidaPonta:', resultNoTable.DemandaMedidaPonta);
console.log('DemandaMedidaForaPonta:', resultNoTable.DemandaMedidaForaPonta);
console.log('ValorTotal:', resultNoTable.ValorTotal);

// Test WITH table data (simulated)
console.log('\n--- WITH table data ---');
const tableData = {
  items: [
    { label: 'Consumo em kWh - Ponta', unidade: 'KWH', quantidade: '1.346', precoUnit: '0,61', valor: '822,70', pisCofins: '', baseCalcICMS: '', aliquotaICMS: '', icms: '', tarifa: '' },
    { label: 'Consumo em kWh - Fora Ponta', unidade: 'KWH', quantidade: '12.929', precoUnit: '0,40', valor: '5.171,60', pisCofins: '', baseCalcICMS: '', aliquotaICMS: '', icms: '', tarifa: '' },
    { label: 'Energia Reativa Exced em KWh - Fponta', unidade: 'UN', quantidade: '79,68', precoUnit: '0,36', valor: '28,53', pisCofins: '', baseCalcICMS: '', aliquotaICMS: '', icms: '', tarifa: '' },
    { label: 'Demanda de Potência Medida - Fora Ponta', unidade: 'KW', quantidade: '37,00', precoUnit: '60,67', valor: '2.254,83', pisCofins: '', baseCalcICMS: '', aliquotaICMS: '', icms: '', tarifa: '' },
  ],
  pisTotal: '',
  cofinsTotal: '',
  icmsTotal: ''
};
const resultWithTable = extractEnergisaData(elektroVerdeText, tableData);
console.log('UC:', resultWithTable.UC);
console.log('Concessionaria:', resultWithTable.Concessionaria);
console.log('ModalidadeTarifaria:', resultWithTable.ModalidadeTarifaria);
console.log('Subgrupo:', resultWithTable.Subgrupo);
console.log('ConsumoPonta:', resultWithTable.ConsumoPonta, '(expected: 1.346)');
console.log('ConsumoForaPonta:', resultWithTable.ConsumoForaPonta, '(expected: 12.929)');
console.log('ConsumoTotal:', resultWithTable.ConsumoTotal);
console.log('DemandaContratadaPonta:', resultWithTable.DemandaContratadaPonta, '(expected: 37)');
console.log('DemandaContratadaForaPonta:', resultWithTable.DemandaContratadaForaPonta, '(expected: 37)');
console.log('DemandaMedidaPonta:', resultWithTable.DemandaMedidaPonta);
console.log('DemandaMedidaForaPonta:', resultWithTable.DemandaMedidaForaPonta);
console.log('ValorTotal:', resultWithTable.ValorTotal);

// Check if values are correct
const errors = [];
if (resultWithTable.ConsumoPonta !== '1.346') errors.push(`ConsumoPonta: got "${resultWithTable.ConsumoPonta}", expected "1.346"`);
if (resultWithTable.ConsumoForaPonta !== '12.929') errors.push(`ConsumoForaPonta: got "${resultWithTable.ConsumoForaPonta}", expected "12.929"`);
if (resultWithTable.DemandaContratadaPonta !== '37') errors.push(`DemandaContratadaPonta: got "${resultWithTable.DemandaContratadaPonta}", expected "37"`);
if (resultWithTable.DemandaContratadaForaPonta !== '37') errors.push(`DemandaContratadaForaPonta: got "${resultWithTable.DemandaContratadaForaPonta}", expected "37"`);

if (errors.length === 0) {
  console.log('\n✓ All values correct!');
} else {
  console.log('\n✗ Errors found:');
  errors.forEach(e => console.log('  -', e));
}
