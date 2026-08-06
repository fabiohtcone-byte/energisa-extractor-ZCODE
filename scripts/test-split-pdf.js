const { extractEnergisaData } = require('/home/z/my-project/dist/energisa-extractor.cjs');
const pdf = require('pdf-parse');
const fs = require('fs');

async function test(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const data = await pdf(buf);
  const r = extractEnergisaData(data.text);
  
  console.log('=== ' + pdfPath.split('/').pop() + ' ===');
  console.log('UC:', r.UC);
  console.log('Modalidade:', r.ModalidadeTarifaria);
  console.log('ConsumoPonta:', r.ConsumoPonta);
  console.log('ConsumoForaPonta:', r.ConsumoForaPonta);
  console.log('ConsumoTotal:', r.ConsumoTotal);
  console.log('DemandaMedidaPonta:', r.DemandaMedidaPonta);
  console.log('DemandaMedidaForaPonta:', r.DemandaMedidaForaPonta);
  console.log('DemandaContratadaPonta:', r.DemandaContratadaPonta);
  console.log('DemandaContratadaForaPonta:', r.DemandaContratadaForaPonta);
  console.log('UltrapassagemPonta:', r.UltrapassagemPonta);
  console.log('UltrapassagemForaPonta:', r.UltrapassagemForaPonta);
  console.log('ReativaExcedentePonta:', r.ReativaExcedentePonta);
  console.log('ReativaExcedenteForaPonta:', r.ReativaExcedenteForaPonta);
  console.log('ValorConsumoPonta:', r.ValorConsumoPonta);
  console.log('ValorConsumoForaPonta:', r.ValorConsumoForaPonta);
  console.log('ValorDemandaPonta:', r.ValorDemandaPonta);
  console.log('ValorDemandaForaPonta:', r.ValorDemandaForaPonta);
  console.log('ValorUltrapassagemPonta:', r.ValorUltrapassagemPonta);
  console.log('ValorUltrapassagemForaPonta:', r.ValorUltrapassagemForaPonta);
  console.log('ValorReativaExcedentePonta:', r.ValorReativaExcedentePonta);
  console.log('ValorReativaExcedenteForaPonta:', r.ValorReativaExcedenteForaPonta);
  console.log('PIS:', r.PIS, 'COFINS:', r.COFINS, 'ICMS:', r.ICMS);
  console.log('GDI:', r.GDI, 'CIP:', r.CIP);
  console.log('GDI oUC Qtd:', r.EnergiaAtvInjetadaGDIoUC_Qtd);
  console.log('GDI mUC Qtd:', r.EnergiaAtvInjetadaGDImUC_Qtd);
  console.log('ValorTotal:', r.ValorTotal);
  
  // Check for any empty fields that should have data
  const checkFields = ['ConsumoPonta','ConsumoForaPonta','ConsumoTotal',
    'DemandaMedidaPonta','DemandaMedidaForaPonta','DemandaContratadaPonta','DemandaContratadaForaPonta',
    'UltrapassagemPonta','UltrapassagemForaPonta',
    'ReativaExcedentePonta','ReativaExcedenteForaPonta',
    'ValorConsumoPonta','ValorConsumoForaPonta',
    'ValorDemandaPonta','ValorDemandaForaPonta',
    'ValorUltrapassagemPonta','ValorUltrapassagemForaPonta',
    'ValorReativaExcedentePonta','ValorReativaExcedenteForaPonta'];
  const empty = checkFields.filter(f => !r[f]);
  if (empty.length) console.log('\nCAMPOS VAZIOS (possivelmente ausentes):', empty.join(', '));
  else console.log('\nTodos os campos de consumo/demanda preenchidos!');
  console.log();
}

(async () => {
  const pdfs = [
    '/home/z/my-project/upload/4167605165.PDF',
    '/home/z/my-project/upload/4456305122.PDF',
    '/home/z/my-project/upload/7948705165.PDF',
    '/home/z/my-project/upload/8092005187.PDF',
    '/home/z/my-project/upload/144378605167.PDF',
  ];
  for (const p of pdfs) {
    try { await test(p); } catch(e) { console.log('ERROR:', p, e.message); }
  }
})();
