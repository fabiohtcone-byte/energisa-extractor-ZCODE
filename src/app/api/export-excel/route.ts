import { NextRequest, NextResponse } from 'next/server';
import type { EnergisaInvoiceData } from '@/lib/energisa-extractor';

/**
 * Compute total consumption for a single invoice.
 * - Grupo B → ConsumoGrupoB_kWh
 * - Grupo A → ConsumoPonta + ConsumoForaPonta + ConsumoIntermediaria
 * Falls back to ConsumoTotal if nothing else is available.
 */
function getConsumoKWh(inv: EnergisaInvoiceData): number {
  // Grupo B
  const grupoB = parseFloat((inv.ConsumoGrupoB_kWh || '').replace(/[^\d.,-]/g, '').replace('.', '').replace(',', '.'));
  if (!isNaN(grupoB) && grupoB > 0) return grupoB;

  // Grupo A — sum Ponta + Fora Ponta + Intermediária
  const ponta    = parseFloat((inv.ConsumoPonta || '').replace(/[^\d.,-]/g, '').replace('.', '').replace(',', '.'));
  const fora     = parseFloat((inv.ConsumoForaPonta || '').replace(/[^\d.,-]/g, '').replace('.', '').replace(',', '.'));
  const intermed = parseFloat((inv.ConsumoIntermediaria || '').replace(/[^\d.,-]/g, '').replace('.', '').replace(',', '.'));
  const sumA = (isNaN(ponta) ? 0 : ponta) + (isNaN(fora) ? 0 : fora) + (isNaN(intermed) ? 0 : intermed);
  if (sumA > 0) return sumA;

  // Fallback to ConsumoTotal
  const total = parseFloat((inv.ConsumoTotal || '').replace(/[^\d.,-]/g, '').replace('.', '').replace(',', '.'));
  return isNaN(total) ? 0 : total;
}

/**
 * Parse month/year from invoice into a sortable key (YYYYMM).
 */
function parseRefMonth(inv: EnergisaInvoiceData): string | null {
  // MesReferencia is typically "DEZ/2024", "JAN/2025", etc.
  const raw = (inv.MesReferencia || '').trim().toUpperCase();
  if (!raw) return null;

  const monthMap: Record<string, string> = {
    JANEIRO: '01', JANE: '01', JAN: '01', FEV: '02', FEVEREIRO: '02', MAR: '03', MARÇO: '03',
    ABR: '04', ABRIL: '04', MAI: '05', MAIO: '05', JUN: '06', JUNHO: '06',
    JUL: '07', JULHO: '07', AGO: '08', AGOSTO: '08', SET: '09', SETEMBRO: '09',
    OUT: '10', OUTUBRO: '10', NOV: '11', NOVEMBRO: '11', DEZ: '12', DEZEMBRO: '12',
  };

  // Try "MMM/YYYY" format
  const m1 = raw.match(/^([A-Z]{3,})\/?(\d{4})$/);
  if (m1) {
    const mm = monthMap[m1[1]];
    if (mm) return `${m1[2]}${mm}`;
  }

  // Try "MMM YYYY"
  const m2 = raw.match(/^([A-Z]{3,})\s+(\d{4})$/);
  if (m2) {
    const mm = monthMap[m2[1]];
    if (mm) return `${m2[2]}${mm}`;
  }

  return null;
}

/**
 * For a given UC, compute the average consumption of the last 12 months.
 */
function computeConsumoMedio(allInvoices: EnergisaInvoiceData[], currentInv: EnergisaInvoiceData): number {
  const uc = (currentInv.UC || '').replace(/\D/g, '');
  if (!uc) return 0;

  // Get reference month of the current invoice
  const currentRef = parseRefMonth(currentInv);

  // Collect all invoices for this UC
  const ucInvoices = allInvoices.filter(inv => (inv.UC || '').replace(/\D/g, '') === uc);

  // Build list of (refMonth, consumoKWh)
  const entries: { ref: string; consumo: number }[] = [];
  for (const inv of ucInvoices) {
    const ref = parseRefMonth(inv);
    const consumo = getConsumoKWh(inv);
    if (ref && consumo > 0) {
      entries.push({ ref, consumo });
    }
  }

  if (entries.length === 0) return 0;

  // Sort by ref month descending
  entries.sort((a, b) => b.ref.localeCompare(a.ref));

  // If we have a current ref, take only entries up to and including current month
  let filtered = entries;
  if (currentRef) {
    filtered = entries.filter(e => e.ref <= currentRef);
  }

  // Take at most 12 months
  const last12 = filtered.slice(0, 12);

  if (last12.length === 0) return 0;

  const sum = last12.reduce((acc, e) => acc + e.consumo, 0);
  return sum / last12.length;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoices } = body as { invoices: EnergisaInvoiceData[] };

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json({ error: 'Nenhuma fatura para exportar.' }, { status: 400 });
    }

    const XLSX = await import('xlsx');

    // Column order EXACTLY as requested by user, then Consumo Médio at the end
    const cols: [string, string][] = [
      ['UC',                                      'UC'],
      ['Gerência',                                '__empty__'],
      ['LOCINS',                                  '__empty__'],
      ['Cidade',                                  'Cidade'],
      ['Tipo',                                    'Tipo'],
      ['Mercado',                                 'Mercado'],
      ['Concessionária',                          'Concessionaria'],
      ['Mês Referência',                          'MesReferencia'],
      ['Ano Leitura',                             'AnoLeitura'],
      ['Vencimento',                              'Vencimento'],
      ['Nota Fiscal',                             'NotaFiscal'],
      ['Modalidade Tarifária',                    'ModalidadeTarifaria'],
      ['Subgrupo',                                'Subgrupo'],
      ['Valor Total (R$)',                        'ValorTotal'],
      ['Consumo Grupo B (kWh)',                   'ConsumoGrupoB_kWh'],
      ['Valor Consumo Grupo B (R$)',              'ConsumoGrupoB_Valor'],
      ['Consumo em kWh - Intermediária',          'ConsumoIntermediaria'],
      ['Demanda Contratada Ponta (kW)',           'DemandaContratadaPonta'],
      ['Demanda Contratada Fora Ponta (kW)',      'DemandaContratadaForaPonta'],
      ['Demanda Todos os Períodos (kW)',          '__empty__'],
      ['Demanda Medida Ponta (kW)',               'DemandaMedidaPonta'],
      ['Valor Demanda Medida Ponta (R$)',         'ValorDemandaPonta'],
      ['Demanda Medida Fora Ponta (kW)',          'DemandaMedidaForaPonta'],
      ['Valor Demanda Medida Fora Ponta (R$)',    'ValorDemandaForaPonta'],
      ['Consumo Ponta (kWh)',                     'ConsumoPonta'],
      ['Valor Consumo Ponta (R$)',                'ValorConsumoPonta'],
      ['Consumo Fora Ponta (kWh)',                'ConsumoForaPonta'],
      ['Valor Consumo Fora Ponta (R$)',           'ValorConsumoForaPonta'],
      ['Demanda Não Consumida Ponta (kW)',        'DemandaNaoConsumidaPonta'],
      ['Valor Demanda Não Consumida Ponta (R$)',  'ValorNaoConsumidaPonta'],
      ['Demanda Não Consumida Fora Ponta (kW)',   'DemandaNaoConsumidaForaPonta'],
      ['Valor Demanda Não Consumida Fora Ponta (R$)', 'ValorNaoConsumidaForaPonta'],
      ['Ultrapassagem Ponta (kW)',                'UltrapassagemPonta'],
      ['Valor Ultrapassagem Ponta (R$)',          'ValorUltrapassagemPonta'],
      ['Ultrapassagem Fora Ponta (kW)',           'UltrapassagemForaPonta'],
      ['Valor Ultrapassagem Fora Ponta (R$)',     'ValorUltrapassagemForaPonta'],
      ['Reativa Excedente Ponta (kVArh)',         'ReativaExcedentePonta'],
      ['Valor Reativa Excedente Ponta (R$)',      'ValorReativaExcedentePonta'],
      ['Reativa Excedente Fora Ponta (kVArh)',    'ReativaExcedenteForaPonta'],
      ['Valor Reativa Excedente Fora Ponta (R$)', 'ValorReativaExcedenteForaPonta'],
      ['GDI oUC (kWh)',                           'EnergiaAtvInjetadaGDIoUC_Qtd'],
      ['Valor GDI oUC (R$)',                      'EnergiaAtvInjetadaGDIoUC_Valor'],
      ['GDI mUC (kWh)',                           'EnergiaAtvInjetadaGDImUC_Qtd'],
      ['Valor GDI mUC (R$)',                      'EnergiaAtvInjetadaGDImUC_Valor'],
      ['Energia Injetada (kWh)',                  '__empty__'],
      ['Energia Compensada (kWh)',                '__empty__'],
      ['Saldo Acumulado GD',                      'SaldoAcumuladoGD'],
      ['CIP (R$)',                                'CIP'],
      ['Outros Encargos (R$)',                    '__empty__'],
      ['PIS (R$)',                                'PIS'],
      ['COFINS (R$)',                             'COFINS'],
      ['ICMS (R$)',                               'ICMS'],
      ['Consumo Médio',                           '__consumo_medio__'],
    ];

    const headers = cols.map(c => c[0]);
    const keys = cols.map(c => c[1]);

    // Build rows — compute Consumo Médio per UC
    const consumoMedioCache = new Map<string, number>();
    const rows = invoices.map(inv => {
      return keys.map(k => {
        if (k === '__empty__') return '';
        if (k === '__consumo_medio__') {
          const uc = (inv.UC || '').replace(/\D/g, '');
          if (!consumoMedioCache.has(uc)) {
            consumoMedioCache.set(uc, computeConsumoMedio(invoices, inv));
          }
          const avg = consumoMedioCache.get(uc)!;
          // Format with 2 decimal places and comma as decimal separator
          return avg > 0 ? avg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
        }
        return (inv[k as keyof EnergisaInvoiceData] as string) || '';
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = cols.map(c => {
      const l = c[0];
      if (l.includes('UC') && !l.includes('GDI')) return { wch: 22 };
      if (l.includes('Gerência') || l.includes('LOCINS')) return { wch: 18 };
      if (l.includes('Consumo Médio')) return { wch: 20 };
      return { wch: 28 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monitoramento Usinas');
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
