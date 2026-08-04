// ============================================================================// ENERGISA Invoice Data Extractor - Extrai ~40+ campos de faturas de energia
// ============================================================================

export interface EnergisaInvoiceData {
  // Identificação
  UC: string;
  Cidade: string;
  Tipo: string;
  Mercado: string;
  Concessionaria: string;

  // Datas
  MesReferencia: string;
  AnoLeitura: string;
  Vencimento: string;
  NotaFiscal: string;

  // Tarifa
  ModalidadeTarifaria: string;
  Subgrupo: string;

  // Consumo (kWh)
  ConsumoPonta: string;
  ConsumoForaPonta: string;
  ConsumoTotal: string;

  // Demanda Contratada (kW)
  DemandaContratadaPonta: string;
  DemandaContratadaForaPonta: string;

  // Demanda Medida (kW)
  DemandaMedidaPonta: string;
  DemandaMedidaForaPonta: string;

  // Demanda Faturada (kW)
  DemandaFaturadaPonta: string;
  DemandaFaturadaForaPonta: string;

  // Ultrapassagem de Demanda (kW)
  UltrapassagemPonta: string;
  UltrapassagemForaPonta: string;

  // Energia Reativa Excedente (kWh)
  ReativaExcedentePonta: string;
  ReativaExcedenteForaPonta: string;

  // Valores (R$)
  ValorConsumoPonta: string;
  ValorConsumoForaPonta: string;
  ValorDemandaPonta: string;
  ValorDemandaForaPonta: string;
  ValorUltrapassagemPonta: string;
  ValorUltrapassagemForaPonta: string;
  ValorReativaExcedentePonta: string;
  ValorReativaExcedenteForaPonta: string;

  // Tributos e Encargos
  PIS: string;
  COFINS: string;
  ICMS: string;

  // Outros
  GDI: string;
  CIP: string;
  EnergiaReativaTotal: string;

  // Valor Total
  ValorTotal: string;
}

// Padrão de campos vazios
const EMPTY = '';

function cleanText(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWithRegex(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return EMPTY;
}

function extractNumber(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return EMPTY;
}

export function extractEnergisaData(pdfText: string): EnergisaInvoiceData {
  const text = cleanText(pdfText);

  // === IDENTIFICAÇÃO ===
  const UC = extractNumber(text, [
    /(?:UC|Unidade Consumidora|N[º°]\s*Instala[cç][aã]o|Cod\.?\s*UC|C[óo]digo\s*UC)[\s:]*(\d[\d\s.]*)/i,
    /UC\s*[:\s]*(\d{6,})/i,
    /(?:Instala[cç][aã]o|N[º°])\s*[:\s]*(\d{6,})/i,
  ]);

  const Cidade = extractWithRegex(text, [
    /(?:Cidade|Localidade|Munic[ií]pio)[\s:]+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+?)(?:\s{2,}|\t|[A-Z]{2,3}\s*[\d|])/,
    /(?:ENDERE[Çc]O|Endere[cç]o)[^A-Z]*?([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+?)\s*[-–,]/,
    /([A-Z][A-ZÀ-Úa-zà-ú]+\s*[\/\-]?\s*[A-Z][A-ZÀ-Úa-zà-ú]+)\s*[-–]\s*[A-Z]{2}/,
  ]);

  const Tipo = extractWithRegex(text, [
    /(?:Tipo|Classe|Tipo de Instala[cç][aã]o)[\s:]+([A-Za-zÀ-Ú\s\/]+?)(?:\s{2,}|\t|$)/i,
    /CLASSE\s*[:\s]+([A-Za-zÀ-Ú\s]+?)(?:\s{2,}|\t|$)/i,
    /TIPO\s*[:\s]+([A-Za-zÀ-Ú\s\/]+?)(?:\s{2,}|\t|\n)/i,
  ]);

  const Mercado = extractWithRegex(text, [
    /(?:Mercado|Segmento|Tipo de Mercado)[\s:]+([A-Za-zÀ-Ú\s]+?)(?:\s{2,}|\t|$)/i,
    /MERCADO\s*[:\s]+([A-ZÀ-Ú\s]+?)(?:\s{2,}|\t|$)/i,
  ]);

  const Concessionaria = extractWithRegex(text, [
    /(?:ENERGISA\s+[A-ZÀ-Ú]+|CONCESSION[ÁA]RIA)[\s:]*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s.]+?)(?:\s{2,}|CNPJ|\d{2}\.\d{3})/i,
    /ENERGISA\s+([A-ZÀ-Ú]+(?:\s+[A-ZÀ-Ú]+)*)/,
  ]);

  // === DATAS ===
  const MesReferencia = extractWithRegex(text, [
    /(?:M[eê]s\s*(?:de\s*)?Refer[eê]ncia|REF)[\s:]+([A-Za-zÀ-Ú\s\/\d]+)/i,
    /(?:PER[iÍ]ODO|Compet[eê]ncia)[\s:]+([A-Za-zÀ-Ú\s\/\d]+)/i,
    /([A-Z][a-z]+\s*\/\s*\d{4})/,
  ]);

  const AnoLeitura = extractNumber(text, [
    /Ano\s*(?:de\s*)?Leitura[\s:]*(\d{4})/i,
    /Leitura[\s:]+\d{2}\/\d{2}\/(\d{4})/i,
  ]);

  const Vencimento = extractWithRegex(text, [
    /(?:Vencimento|VENC|Data\s*Vencimento)[\s:]+(\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4})/i,
    /(?:VENC|Vencimento)[\s:]+(\d{2}\/\d{2}\/\d{2,4})/i,
  ]);

  const NotaFiscal = extractNumber(text, [
    /(?:Nota\s*(?:Fiscal)?|N[º°]?\s*Nota\s*Fiscal|NF\s*[Nn]°?)[\s:]+(\d[\d\s.]*)/i,
    /NOTA\s+FISCAL[\s:]+(\d+)/i,
    /NF[e\s]*[Nnº°]*[\s:]*(\d{6,})/i,
  ]);

  // === TARIFA ===
  const ModalidadeTarifaria = extractWithRegex(text, [
    /(?:Modalidade\s*Tarif[áa]ria|Modalidade)[\s:]+([A-Za-zÀ-Ú\s\d\/\-]+?)(?:\s{2,}|\t|$)/i,
    /MODALIDADE[\s:]+([A-ZÀ-Ú\s\d\/\-]+?)(?:\s{2,}|\t|$)/i,
    /(?:Azul|Verde|Vermelha|Branca)/i,
  ]);

  const Subgrupo = extractWithRegex(text, [
    /(?:Subgrupo|Sub-grupo|GRUPO)[\s:]+([A-Za-z]\d?|\d[A-Za-z]?|[AB]\d|[AB]\s\d)/i,
    /SUBGRUPO[\s:]+([A-Za-z]\d?)/i,
    /(?:Classe|Subclasse)[\s:]+([A-Z][a-z]?\d?)/i,
  ]);

  // === CONSUMO (kWh) ===
  const ConsumoPonta = extractNumber(text, [
    /(?:Consumo|Energia\s*(?:El[eé]trica)?|Consumo\s*Ponta)[\s:]*\d*\s*(?:Ponta|P\b)[^\d]*(\d[\d.,]*)/i,
    /PONTA[^\d]*?(\d[\d.,]+)\s*kWh/i,
    /Consumo\s*[^\d]*Ponta[\s:]*[^\d]*(\d[\d.,]+)/i,
  ]);

  const ConsumoForaPonta = extractNumber(text, [
    /(?:Consumo|Energia)[^\d]*?(?:Fora\s*Ponta|F[Pp]\b|FORA\s*PONTA)[^\d]*(\d[\d.,]*)/i,
    /FORA\s*PONTA[^\d]*?(\d[\d.,]+)\s*kWh/i,
    /Consumo[^\d]*Fora[^\d]*Ponta[\s:]*[^\d]*(\d[\d.,]+)/i,
  ]);

  const ConsumoTotal = extractNumber(text, [
    /(?:Consumo\s*Total|TOTAL\s*CONSUMO|Total\s*de\s*Energia)[^\d]*(\d[\d.,]+)/i,
    /TOTAL[^\d]*?(\d[\d.,]+)\s*kWh/i,
  ]);

  // === DEMANDA CONTRATADA (kW) ===
  const DemandaContratadaPonta = extractNumber(text, [
    /(?:Demanda\s*Contratada|CONTRATADA)[^\d]*(?:Ponta|P\b)[^\d]*(\d[\d.,]+)/i,
    /Dem\s*Contratada[^\d]*Ponta[^\d]*(\d[\d.,]+)/i,
    /CONTRAT[\sA]*\s*PONTA[^\d]*(\d[\d.,]+)/i,
  ]);

  const DemandaContratadaForaPonta = extractNumber(text, [
    /(?:Demanda\s*Contratada|CONTRATADA)[^\d]*(?:Fora\s*Ponta|FP|F\b)[^\d]*(\d[\d.,]+)/i,
    /Dem\s*Contratada[^\d]*Fora[^\d]*Ponta[^\d]*(\d[\d.,]+)/i,
    /CONTRAT[\sA]*\s*FORA[^\d]*(\d[\d.,]+)/i,
  ]);

  // === DEMANDA MEDIDA (kW) ===
  const DemandaMedidaPonta = extractNumber(text, [
    /(?:Demanda\s*Medida|MEDIDA|Medida)[^\d]*(?:Ponta|P\b)[^\d]*(\d[\d.,]+)/i,
    /MEDIDA\s*PONTA[^\d]*(\d[\d.,]+)/i,
  ]);

  const DemandaMedidaForaPonta = extractNumber(text, [
    /(?:Demanda\s*Medida|MEDIDA|Medida)[^\d]*(?:Fora\s*Ponta|FP|F\b)[^\d]*(\d[\d.,]+)/i,
    /MEDIDA\s*FORA[^\d]*(\d[\d.,]+)/i,
  ]);

  // === DEMANDA FATURADA (kW) ===
  const DemandaFaturadaPonta = extractNumber(text, [
    /(?:Demanda\s*Faturada|FATURADA|Faturada)[^\d]*(?:Ponta|P\b)[^\d]*(\d[\d.,]+)/i,
    /FATURADA\s*PONTA[^\d]*(\d[\d.,]+)/i,
  ]);

  const DemandaFaturadaForaPonta = extractNumber(text, [
    /(?:Demanda\s*Faturada|FATURADA|Faturada)[^\d]*(?:Fora\s*Ponta|FP|F\b)[^\d]*(\d[\d.,]+)/i,
    /FATURADA\s*FORA[^\d]*(\d[\d.,]+)/i,
  ]);

  // === ULTRAPASSAGEM DE DEMANDA (kW) ===
  const UltrapassagemPonta = extractNumber(text, [
    /(?:Ultrapassagem|ULTRAPASSAGEM|Ultrapass)[^\d]*(?:Ponta|P\b)[^\d]*(\d[\d.,]+)/i,
    /ULTRA\s*PONTA[^\d]*(\d[\d.,]+)/i,
  ]);

  const UltrapassagemForaPonta = extractNumber(text, [
    /(?:Ultrapassagem|ULTRAPASSAGEM|Ultrapass)[^\d]*(?:Fora\s*Ponta|FP|F\b)[^\d]*(\d[\d.,]+)/i,
    /ULTRA\s*FORA[^\d]*(\d[\d.,]+)/i,
  ]);

  // === ENERGIA REATIVA EXCEDENTE (kWh) ===
  const ReativaExcedentePonta = extractNumber(text, [
    /(?:Reativa\s*Excedente|REATIVA\s*EXCEDENTE|Reat\.*\s*Exc)[^\d]*(?:Ponta|P\b)[^\d]*(\d[\d.,]+)/i,
    /REAT\.*\s*EXC\.*\s*PONTA[^\d]*(\d[\d.,]+)/i,
  ]);

  const ReativaExcedenteForaPonta = extractNumber(text, [
    /(?:Reativa\s*Excedente|REATIVA\s*EXCEDENTE|Reat\.*\s*Exc)[^\d]*(?:Fora\s*Ponta|FP|F\b)[^\d]*(\d[\d.,]+)/i,
    /REAT\.*\s*EXC\.*\s*FORA[^\d]*(\d[\d.,]+)/i,
  ]);

  // === VALORES (R$) ===
  const ValorConsumoPonta = extractNumber(text, [
    /(?:Valor|Vlr)[^\d]*Consumo[^\d]*Ponta[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /(?:Energia|ENERGIA)[^\d]*Ponta[^R$]*R\$?\s*(\d[\d.,]+[.,]\d{2})/i,
    /PONTA[^R$\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const ValorConsumoForaPonta = extractNumber(text, [
    /(?:Valor|Vlr)[^\d]*Consumo[^\d]*(?:Fora\s*Ponta|FP)[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /(?:Energia|ENERGIA)[^\d]*(?:Fora\s*Ponta|FP)[^R$]*R\$?\s*(\d[\d.,]+[.,]\d{2})/i,
    /FORA\s*PONTA[^R$\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const ValorDemandaPonta = extractNumber(text, [
    /(?:Valor|Vlr)[^\d]*(?:Demanda|DEMANDA)[^\d]*Ponta[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /DEMANDA[^R$]*PONTA[^R$\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const ValorDemandaForaPonta = extractNumber(text, [
    /(?:Valor|Vlr)[^\d]*(?:Demanda|DEMANDA)[^\d]*(?:Fora\s*Ponta|FP)[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /DEMANDA[^R$]*FORA[^R$\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const ValorUltrapassagemPonta = extractNumber(text, [
    /(?:Valor|Vlr)[^\d]*(?:Ultrapassagem|ULTRA)[^\d]*Ponta[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /ULTRAPASS[^R$]*PONTA[^R$\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const ValorUltrapassagemForaPonta = extractNumber(text, [
    /(?:Valor|Vlr)[^\d]*(?:Ultrapassagem|ULTRA)[^\d]*(?:Fora\s*Ponta|FP)[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /ULTRAPASS[^R$]*FORA[^R$\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const ValorReativaExcedentePonta = extractNumber(text, [
    /(?:Valor|Vlr)[^\d]*(?:Reativa\s*Exc|REATIVA\s*EXC)[^\d]*Ponta[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /REATIVA[^R$]*PONTA[^R$\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const ValorReativaExcedenteForaPonta = extractNumber(text, [
    /(?:Valor|Vlr)[^\d]*(?:Reativa\s*Exc|REATIVA\s*EXC)[^\d]*(?:Fora\s*Ponta|FP)[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /REATIVA[^R$]*FORA[^R$\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  // === TRIBUTOS E ENCARGOS ===
  const PIS = extractNumber(text, [
    /PIS[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /PIS\s*[=:]?\s*R?\$?\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const COFINS = extractNumber(text, [
    /COFINS[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /COFINS\s*[=:]?\s*R?\$?\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const ICMS = extractNumber(text, [
    /ICMS[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /ICMS\s*[=:]?\s*R?\$?\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  // === OUTROS ===
  const GDI = extractNumber(text, [
    /GDI[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /GDI\s*[=:]?\s*R?\$?\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const CIP = extractNumber(text, [
    /CIP[^\d]*(\d[\d.,]+[.,]\d{2})/i,
    /CIP\s*[=:]?\s*R?\$?\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  const EnergiaReativaTotal = extractNumber(text, [
    /(?:Energia\s*Reativa\s*Total|TOTAL\s*REATIVA|Reativa\s*Total)[^\d]*(\d[\d.,]+)/i,
    /REATIVA\s*TOTAL[^\d]*(\d[\d.,]+)/i,
  ]);

  // === VALOR TOTAL ===
  const ValorTotal = extractNumber(text, [
    /(?:TOTAL(?:\s*A\s*PAGAR)?|Valor\s*Total|TOTAL\s*GERAL)[^\d]*R?\$?\s*(\d[\d.,]+[.,]\d{2})/i,
    /TOTAL[^\d]*R\$\s*(\d[\d.,]+[.,]\d{2})/i,
    /VALOR\s*TOTAL[^\d]*R?\$?\s*(\d[\d.,]+[.,]\d{2})/i,
  ]);

  return {
    UC,
    Cidade,
    Tipo,
    Mercado,
    Concessionaria,
    MesReferencia,
    AnoLeitura,
    Vencimento,
    NotaFiscal,
    ModalidadeTarifaria,
    Subgrupo,
    ConsumoPonta,
    ConsumoForaPonta,
    ConsumoTotal,
    DemandaContratadaPonta,
    DemandaContratadaForaPonta,
    DemandaMedidaPonta,
    DemandaMedidaForaPonta,
    DemandaFaturadaPonta,
    DemandaFaturadaForaPonta,
    UltrapassagemPonta,
    UltrapassagemForaPonta,
    ReativaExcedentePonta,
    ReativaExcedenteForaPonta,
    ValorConsumoPonta,
    ValorConsumoForaPonta,
    ValorDemandaPonta,
    ValorDemandaForaPonta,
    ValorUltrapassagemPonta,
    ValorUltrapassagemForaPonta,
    ValorReativaExcedentePonta,
    ValorReativaExcedenteForaPonta,
    PIS,
    COFINS,
    ICMS,
    GDI,
    CIP,
    EnergiaReativaTotal,
    ValorTotal,
  };
}

// Mapeamento de chaves para labels amigáveis
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
  ValorTotal: 'Valor Total (R$)',
};

// Categorias para agrupamento na UI
export const FIELD_CATEGORIES: { category: string; fields: (keyof EnergisaInvoiceData)[] }[] = [
  {
    category: 'Identificação',
    fields: ['UC', 'Cidade', 'Tipo', 'Mercado', 'Concessionaria'],
  },
  {
    category: 'Datas e Documentos',
    fields: ['MesReferencia', 'AnoLeitura', 'Vencimento', 'NotaFiscal'],
  },
  {
    category: 'Tarifa',
    fields: ['ModalidadeTarifaria', 'Subgrupo'],
  },
  {
    category: 'Consumo (kWh)',
    fields: ['ConsumoPonta', 'ConsumoForaPonta', 'ConsumoTotal'],
  },
  {
    category: 'Demanda Contratada (kW)',
    fields: ['DemandaContratadaPonta', 'DemandaContratadaForaPonta'],
  },
  {
    category: 'Demanda Medida (kW)',
    fields: ['DemandaMedidaPonta', 'DemandaMedidaForaPonta'],
  },
  {
    category: 'Demanda Faturada (kW)',
    fields: ['DemandaFaturadaPonta', 'DemandaFaturadaForaPonta'],
  },
  {
    category: 'Ultrapassagem (kW)',
    fields: ['UltrapassagemPonta', 'UltrapassagemForaPonta'],
  },
  {
    category: 'Reativa Excedente (kWh)',
    fields: ['ReativaExcedentePonta', 'ReativaExcedenteForaPonta', 'EnergiaReativaTotal'],
  },
  {
    category: 'Valores - Consumo (R$)',
    fields: ['ValorConsumoPonta', 'ValorConsumoForaPonta'],
  },
  {
    category: 'Valores - Demanda (R$)',
    fields: ['ValorDemandaPonta', 'ValorDemandaForaPonta'],
  },
  {
    category: 'Valores - Ultrapassagem (R$)',
    fields: ['ValorUltrapassagemPonta', 'ValorUltrapassagemForaPonta'],
  },
  {
    category: 'Valores - Reativa Excedente (R$)',
    fields: ['ValorReativaExcedentePonta', 'ValorReativaExcedenteForaPonta'],
  },
  {
    category: 'Tributos e Encargos (R$)',
    fields: ['PIS', 'COFINS', 'ICMS', 'GDI', 'CIP'],
  },
  {
    category: 'Total',
    fields: ['ValorTotal'],
  },
];
