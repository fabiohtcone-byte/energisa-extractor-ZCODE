// Types and field definitions for ENERGISA invoice extraction
// This file has NO external dependencies — safe for client-side imports

export interface TableItem {
  label: string;
  unidade: string;
  quantidade: string;
  precoUnit: string;
  valor: string;
  pisCofins: string;
  baseCalcICMS: string;
  aliquotaICMS: string;
  icms: string;
  tarifa: string;
}

export interface TableExtraction {
  items: TableItem[];
  pisTotal: string;
  cofinsTotal: string;
  icmsTotal: string;
}

export interface EnergisaInvoiceData {
  UC: string;
  Cidade: string;
  Tipo: string;
  Mercado: string;
  Concessionaria: string;
  MesReferencia: string;
  AnoLeitura: string;
  Vencimento: string;
  NotaFiscal: string;
  ModalidadeTarifaria: string;
  Subgrupo: string;
  ConsumoPonta: string;
  ConsumoForaPonta: string;
  ConsumoTotal: string;
  DemandaContratadaPonta: string;
  DemandaContratadaForaPonta: string;
  DemandaMedidaPonta: string;
  DemandaMedidaForaPonta: string;
  DemandaFaturadaPonta: string;
  DemandaFaturadaForaPonta: string;
  UltrapassagemPonta: string;
  UltrapassagemForaPonta: string;
  DemandaNaoConsumidaPonta: string;
  DemandaNaoConsumidaForaPonta: string;
  ValorNaoConsumidaPonta: string;
  ValorNaoConsumidaForaPonta: string;
  ReativaExcedentePonta: string;
  ReativaExcedenteForaPonta: string;
  ValorConsumoPonta: string;
  ValorConsumoForaPonta: string;
  ValorDemandaPonta: string;
  ValorDemandaForaPonta: string;
  ValorUltrapassagemPonta: string;
  ValorUltrapassagemForaPonta: string;
  ValorReativaExcedentePonta: string;
  ValorReativaExcedenteForaPonta: string;
  PIS: string;
  COFINS: string;
  ICMS: string;
  GDI: string;
  CIP: string;
  EnergiaReativaTotal: string;
  EnergiaAtvInjetadaGDIoUC_Qtd: string;
  EnergiaAtvInjetadaGDIoUC_Valor: string;
  EnergiaAtvInjetadaGDImUC_Qtd: string;
  EnergiaAtvInjetadaGDImUC_Valor: string;
  SaldoAcumuladoGD: string;
  ValorTotal: string;
}

export const FIELD_LABELS: Record<keyof EnergisaInvoiceData, string> = {
  UC: 'UC (Unidade Consumidora)',
  Cidade: 'Cidade',
  Tipo: 'Tipo',
  Mercado: 'Mercado',
  Concessionaria: 'Concessionária',
  MesReferencia: 'Mês Referência',
  AnoLeitura: 'Ano Leitura',
  Vencimento: 'Vencimento',
  NotaFiscal: 'Nota Fiscal',
  ModalidadeTarifaria: 'Modalidade Tarifária',
  Subgrupo: 'Subgrupo',
  ConsumoPonta: 'Consumo Ponta (kWh)',
  ConsumoForaPonta: 'Consumo Fora Ponta (kWh)',
  ConsumoTotal: 'Consumo Total (kWh)',
  DemandaContratadaPonta: 'Demanda Contratada Ponta (kW)',
  DemandaContratadaForaPonta: 'Demanda Contratada Fora Ponta (kW)',
  DemandaMedidaPonta: 'Demanda Medida Ponta (kW)',
  DemandaMedidaForaPonta: 'Demanda Medida Fora Ponta (kW)',
  DemandaFaturadaPonta: 'Demanda Faturada Ponta (kW)',
  DemandaFaturadaForaPonta: 'Demanda Faturada Fora Ponta (kW)',
  UltrapassagemPonta: 'Ultrapassagem Ponta (kW)',
  UltrapassagemForaPonta: 'Ultrapassagem Fora Ponta (kW)',
  DemandaNaoConsumidaPonta: 'Demanda Potência Não Consumida - Ponta (kW)',
  DemandaNaoConsumidaForaPonta: 'Demanda Potência Não Consumida - Fora Ponta (kW)',
  ValorNaoConsumidaPonta: 'Valor Não Consumida Ponta (R$)',
  ValorNaoConsumidaForaPonta: 'Valor Não Consumida Fora Ponta (R$)',
  ReativaExcedentePonta: 'Reativa Excedente Ponta (kWh)',
  ReativaExcedenteForaPonta: 'Reativa Excedente Fora Ponta (kWh)',
  ValorConsumoPonta: 'Valor Consumo Ponta (R$)',
  ValorConsumoForaPonta: 'Valor Consumo Fora Ponta (R$)',
  ValorDemandaPonta: 'Valor Demanda Ponta (R$)',
  ValorDemandaForaPonta: 'Valor Demanda Fora Ponta (R$)',
  ValorUltrapassagemPonta: 'Valor Ultrapassagem Ponta (R$)',
  ValorUltrapassagemForaPonta: 'Valor Ultrapassagem Fora Ponta (R$)',
  ValorReativaExcedentePonta: 'Valor Reativa Excedente Ponta (R$)',
  ValorReativaExcedenteForaPonta: 'Valor Reativa Excedente Fora Ponta (R$)',
  PIS: 'PIS (R$)',
  COFINS: 'COFINS (R$)',
  ICMS: 'ICMS (R$)',
  GDI: 'GDI (R$)',
  CIP: 'CIP (R$)',
  EnergiaReativaTotal: 'Energia Reativa Total (kWh)',
  EnergiaAtvInjetadaGDIoUC_Qtd: 'Energia Atv Injetada GDI oUC (kWh)',
  EnergiaAtvInjetadaGDIoUC_Valor: 'Energia Atv Injetada GDI oUC (R$)',
  EnergiaAtvInjetadaGDImUC_Qtd: 'Energia Atv Injetada GDI mUC (kWh)',
  EnergiaAtvInjetadaGDImUC_Valor: 'Energia Atv Injetada GDI mUC (R$)',
  SaldoAcumuladoGD: 'Saldo Acumulado GD (kWh)',
  ValorTotal: 'Valor Total (R$)',
};

export const FIELD_CATEGORIES: { category: string; fields: (keyof EnergisaInvoiceData)[] }[] = [
  { category: 'Identificação', fields: ['UC', 'Cidade', 'Tipo', 'Mercado', 'Concessionaria'] },
  { category: 'Datas e Documentos', fields: ['MesReferencia', 'AnoLeitura', 'Vencimento', 'NotaFiscal'] },
  { category: 'Tarifa', fields: ['ModalidadeTarifaria', 'Subgrupo'] },
  { category: 'Consumo (kWh)', fields: ['ConsumoPonta', 'ConsumoForaPonta', 'ConsumoTotal'] },
  { category: 'Demanda Contratada (kW)', fields: ['DemandaContratadaPonta', 'DemandaContratadaForaPonta'] },
  { category: 'Demanda Medida (kW)', fields: ['DemandaMedidaPonta', 'DemandaMedidaForaPonta'] },
  { category: 'Demanda Faturada (kW)', fields: ['DemandaFaturadaPonta', 'DemandaFaturadaForaPonta'] },
  { category: 'Ultrapassagem (kW)', fields: ['UltrapassagemPonta', 'UltrapassagemForaPonta'] },
  { category: 'Demanda Não Consumida (kW)', fields: ['DemandaNaoConsumidaPonta', 'DemandaNaoConsumidaForaPonta'] },
  { category: 'Reativa Excedente (kWh)', fields: ['ReativaExcedentePonta', 'ReativaExcedenteForaPonta', 'EnergiaReativaTotal'] },
  { category: 'Valores - Consumo (R$)', fields: ['ValorConsumoPonta', 'ValorConsumoForaPonta'] },
  { category: 'Valores - Demanda (R$)', fields: ['ValorDemandaPonta', 'ValorDemandaForaPonta'] },
  { category: 'Valores - Ultrapassagem (R$)', fields: ['ValorUltrapassagemPonta', 'ValorUltrapassagemForaPonta'] },
  { category: 'Valores - Demanda Não Consumida (R$)', fields: ['ValorNaoConsumidaPonta', 'ValorNaoConsumidaForaPonta'] },
  { category: 'Valores - Reativa Excedente (R$)', fields: ['ValorReativaExcedentePonta', 'ValorReativaExcedenteForaPonta'] },
  { category: 'Tributos e Encargos (R$)', fields: ['PIS', 'COFINS', 'ICMS', 'GDI', 'CIP'] },
  { category: 'Energia Injetada GDI oUC', fields: ['EnergiaAtvInjetadaGDIoUC_Qtd', 'EnergiaAtvInjetadaGDIoUC_Valor'] },
  { category: 'Energia Injetada GDI mUC', fields: ['EnergiaAtvInjetadaGDImUC_Qtd', 'EnergiaAtvInjetadaGDImUC_Valor'] },
  { category: 'Geração Distribuída', fields: ['SaldoAcumuladoGD'] },
  { category: 'Total', fields: ['ValorTotal'] },
];
