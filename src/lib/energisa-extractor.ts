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
  ValorTotal: string;
}

const EMPTY = '';

function matchAny(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  return EMPTY;
}

function findLine(lines: string[], pattern: RegExp): number {
  return lines.findIndex(l => pattern.test(l));
}

function windowLines(lines: string[], idx: number, before: number, after: number): string[] {
  return lines.slice(Math.max(0, idx - before), Math.min(lines.length, idx + after + 1));
}

function findAllMoney(text: string): string[] {
  const matches = text.match(/R\$\s*([\d.]+,\d{2})/g);
  if (!matches) return [];
  return matches.map(m => m.match(/([\d.]+,\d{2})/)?.[1] || '').filter(Boolean);
}

function findAllNumbers(text: string): string[] {
  return text.match(/([\d.]+,\d{2})/g) || [];
}

// ===================== MAIN =====================

export function extractEnergisaData(rawText: string): EnergisaInvoiceData {
  const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  const flat = lines.join(' ');

  // ===== CONCESSIONÁRIA =====
  const Concessionaria = (() => {
    for (const line of lines.slice(0, 25)) {
      if (/^ENERGISA/i.test(line) && line.length > 10) {
        let name = line;
        const dateCut = name.search(/\d{2}\s*\/\s*\d{2}/);
        if (dateCut > 15) name = name.substring(0, dateCut).trim();
        return name.replace(/\s+/g, ' ');
      }
    }
    return EMPTY;
  })();

  // ===== TIPO =====
  const Tipo = (() => {
    const u = flat.toUpperCase();
    if (/SERVI[ÇC]O\s+P[ÚU]BLICO/.test(u)) return 'SERVIÇO PÚBLICO';
    if (/PODER\s+P[ÚU]BLICO/.test(u)) return 'PODER PÚBLICO';
    if (/RESIDENCIAL/.test(u)) return 'RESIDENCIAL';
    if (/COMERCIAL/.test(u)) return 'COMERCIAL';
    if (/INDUSTRIAL/.test(u)) return 'INDUSTRIAL';
    if (/RURAL/.test(u)) return 'RURAL';
    return EMPTY;
  })();

  // ===== MERCADO =====
  const Mercado = (() => {
    const patterns = [
      /Mercado\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{2,20})/i,
      /Classe\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{2,25})/i,
    ];
    const m = matchAny(flat, patterns);
    if (m && m.length < 30) return m.toUpperCase().trim();
    return EMPTY;
  })();

  // ===== CIDADE =====
  const Cidade = (() => {
    const skip = new Set(['SA', 'S/A', 'LTDA', 'ME', 'EPP', 'SANESUL', 'ENERGISA', 'DISTRIBUIDORA']);
    for (const line of lines.slice(0, 60)) {
      const m = line.match(/([A-ZÀ-Ú]{3,25})\s*\(\s*AG\s*:\s*\d+\s*\)/);
      if (m && !skip.has(m[1].toUpperCase())) return m[1].toUpperCase();
    }
    return EMPTY;
  })();

  // ===== UC — dotted format X.XXX.XXX-XX, search ALL lines =====
  const UC = (() => {
    const labelPatterns = [
      /UC\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
      /Unidade\s+Consumidora\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
      /Instala[cç][aã]o\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
    ];
    const fromLabel = matchAny(flat, labelPatterns);
    if (fromLabel && /\d.*\.\d.*\.\d/.test(fromLabel)) return fromLabel;
    for (const line of lines) {
      const m = line.match(/^(\d{1,3}\.\d{3}\.\d{3}-\d{2})$/);
      if (m) return m[1];
    }
    for (const line of lines) {
      const m = line.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
      if (m && line.length < 25) return m[1];
    }
    const broad = flat.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
    return broad ? broad[1] : EMPTY;
  })();

  // ===== MÊS REFERÊNCIA =====
  const MesReferencia = (() => {
    const meses = 'Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';
    const numToMonth: Record<string, string> = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
    };
    const namePatterns = [
      new RegExp(`(${meses})\\s*[\\/\\-]\\s*(\\d{4})`, 'i'),
      new RegExp(`(${meses})\\s+de\\s*(\\d{4})`, 'i'),
    ];
    for (const p of namePatterns) {
      const m = flat.match(p);
      if (m && m[1] && m[2]) {
        const month = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
        return `${month} / ${m[2]}`;
      }
    }
    const numMatch = flat.match(/(?:Ref[\.:]?\s*)?(\d{2})\s*[\\/\\-]\s*(\d{4})/);
    if (numMatch && numToMonth[numMatch[1]]) {
      return `${numToMonth[numMatch[1]]} / ${numMatch[2]}`;
    }
    return EMPTY;
  })();

  // ===== ANO LEITURA =====
  const AnoLeitura = (() => {
    const m = flat.match(/Leitura\s+Atual\s*:\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i);
    if (m) return m[1];
    if (MesReferencia) {
      const ym = MesReferencia.match(/(\d{4})/);
      if (ym) return ym[1];
    }
    return EMPTY;
  })();

  // ===== VENCIMENTO =====
  const Vencimento = (() => {
    // Strategy 1: find VENCIMENTO line, check nearby lines for date
    const venIdx = findLine(lines, /VENCIMENTO/i);
    if (venIdx >= 0) {
      // Same line
      const m1 = lines[venIdx].match(/(\d{2})[\/](\d{2})[\/](\d{4})/);
      if (m1) return `${m1[1]}/${m1[2]}/${m1[3]}`;
      // Next lines
      for (let i = venIdx + 1; i < Math.min(venIdx + 3, lines.length); i++) {
        const m2 = lines[i].match(/^(\d{2}\/\d{2}\/\d{4})$/);
        if (m2) return m2[1];
      }
      // Previous lines (ENERGISA often puts date before VENCIMENTO label)
      for (let i = venIdx - 1; i >= Math.max(0, venIdx - 4); i--) {
        const m3 = lines[i].match(/^(\d{2}\/\d{2}\/\d{4})$/);
        if (m3) return m3[1];
      }
    }
    // Strategy 2: date before R$ in summary line
    const m4 = flat.match(/(\d{2}\/\d{2}\/\d{4})\s*R\$/);
    if (m4) return m4[1];
    return EMPTY;
  })();

  // ===== NOTA FISCAL =====
  const NotaFiscal = (() => {
    const m = flat.match(/NOTA\s+FISCAL\s*N[º°]?\s*[:\-]?\s*([\d.]+)/i);
    return m ? m[1] : EMPTY;
  })();

  // ===== MODALIDADE TARIFÁRIA =====
  const ModalidadeTarifaria = (() => {
    if (/CONVENCIONAL/i.test(flat)) return 'CONVENCIONAL';
    if (/AZUL/i.test(flat) && /HOR[ÁA]RIO/i.test(flat)) return 'HORÁRIO AZUL';
    if (/AZUL/i.test(flat)) return 'AZUL';
    if (/VERDE/i.test(flat) && /HOR[ÁA]RIO/i.test(flat)) return 'HORÁRIO VERDE';
    if (/VERDE/i.test(flat)) return 'VERDE';
    if (/VERMELHA/i.test(flat)) return 'VERMELHA';
    return EMPTY;
  })();

  // ===== SUBGRUPO =====
  const Subgrupo = (() => {
    const classIdx = findLine(lines, /Classifica[çc][aã]o/i);
    if (classIdx >= 0) {
      const region = lines.slice(classIdx, Math.min(classIdx + 3, lines.length)).join(' ');
      const m = region.match(/\b(A[1-4]|B[1-4]|AS|BS)\b/);
      if (m) return m[1].toUpperCase();
    }
    return EMPTY;
  })();

  const isSplitTariff = /AZUL|VERDE/i.test(flat) && !/CONVENCIONAL/i.test(flat);

  // ===== CONSUMO =====
  let ConsumoPonta = EMPTY;
  let ConsumoForaPonta = EMPTY;
  let ConsumoTotal = EMPTY;
  let ValorConsumoPonta = EMPTY;
  let ValorConsumoForaPonta = EMPTY;

  if (isSplitTariff) {
    const pontaIdx = findLine(lines, /Consumo\s+em\s+kWh.*?Ponta(?!.*Fora)/i);
    const fpIdx = findLine(lines, /Consumo\s+em\s+kWh.*?Fora\s*Ponta/i);
    if (pontaIdx >= 0) {
      for (let i = pontaIdx + 1; i < Math.min(pontaIdx + 8, lines.length); i++) {
        const m = lines[i].match(/([\d.]+,\d{2})/);
        if (m) { ConsumoPonta = m[1]; break; }
      }
    }
    if (fpIdx >= 0) {
      for (let i = fpIdx + 1; i < Math.min(fpIdx + 8, lines.length); i++) {
        const m = lines[i].match(/([\d.]+,\d{2})/);
        if (m) { ConsumoForaPonta = m[1]; break; }
      }
    }
    ValorConsumoPonta = findItemRValue(lines, /Consumo\s+em\s+kWh.*?Ponta(?!.*Fora)/i);
    ValorConsumoForaPonta = findItemRValue(lines, /Consumo\s+em\s+kWh.*?Fora\s*Ponta/i);
  } else {
    // Convencional: KWH prefix line first (e.g., "KWH1.044,00")
    for (const line of lines) {
      const km = line.match(/^KWH([\d.,]+)$/i);
      if (km) { ConsumoTotal = km[1]; break; }
    }
    if (!ConsumoTotal) {
      for (const line of lines) {
        const km = line.match(/^KWH\s*\w*([\d.]+,\d{2})/i);
        if (km) { ConsumoTotal = km[1]; break; }
      }
    }
    if (!ConsumoTotal) {
      const consIdx = findLine(lines, /CONSUMO\s+FATURADO/i);
      if (consIdx >= 0) {
        for (let i = consIdx + 1; i < Math.min(consIdx + 8, lines.length); i++) {
          if (/[A-Za-z]{3,}/.test(lines[i])) continue;
          const m = lines[i].match(/([\d.]+,\d{2})/);
          if (m) { ConsumoTotal = m[1]; break; }
        }
      }
    }
    ValorConsumoForaPonta = findItemRValue(lines, /Consumo\s+em\s+kWh(?!.*Ponta)/i);
  }

  // ===== DEMANDA (only split tariffs) =====
  let DemandaContratadaPonta = EMPTY;
  let DemandaContratadaForaPonta = EMPTY;
  let DemandaMedidaPonta = EMPTY;
  let DemandaMedidaForaPonta = EMPTY;
  let DemandaFaturadaPonta = EMPTY;
  let DemandaFaturadaForaPonta = EMPTY;
  let ValorDemandaPonta = EMPTY;
  let ValorDemandaForaPonta = EMPTY;
  if (isSplitTariff) {
    DemandaContratadaPonta = findItemQty(lines, /Demanda\s+Contrat[ae]da.*?Ponta(?![^\n]*Fora)/i);
    DemandaContratadaForaPonta = findItemQty(lines, /Demanda\s+Contrat[ae]da.*?Fora\s*Ponta/i);
    DemandaMedidaPonta = findItemQty(lines, /Demanda\s+Medida.*?Ponta(?![^\n]*Fora)/i);
    DemandaMedidaForaPonta = findItemQty(lines, /Demanda\s+Medida.*?Fora\s*Ponta/i);
    DemandaFaturadaPonta = findItemQty(lines, /Demanda\s+Fatur[ae]da.*?Ponta(?![^\n]*Fora)/i) || DemandaMedidaPonta;
    DemandaFaturadaForaPonta = findItemQty(lines, /Demanda\s+Fatur[ae]da.*?Fora\s*Ponta/i) || DemandaMedidaForaPonta;
    ValorDemandaPonta = findItemRValue(lines, /Demanda\s+(?:Medida|Fatur[ae]da).*?Ponta(?![^\n]*Fora)/i);
    ValorDemandaForaPonta = findItemRValue(lines, /Demanda\s+(?:Medida|Fatur[ae]da).*?Fora\s*Ponta/i);
  }

  // ===== ULTRAPASSAGEM (only split tariffs) =====
  let UltrapassagemPonta = EMPTY;
  let UltrapassagemForaPonta = EMPTY;
  let ValorUltrapassagemPonta = EMPTY;
  let ValorUltrapassagemForaPonta = EMPTY;
  if (isSplitTariff) {
    UltrapassagemPonta = findItemQty(lines, /Ultrapassagem.*?Ponta(?![^\n]*Fora)/i);
    UltrapassagemForaPonta = findItemQty(lines, /Ultrapassagem.*?Fora\s*Ponta/i);
    ValorUltrapassagemPonta = findItemRValue(lines, /Ultrapassagem.*?Ponta(?![^\n]*Fora)/i);
    ValorUltrapassagemForaPonta = findItemRValue(lines, /Ultrapassagem.*?Fora\s*Ponta/i);
  }

  // ===== REATIVA EXCEDENTE =====
  let ReativaExcedentePonta = EMPTY;
  let ReativaExcedenteForaPonta = EMPTY;
  let EnergiaReativaTotal = EMPTY;
  let ValorReativaExcedentePonta = EMPTY;
  let ValorReativaExcedenteForaPonta = EMPTY;
  if (isSplitTariff) {
    ReativaExcedentePonta = findItemQty(lines, /Reactiv?a\s+Excedente.*?Ponta(?![^\n]*Fora)/i);
    ReativaExcedenteForaPonta = findItemQty(lines, /Reactiv?a\s+Excedente.*?Fora\s*Ponta/i);
    ValorReativaExcedentePonta = findItemRValue(lines, /Reactiv?a\s+Excedente.*?Ponta(?![^\n]*Fora)/i);
    ValorReativaExcedenteForaPonta = findItemRValue(lines, /Reactiv?a\s+Excedente.*?Fora\s*Ponta/i);
  } else {
    EnergiaReativaTotal = findItemQty(lines, /Reactiv?a\s+Excedente/i);
  }

  // ===== TRIBUTOS: PIS, COFINS, ICMS =====
  // ENERGISA layout: "PIS/" on line N, "COFINS (R$)" on line N+1,
  // then values: PIS on N+2, COFINS on N+3, ICMS on N+4
  let PIS = EMPTY;
  let COFINS = EMPTY;
  let ICMS = EMPTY;

  (() => {
    // Find "PIS/" line (label split across 2 lines in ENERGISA PDFs)
    const pisLineIdx = findLine(lines, /^PIS\s*\/\s*$/i);
    const startIdx = pisLineIdx >= 0 ? pisLineIdx : findLine(lines, /PIS\/\s*COFINS/i);
    if (startIdx >= 0) {
      const nums: string[] = [];
      for (let i = startIdx + 1; i < Math.min(startIdx + 10, lines.length) && nums.length < 4; i++) {
        const m = lines[i].match(/^(\d[\d.]+,\d{2})$/);
        if (m) nums.push(m[1]);
      }
      if (nums.length >= 1) PIS = nums[0];
      if (nums.length >= 2) COFINS = nums[1];
      if (nums.length >= 3) ICMS = nums[2];
    }
    // Fallback: flat text "PIS/ COFINS (R$) X,XX Y,YY Z,ZZ"
    if (!PIS || !COFINS || !ICMS) {
      const flatMatch = flat.match(/PIS\s*\/\s*COFINS[^\d]*([\d.]+,\d{2})[^\d]*([\d.]+,\d{2})[^\d]*([\d.]+,\d{2})/i);
      if (flatMatch) {
        if (!PIS) PIS = flatMatch[1];
        if (!COFINS) COFINS = flatMatch[2];
        if (!ICMS) ICMS = flatMatch[3];
      }
    }
    if (!PIS) PIS = findTributo(lines, flat, /\bPIS\b(?!\/)/i);
    if (!COFINS) COFINS = findTributo(lines, flat, /\bCOFINS\b/i);
    if (!ICMS) ICMS = findTributo(lines, flat, /\bICMS\b(?!\s*%)/i);
  })();

  // ===== GDI =====
  const GDI = findTributo(lines, flat, /\bGDI\b/i);

  // ===== CIP =====
  const CIP = (() => {
    const cipIdx = findLine(lines, /CIP\s*MUNICIPAL/i);
    if (cipIdx >= 0) {
      for (let i = cipIdx; i < Math.min(cipIdx + 5, lines.length); i++) {
        const m = lines[i].match(/([\d.]+,\d{2})/);
        if (m) return m[1];
      }
    }
    return findTributo(lines, flat, /\bCIP\b/i);
  })();

  // ===== VALOR TOTAL =====
  const ValorTotal = (() => {
    // Strategy 1: find "TOTAL A PAGAR" line, check same and next lines for R$ value
    const totalIdx = findLine(lines, /^TOTAL\s+A\s+PAGAR/i);
    if (totalIdx >= 0) {
      const m1 = lines[totalIdx].match(/R\$\s*([\d.]+,\d{2})/);
      if (m1) return m1[1];
      for (let i = totalIdx + 1; i < Math.min(totalIdx + 3, lines.length); i++) {
        const m2 = lines[i].match(/R\$\s*([\d.]+,\d{2})/);
        if (m2) return m2[1];
        const m3 = lines[i].match(/^(\d[\d.]+,\d{2})$/);
        if (m3) return m3[1];
      }
    }
    // Strategy 2: flat text patterns
    const patterns = [
      /TOTAL\s*A\s+PAGAR[^\d]*R\$\s*([\d.]+,\d{2})/i,
      /TOTAL[^\d]*?R\$\s*([\d.]+,\d{2})/i,
      /Valor\s+Total\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
    ];
    const m = matchAny(flat, patterns);
    if (m) return m;
    // Fallback: largest R$ value
    const all = findAllMoney(flat);
    if (all.length > 0) {
      all.sort((a, b) => parseFloat(b.replace('.', '').replace(',', '.')) - parseFloat(a.replace('.', '').replace(',', '.')));
      return all[0];
    }
    return EMPTY;
  })();

  return {
    UC, Cidade, Tipo, Mercado, Concessionaria,
    MesReferencia, AnoLeitura, Vencimento, NotaFiscal,
    ModalidadeTarifaria, Subgrupo,
    ConsumoPonta, ConsumoForaPonta, ConsumoTotal,
    DemandaContratadaPonta, DemandaContratadaForaPonta,
    DemandaMedidaPonta, DemandaMedidaForaPonta,
    DemandaFaturadaPonta, DemandaFaturadaForaPonta,
    UltrapassagemPonta, UltrapassagemForaPonta,
    ReativaExcedentePonta, ReativaExcedenteForaPonta,
    ValorConsumoPonta, ValorConsumoForaPonta,
    ValorDemandaPonta, ValorDemandaForaPonta,
    ValorUltrapassagemPonta, ValorUltrapassagemForaPonta,
    ValorReativaExcedentePonta, ValorReativaExcedenteForaPonta,
    PIS, COFINS, ICMS, GDI, CIP,
    EnergiaReativaTotal, ValorTotal,
  };
}

// ===================== ITEM HELPERS =====================

function findItemQty(lines: string[], labelPattern: RegExp): string {
  const idx = findLine(lines, labelPattern);
  if (idx < 0) return EMPTY;
  for (let i = idx + 1; i < Math.min(idx + 10, lines.length); i++) {
    const line = lines[i];
    if (/[A-Za-z]{3,}/.test(line) && !/kWh|kW|R\$|tarifa/i.test(line)) continue;
    const m = line.match(/([\d.]+,\d{2})/);
    if (m) return m[1];
  }
  return EMPTY;
}

function findItemRValue(lines: string[], labelPattern: RegExp): string {
  const idx = findLine(lines, labelPattern);
  if (idx < 0) return EMPTY;
  const region = windowLines(lines, idx, 0, 12).join(' ');
  const moneyVals = findAllMoney(region);
  if (moneyVals.length > 0) return moneyVals[moneyVals.length - 1];
  const nums = findAllNumbers(region);
  if (nums.length > 0) return nums[nums.length - 1];
  return EMPTY;
}

function findTributo(lines: string[], flat: string, labelPattern: RegExp): string {
  const idx = findLine(lines, labelPattern);
  if (idx >= 0) {
    for (let i = idx + 1; i < Math.min(idx + 6, lines.length); i++) {
      const m = lines[i].match(/^(\d[\d.]+,\d{2})$/);
      if (m) return m[1];
    }
  }
  const flatMatch = flat.match(new RegExp(labelPattern.source + '[^\\d]*?([\\d.]+,\\d{2})', 'i'));
  return flatMatch ? flatMatch[1] : EMPTY;
}

// ===================== FIELD LABELS & CATEGORIES =====================

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

export const FIELD_CATEGORIES: { category: string; fields: (keyof EnergisaInvoiceData)[] }[] = [
  { category: 'Identificação', fields: ['UC', 'Cidade', 'Tipo', 'Mercado', 'Concessionaria'] },
  { category: 'Datas e Documentos', fields: ['MesReferencia', 'AnoLeitura', 'Vencimento', 'NotaFiscal'] },
  { category: 'Tarifa', fields: ['ModalidadeTarifaria', 'Subgrupo'] },
  { category: 'Consumo (kWh)', fields: ['ConsumoPonta', 'ConsumoForaPonta', 'ConsumoTotal'] },
  { category: 'Demanda Contratada (kW)', fields: ['DemandaContratadaPonta', 'DemandaContratadaForaPonta'] },
  { category: 'Demanda Medida (kW)', fields: ['DemandaMedidaPonta', 'DemandaMedidaForaPonta'] },
  { category: 'Demanda Faturada (kW)', fields: ['DemandaFaturadaPonta', 'DemandaFaturadaForaPonta'] },
  { category: 'Ultrapassagem (kW)', fields: ['UltrapassagemPonta', 'UltrapassagemForaPonta'] },
  { category: 'Reativa Excedente (kWh)', fields: ['ReativaExcedentePonta', 'ReativaExcedenteForaPonta', 'EnergiaReativaTotal'] },
  { category: 'Valores - Consumo (R$)', fields: ['ValorConsumoPonta', 'ValorConsumoForaPonta'] },
  { category: 'Valores - Demanda (R$)', fields: ['ValorDemandaPonta', 'ValorDemandaForaPonta'] },
  { category: 'Valores - Ultrapassagem (R$)', fields: ['ValorUltrapassagemPonta', 'ValorUltrapassagemForaPonta'] },
  { category: 'Valores - Reativa Excedente (R$)', fields: ['ValorReativaExcedentePonta', 'ValorReativaExcedenteForaPonta'] },
  { category: 'Tributos e Encargos (R$)', fields: ['PIS', 'COFINS', 'ICMS', 'GDI', 'CIP'] },
  { category: 'Total', fields: ['ValorTotal'] },
];
