const path = require('path');
const ROOT = '/home/z/my-project';

let buf = Buffer.alloc(0);
process.stdin.on('data', c => buf = Buffer.concat([buf, c]));
process.stdin.on('end', () => {
  try {
    const parsed = JSON.parse(buf.toString());
    const { invoices } = parsed;
    if (!invoices || !Array.isArray(invoices) || !invoices.length) {
      process.stderr.write('empty'); process.exit(1);
    }
    const XLSX = require('xlsx');

    // Column order exactly as requested
    // Each entry: [headerLabel, dataKey (from invoice object) or null for manual-only]
    const columns = [
      ['Nome do Arquivo',           '_fileName'],
      ['UC',                        'UC'],
      ['Gerência',                  null],           // manual
      ['LOCINS',                    null],           // manual
      ['Cidade',                    'Cidade'],
      ['Tipo',                      'Tipo'],
      ['Mercado',                   'Mercado'],
      ['Concessionária',            'Concessionaria'],
      ['Mês Referência',            'MesReferencia'],
      ['Ano Leitura',               'AnoLeitura'],
      ['Vencimento',                'Vencimento'],
      ['Nota Fiscal',               'NotaFiscal'],
      ['Modalidade Tarifária',      'ModalidadeTarifaria'],
      ['Subgrupo',                  'Subgrupo'],
      ['Valor Total (R$)',          'ValorTotal'],
      ['Demanda Contratada Ponta (kW)',           'DemandaContratadaPonta'],
      ['Demanda Contratada Fora Ponta (kW)',       'DemandaContratadaForaPonta'],
      ['Demanda Todos os Períodos (kW)',           null],  // manual
      ['Demanda Medida Ponta (kW)',                'DemandaMedidaPonta'],
      ['Valor Demanda Medida Ponta (R$)',          'ValorDemandaPonta'],
      ['Demanda Medida Fora Ponta (kW)',           'DemandaMedidaForaPonta'],
      ['Valor Demanda Medida Fora Ponta (R$)',     'ValorDemandaForaPonta'],
      ['Consumo Grupo B (kWh)',                    null],  // manual
      ['Valor Consumo Grupo B (R$)',               null],  // manual
      ['Consumo Ponta (kWh)',                      'ConsumoPonta'],
      ['Valor Consumo Ponta (R$)',                 'ValorConsumoPonta'],
      ['Consumo Fora Ponta (kWh)',                 'ConsumoForaPonta'],
      ['Valor Consumo Fora Ponta (R$)',            'ValorConsumoForaPonta'],
      ['Demanda Não Consumida Ponta (kW)',         'DemandaNaoConsumidaPonta'],
      ['Valor Demanda Não Consumida Ponta (R$)',   'ValorNaoConsumidaPonta'],
      ['Demanda Não Consumida Fora Ponta (kW)',    'DemandaNaoConsumidaForaPonta'],
      ['Valor Demanda Não Consumida Fora Ponta (R$)','ValorNaoConsumidaForaPonta'],
      ['Ultrapassagem Ponta (kW)',                  'UltrapassagemPonta'],
      ['Valor Ultrapassagem Ponta (R$)',            'ValorUltrapassagemPonta'],
      ['Ultrapassagem Fora Ponta (kW)',             'UltrapassagemForaPonta'],
      ['Valor Ultrapassagem Fora Ponta (R$)',       'ValorUltrapassagemForaPonta'],
      ['Reativa Excedente Ponta (kVArh)',           'ReativaExcedentePonta'],
      ['Valor Reativa Excedente Ponta (R$)',        'ValorReativaExcedentePonta'],
      ['Reativa Excedente Fora Ponta (kVArh)',      'ReativaExcedenteForaPonta'],
      ['Valor Reativa Excedente Fora Ponta (R$)',   'ValorReativaExcedenteForaPonta'],
      ['GDI oUC (kWh)',                             'EnergiaAtvInjetadaGDIoUC_Qtd'],
      ['Valor GDI oUC (R$)',                        'EnergiaAtvInjetadaGDIoUC_Valor'],
      ['GDI mUC (kWh)',                             'EnergiaAtvInjetadaGDImUC_Qtd'],
      ['Valor GDI mUC (R$)',                        'EnergiaAtvInjetadaGDImUC_Valor'],
      ['Energia Injetada (kWh)',                    null],  // manual
      ['Energia Compensada (kWh)',                  null],  // manual
      ['CIP (R$)',                                  'CIP'],
      ['Outros Encargos (R$)',                      null],  // manual
      ['PIS (R$)',                                  'PIS'],
      ['COFINS (R$)',                               'COFINS'],
      ['ICMS (R$)',                                 'ICMS'],
    ];

    const headers = columns.map(c => c[0]);
    const keys = columns.map(c => c[1]);

    const rows = invoices.map(inv =>
      keys.map(k => {
        if (k === '_fileName') return inv._fileName || '';
        if (k === null) return '';
        return inv[k] || '';
      })
    );

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths: wider for labels, narrower for values
    ws['!cols'] = columns.map(c => {
      const label = c[0];
      if (label.includes('Nome')) return { wch: 35 };
      if (label.includes('UC') && !label.includes('GDI')) return { wch: 22 };
      if (label.includes('Gerência') || label.includes('LOCINS')) return { wch: 18 };
      return { wch: 28 };
    });

    // Highlight manual columns (header only) — light yellow background
    // Open XML styling for column headers
    columns.forEach((col, ci) => {
      if (col[1] === null) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: ci })];
        if (cell) {
          cell.s = {
            fill: { fgColor: { rgb: 'FFF9C4' } },
            font: { italic: true }
          };
        }
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faturas ENERGISA');
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    process.stdout.write(out);
  } catch (e) {
    process.stderr.write(e.message); process.exit(1);
  }
});
