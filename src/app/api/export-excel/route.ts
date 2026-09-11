import { NextRequest, NextResponse } from 'next/server';
import type { EnergisaInvoiceData } from '@/lib/energisa-extractor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoices } = body as { invoices: EnergisaInvoiceData[] };

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json({ error: 'Nenhuma fatura para exportar.' }, { status: 400 });
    }

    const XLSX = await import('xlsx');

    // Column order exactly as requested: [headerLabel, dataKey or null for manual]
    const cols: [string, string | null][] = [
      ['UC',                          'UC'],
      ['Gerência',                    null],
      ['LOCINS',                      null],
      ['Cidade',                      'Cidade'],
      ['Tipo',                        'Tipo'],
      ['Mercado',                     'Mercado'],
      ['Concessionária',              'Concessionaria'],
      ['Mês Referência',              'MesReferencia'],
      ['Ano Leitura',                 'AnoLeitura'],
      ['Vencimento',                  'Vencimento'],
      ['Nota Fiscal',                 'NotaFiscal'],
      ['Modalidade Tarifária',        'ModalidadeTarifaria'],
      ['Subgrupo',                    'Subgrupo'],
      ['Valor Total (R$)',            'ValorTotal'],
      ['Demanda Contratada Ponta (kW)',           'DemandaContratadaPonta'],
      ['Demanda Contratada Fora Ponta (kW)',       'DemandaContratadaForaPonta'],
      ['Demanda Todos os Períodos (kW)',           null],
      ['Demanda Medida Ponta (kW)',                'DemandaMedidaPonta'],
      ['Valor Demanda Medida Ponta (R$)',          'ValorDemandaPonta'],
      ['Demanda Medida Fora Ponta (kW)',           'DemandaMedidaForaPonta'],
      ['Valor Demanda Medida Fora Ponta (R$)',     'ValorDemandaForaPonta'],
      ['Consumo Grupo B (kWh)',                    null],
      ['Valor Consumo Grupo B (R$)',               null],
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
      ['Saldo Acumulado GD (kWh)',                   'SaldoAcumuladoGD'],
      ['Energia Injetada (kWh)',                    null],
      ['Energia Compensada (kWh)',                  null],
      ['CIP (R$)',                                  'CIP'],
      ['Outros Encargos (R$)',                      null],
      ['PIS (R$)',                                  'PIS'],
      ['COFINS (R$)',                               'COFINS'],
      ['ICMS (R$)',                                 'ICMS'],
    ];

    const headers = cols.map(c => c[0]);
    const keys = cols.map(c => c[1]);
    const rows = invoices.map(inv => keys.map(k => k === null ? '' : (inv[k as keyof EnergisaInvoiceData] || '')));

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = cols.map(c => {
      const l = c[0];
      if (l.includes('UC') && !l.includes('GDI')) return { wch: 22 };
      if (l.includes('Gerência') || l.includes('LOCINS')) return { wch: 18 };
      return { wch: 28 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faturas ENERGISA');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="faturas_energisa.xlsx"',
      },
    });
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
    return NextResponse.json({ error: 'Erro ao gerar Excel.' }, { status: 500 });
  }
}
