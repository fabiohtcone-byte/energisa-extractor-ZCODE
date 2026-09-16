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

const EMPTY = '';

// ===================== HELPERS =====================

function parseBR(s: string): number {
  const neg = s.startsWith('-');
  const clean = neg ? s.slice(1) : s;
  return parseFloat(clean.replace('.', '').replace(',', '.')) * (neg ? -1 : 1);
}

function findLine(lines: string[], pattern: RegExp): number {
  return lines.findIndex(l => pattern.test(l));
}

function findAllMoney(text: string): string[] {
  const matches = text.match(/R\$\s*([\d.]+,\d{2})/g);
  if (!matches) return [];
  return matches.map(m => m.match(/([\d.]+,\d{2})/)?.[1] || '').filter(Boolean);
}

function findNumNearLine(lines: string[], startIdx: number, direction: 1 | -1, maxDist: number, mustBeOnlyNum: boolean): string {
  for (let i = startIdx + direction; i >= 0 && i < lines.length; i += direction) {
    if (Math.abs(i - startIdx) > maxDist) break;
    const line = lines[i];
    if (mustBeOnlyNum) {
      const m = line.match(/^(\d[\d.]+,\d{2})$/);
      if (m) return m[1];
    } else {
      const m = line.match(/([\d.]+,\d{2})/);
      if (m && !/^[A-Za-z]/.test(line)) return m[1];
    }
  }
  return EMPTY;
}

// ===================== MAIN EXTRACTOR =====================

export function extractEnergisaData(rawText: string, tableExtraction?: TableExtraction): EnergisaInvoiceData {
  const tableData = tableExtraction?.items;
  const tributosFromTable = tableExtraction
    ? { pis: tableExtraction.pisTotal, cofins: tableExtraction.cofinsTotal, icms: tableExtraction.icmsTotal }
    : null;
  const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  const flat = lines.join(' ');

  // ===== CONCESSIONÁRIA =====
  const Concessionaria = /ENERGISA/i.test(flat) ? 'ENERGISA' : EMPTY;

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
    const m = flat.match(/SERVI[ÇC]O\s+P[ÚU]BLICO\s*\/\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú,\s]{3,40}?)(?:\s*TENSÃO|\s*\d|\s*$)/i);
    if (m) {
      const val = m[1].trim().replace(/\s+/g, ' ');
      if (val.length < 50) return val.toUpperCase();
    }
    return EMPTY;
  })();

  // ===== CIDADE =====
  // Pattern: "DOURADOS (AG: 10)" or "ANASTACIO MS (AG: 37)" or "RIO VERDE DE MATO GROSSO (AG: 37)"
  const Cidade = (() => {
    for (const line of lines.slice(0, 60)) {
      // Match: CityName [StateAbbr] (AG: XX)
      const m = line.match(/([A-ZÀ-Ú][A-ZÀ-Ú\s]{3,30}?)\s+(?:MS|SP|PR|MT|GO|MG|RS)?\s*\(\s*AG\s*:\s*\d+\s*\)/i);
      if (m) {
        const name = m[1].trim().toUpperCase();
        const skip = ['SANESUL', 'ENERGISA', 'DISTRIBUIDORA', 'SA', 'EMPRESA DE SANEAMENTO',
          'RUA ', 'AV ', 'DOM.', 'ENDEREÇO', 'PAGADOR'];
        if (name.length >= 4 && name.length <= 30 && !skip.some(s => name.startsWith(s))) return name;
      }
    }
    return EMPTY;
  })();

  // ===== UC =====
  const UC = (() => {
    // Helper: check if a number is likely a CNPJ (14 digits raw) or CPF (11 digits raw)
    const isCnpjCpf = (s: string) => {
      const raw = s.replace(/[.\-\/]/g, '');
      return raw.length === 14 || raw.length === 11;
    };

    // Strategy 1: Energisa slash format "NN/NNNNN-N" (e.g., "10/33836-8") — most reliable
    for (const line of lines) {
      const m = line.match(/^(?:\d{1,3}\/)?(\d{4,8})-\d$/);
      if (m) {
        const num = m[1].replace(/^0+/, '') || '0';
        if (num.length >= 3) return num;
      }
    }
    // Strategy 2: Slash format within a line near "Código:" (e.g., "Código: 10/33836-8")
    const slashCtx = flat.match(/Código\s*:\s*(\d{1,3})\/(\d{4,8})-\d/i);
    if (slashCtx) {
      const num = slashCtx[2].replace(/^0+/, '') || '0';
      if (num.length >= 3) return num;
    }
    // Strategy 3: 4-group dotted format X.XXX.XXX.XXX-XX on its own line (12-digit UC)
    // e.g., "1.409.407.051-47" → "140940705147"
    for (const line of lines) {
      const m = line.match(/^(\d{1,2}\.\d{3}\.\d{3}\.\d{3}-\d{1,2})$/);
      if (m && !isCnpjCpf(m[1])) return m[1];
    }
    // Strategy 4: 3-group dotted format X.XXX.XXX-XX on its own line
    for (const line of lines) {
      const m = line.match(/^(\d{1,3}\.\d{3}\.\d{3}-\d{2})$/);
      if (m) return m[1];
    }
    // Strategy 5: 4-group dotted format on a short line (not CNPJ/CPF/CEP)
    for (const line of lines) {
      const m = line.match(/(\d{1,2}\.\d{3}\.\d{3}\.\d{3}-\d{1,2})/);
      if (m && line.length < 50 && !/CNPJ|CPF|CEP/i.test(line) && !isCnpjCpf(m[1])) return m[1];
    }
    // Strategy 6: 3-group dotted format on a short line (not CNPJ/CPF/CEP)
    for (const line of lines) {
      const m = line.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
      if (m && line.length < 40 && !/CNPJ|CPF|CEP/i.test(line)) return m[1];
    }
    // Strategy 7: MATRÍCULA field — extended to support up to 13 digits
    // e.g., "MATRÍCULA:0140940705147-2025-08-6"
    const ucMat = flat.match(/MATR[IÍ]CULA\s*:\s*0*(\d{4,13})(?:-\d{4}-\d{2}-\d)?/i);
    if (ucMat) return ucMat[1];
    // Strategy 8: 10-13 digit UC near address lines (Energisa MS format)
    const ucAddr = flat.match(/(?:RUA|AV|ESTRADA)[^\d]*(\d{10,13})\b/);
    if (ucAddr) return ucAddr[1];
    // Strategy 9: standalone or near "Instalação:" — 7-13 digits
    const ucInst = flat.match(/Instalação\s*:?\s*(\d{7,13})/i);
    if (ucInst) return ucInst[1];
    // Strategy 10: UC label with number — 4-13 digits
    const ucLabel = flat.match(/(?:UC\s*:?|Unid\.?\s*Cons\.?)[^\d]*(\d{4,13})/i);
    if (ucLabel) return ucLabel[1].replace(/^0+/, '') || ucLabel[1];
    // Strategy 11: broad search for 4-group dotted format (before 3-group to avoid partial match)
    const broad4 = flat.match(/(\d{1,2}\.\d{3}\.\d{3}\.\d{3}-\d{1,2})/);
    if (broad4 && !isCnpjCpf(broad4[1])) return broad4[1];
    // Strategy 12: broad search for 3-group dotted format
    const broad3 = flat.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
    if (broad3) return broad3[1];
    // Strategy 13: standalone 10-13 digit number (not CNPJ/CPF) — as last resort
    const bareLong = flat.match(/\b(\d{10,13})\b/);
    if (bareLong && !isCnpjCpf(bareLong[1])) return bareLong[1];
    return EMPTY;
  })();

  // Clean UC: remove dots and dashes (e.g., "1.409.407.051-47" → "140940705147")
  const cleanUC = UC.replace(/[.\-]/g, '');

  // ===== MÊS REFERÊNCIA =====
  const MesReferencia = (() => {
    const meses = 'Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';
    const numToMonth: Record<string, string> = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
    };
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    // Helper: get Vencimento date components for sanity checks
    const venMoneyMatch = flat.match(/(\d{2})\/(\d{2})\/(\d{4})\s*R\$/);
    const venMonth = venMoneyMatch ? parseInt(venMoneyMatch[2], 10) : 0;
    const venYear = venMoneyMatch ? parseInt(venMoneyMatch[3], 10) : 0;

    // Helper: check if a month/year is consistent with the Vencimento date
    // (reference month is typically 1-2 months before the vencimento month)
    const isConsistentWithVencimento = (month: number, year: number): boolean => {
      if (!venMonth || !venYear) return true; // no vencimento to compare
      const venTotal = venYear * 12 + venMonth;
      const refTotal = year * 12 + month;
      const diff = venTotal - refTotal;
      return diff >= 1 && diff <= 3; // reference is 1-3 months before vencimento
    };

    // Strategy 1: "Mês / Ano" pattern on the SAME LINE as a date + R$ value (most reliable)
    // Energisa format: "Fevereiro / 202621/03/2026R$ 538,49" or "Junho / 2026  21/07/2026  R$ 13.356,50"
    for (const line of lines) {
      const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})\\s*\\d{2}/\\d{2}/\\d{4}\\s*R\\$`, 'i'));
      if (m) return `${capitalize(m[1])} / ${m[2]}`;
    }
    // Strategy 2: "Mês / Ano" pattern on the SAME LINE as VENCIMENTO or NOTA FISCAL
    for (const line of lines) {
      if (/VENCIMENTO|NOTA FISCAL|Nº FATURA/i.test(line)) {
        const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'i'));
        if (m) return `${capitalize(m[1])} / ${m[2]}`;
      }
    }
    // Strategy 3: "Mês / Ano" on a line that also contains a date DD/MM/YYYY (likely the billing line)
    for (const line of lines) {
      const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'i'));
      if (m && /\d{2}\/\d{2}\/\d{4}/.test(line)) {
        const monthIdx = Object.values(numToMonth).indexOf(capitalize(m[1]));
        const monthNum = monthIdx + 1;
        if (isConsistentWithVencimento(monthNum, parseInt(m[2], 10))) {
          return `${capitalize(m[1])} / ${m[2]}`;
        }
      }
    }
    // Strategy 4: "Mês / Ano" anywhere in flat text — skip "Desde mês/ano", "Referência:" history, etc.
    const allNameMatches = [...flat.matchAll(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, 'gi'))];
    for (const m of allNameMatches) {
      // Check context: skip if preceded by "Desde", "Referência:", "Ref", or other informative words
      const start = Math.max(0, m.index! - 20);
      const context = flat.slice(start, m.index! + m[0].length).toLowerCase();
      if (/desde|até|a partir|inform|dispon|referência|ref\b/.test(context)) continue;
      // Also validate against Vencimento date
      const monthIdx = Object.values(numToMonth).indexOf(capitalize(m[1]));
      const monthNum = monthIdx + 1;
      if (!isConsistentWithVencimento(monthNum, parseInt(m[2], 10))) continue;
      return `${capitalize(m[1])} / ${m[2]}`;
    }
    // Strategy 5: Use Leitura Atual date to derive the reference month
    // pdf-parse sometimes garbles text, so try multiple patterns
    const leituraPatterns = [
      /Leitura\s+Atual\s*:\s*\d{2}\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i,
      /Leitura\s+Atual\s*:?\s*\d{2,4}\/?\s*(\d{2})\s*\/\s*(\d{4})/i,
    ];
    for (const pat of leituraPatterns) {
      const lm = flat.match(pat);
      if (lm && numToMonth[lm[1]]) {
        const monthNum = parseInt(lm[1], 10);
        const year = parseInt(lm[2], 10);
        if (isConsistentWithVencimento(monthNum, year)) {
          return `${numToMonth[lm[1]]} / ${lm[2]}`;
        }
      }
    }
    // Strategy 6: numeric MM/YYYY near Vencimento date — with consistency check
    if (venMoneyMatch) {
      const venIdx = flat.indexOf(venMoneyMatch[0]);
      const region = flat.slice(Math.max(0, venIdx - 150), venIdx + 50);
      const numMatches = [...region.matchAll(/(\d{2})\s*\/\s*(\d{4})/g)];
      for (const nm of numMatches) {
        if (numToMonth[nm[1]]) {
          const monthNum = parseInt(nm[1], 10);
          const year = parseInt(nm[2], 10);
          if (isConsistentWithVencimento(monthNum, year)) {
            return `${numToMonth[nm[1]]} / ${nm[2]}`;
          }
        }
      }
    }
    // Strategy 7: first valid MM/YYYY that is a month and consistent with Vencimento
    const allNumMatches = [...flat.matchAll(/(\d{2})\s*[\/]\s*(\d{4})/g)];
    for (const nm of allNumMatches) {
      if (numToMonth[nm[1]]) {
        const monthNum = parseInt(nm[1], 10);
        const year = parseInt(nm[2], 10);
        if (isConsistentWithVencimento(monthNum, year)) {
          return `${numToMonth[nm[1]]} / ${nm[2]}`;
        }
      }
    }
    return EMPTY;
  })();

  // ===== ANO LEITURA =====
  const AnoLeitura = (() => {
    // Try multiple patterns for Leitura Atual date (pdf-parse can garble text)
    const leituraYearPatterns = [
      /Leitura\s+Atual\s*:\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i,
      /Leitura\s+Atual\s*:?\s*\d{2,4}\/?\s*\d{2}\s*\/\s*(\d{4})/i,
    ];
    for (const pat of leituraYearPatterns) {
      const m = flat.match(pat);
      if (m) return m[1];
    }
    // Fallback: extract year from MesReferencia
    if (MesReferencia) {
      const ym = MesReferencia.match(/(\d{4})/);
      if (ym) return ym[1];
    }
    return EMPTY;
  })();

  // ===== VENCIMENTO =====
  // Best pattern: DD/MM/YYYY immediately followed by R$ (date + total on same line)
  // e.g., "21/07/2026R$ 13.356,50Junho / 2026"
  // Also handles: "Junho / 202621/07/2026R$ 1.635,98"
  const Vencimento = (() => {
    // Strategy 1: date + R$ on same line (most reliable for Energisa MS)
    const venMoney = flat.match(/(\d{2}\/\d{2}\/\d{4})\s*R\$\s*[\d.]+,\d{2}/);
    if (venMoney) return venMoney[1];

    // Strategy 2: R$ + money + date on same line (reversed order)
    const moneyVen = flat.match(/R\$\s*[\d.]+,\d{2}\s*(\d{2}\/\d{2}\/\d{4})/);
    if (moneyVen) return moneyVen[1];

    // Strategy 3: VENCIMENTO label nearby (original approach)
    const venIdx = findLine(lines, /VENCIMENTO/i);
    if (venIdx >= 0) {
      for (let i = venIdx - 1; i >= Math.max(0, venIdx - 5); i--) {
        const m = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
        if (m) return m[1];
      }
      for (let i = venIdx + 1; i < Math.min(venIdx + 3, lines.length); i++) {
        const m = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
        if (m) return m[1];
      }
    }

    // Strategy 4: date in "Data de Apresentação:" line (next business day, close enough)
    const apresMatch = flat.match(/Data de Apresentação:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (apresMatch) return apresMatch[1];

    return EMPTY;
  })();

  // ===== NOTA FISCAL =====
  const NotaFiscal = (() => {
    const m = flat.match(/NOTA\s+FISCAL\s*N[º°]?\s*[:\-]?\s*(\d[\d.]*)/i);
    return m ? m[1] : EMPTY;
  })();

  // ===== MODALIDADE TARIFÁRIA =====
  const ModalidadeTarifaria = (() => {
    if (/CONVENCIONAL/i.test(flat)) return 'CONVENCIONAL';
    if (/AZUL/i.test(flat) && /HOR[ÁA]RIO/i.test(flat)) return 'HORÁRIO AZUL';
    if (/AZUL/i.test(flat)) return 'AZUL';
    if (/VERDE/i.test(flat) && /HOR[ÁA]RIO/i.test(flat)) return 'HORÁRIO VERDE';
    if (/VERDE/i.test(flat)) return 'VERDE';
    return EMPTY;
  })();

  // ===== SUBGRUPO =====
  const Subgrupo = (() => {
    // Look for "/A4" or "/B3" etc. in the classification line
    // Must be a letter + single digit, right after "/"
    const m = flat.match(/\/\s*([AB]\d)\s/);
    if (m) return m[1].toUpperCase();
    const classIdx = findLine(lines, /Classifica[çc][aã]o/i);
    if (classIdx >= 0) {
      const region = lines.slice(classIdx, Math.min(classIdx + 3, lines.length)).join(' ');
      const m2 = region.match(/\b([AB][1-4]|AS|BS)\b/);
      if (m2) return m2[1].toUpperCase();
    }
    return EMPTY;
  })();

  const isSplitTariff = /AZUL|VERDE/i.test(flat) && !/CONVENCIONAL/i.test(flat);

  // ===== CONSUMO (text-based, will be overridden by table data if available) =====
  let ConsumoPonta = EMPTY;
  let ConsumoForaPonta = EMPTY;
  let ConsumoTotal = EMPTY;
  let ValorConsumoPonta = EMPTY;
  let ValorConsumoForaPonta = EMPTY;

  if (isSplitTariff) {
    const pontaIdx = findLine(lines, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)/i);
    const fpIdx = findLine(lines, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
    if (pontaIdx >= 0) ConsumoPonta = findNumNearLine(lines, pontaIdx, 1, 8, false);
    if (fpIdx >= 0) ConsumoForaPonta = findNumNearLine(lines, fpIdx, 1, 8, false);
    ValorConsumoPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)/i);
    ValorConsumoForaPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
  } else {
    for (const line of lines) {
      const km = line.match(/^KWH\s*([\d.,]+)$/i);
      if (km) { ConsumoTotal = km[1]; break; }
    }
    if (!ConsumoTotal) {
      const consIdx = findLine(lines, /CONSUMO\s+FATURADO/i);
      if (consIdx >= 0) {
        for (let i = consIdx + 1; i < Math.min(consIdx + 15, lines.length); i++) {
          const line = lines[i];
          if (/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/i.test(line)) continue;
          if (/[A-Za-z]{4,}/.test(line)) continue;
          const m = line.match(/^(\d[\d.]+,\d{2})$/);
          if (m) { ConsumoTotal = m[1]; break; }
        }
      }
    }
    ValorConsumoForaPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh(?!.*Ponta)/i);
  }

  // ===== DEMANDA (text-based, will be overridden by table data if available) =====
  let DemandaContratadaPonta = EMPTY;
  let DemandaContratadaForaPonta = EMPTY;
  let DemandaMedidaPonta = EMPTY;
  let DemandaMedidaForaPonta = EMPTY;
  let DemandaFaturadaPonta = EMPTY;
  let DemandaFaturadaForaPonta = EMPTY;
  let ValorDemandaPonta = EMPTY;
  let ValorDemandaForaPonta = EMPTY;

  if (isSplitTariff) {
    // Try to extract demanda contratada from flat text: "KW Ponta:33" or "KW Ponta: 33"
    const dcMatch = flat.match(/KW\s+Ponta\s*:\s*(\d+(?:[.,]\d+)?)/i);
    if (dcMatch) DemandaContratadaPonta = dcMatch[1].replace('.', ',');
    const dcFpMatch = flat.match(/Fora\s+Ponta\s*:\s*(\d+(?:[.,]\d+)?)/i);
    if (dcFpMatch) DemandaContratadaForaPonta = dcFpMatch[1].replace('.', ',');

    DemandaMedidaPonta = findQtyNearLine(lines, /Demanda\s+Medida.*Ponta(?!.*Fora)/i);
    DemandaMedidaForaPonta = findQtyNearLine(lines, /Demanda\s+Medida.*Fora\s*Ponta/i);
    DemandaFaturadaPonta = findQtyNearLine(lines, /Demanda\s+Fatur[ae]da.*Ponta(?!.*Fora)/i) || DemandaMedidaPonta;
    DemandaFaturadaForaPonta = findQtyNearLine(lines, /Demanda\s+Fatur[ae]da.*Fora\s*Ponta/i) || DemandaMedidaForaPonta;
    ValorDemandaPonta = findRValueNearLine(lines, flat, /Demanda\s+(?:Medida|Fatur[ae]da).*Ponta(?!.*Fora)/i);
    ValorDemandaForaPonta = findRValueNearLine(lines, flat, /Demanda\s+(?:Medida|Fatur[ae]da).*Fora\s*Ponta/i);
  }

  // ===== ULTRAPASSAGEM =====
  let UltrapassagemPonta = EMPTY;
  let UltrapassagemForaPonta = EMPTY;
  let ValorUltrapassagemPonta = EMPTY;
  let ValorUltrapassagemForaPonta = EMPTY;
  // ===== DEMANDA NÃO CONSUMIDA =====
  let DemandaNaoConsumidaPonta = EMPTY;
  let DemandaNaoConsumidaForaPonta = EMPTY;
  let ValorNaoConsumidaPonta = EMPTY;
  let ValorNaoConsumidaForaPonta = EMPTY;
  if (isSplitTariff) {
    UltrapassagemPonta = findQtyNearLine(lines, /Ultrapassagem.*Ponta(?!.*Fora)/i);
    UltrapassagemForaPonta = findQtyNearLine(lines, /Ultrapassagem.*Fora\s*Ponta/i);
    ValorUltrapassagemPonta = findRValueNearLine(lines, flat, /Ultrapassagem.*Ponta(?!.*Fora)/i);
    ValorUltrapassagemForaPonta = findRValueNearLine(lines, flat, /Ultrapassagem.*Fora\s*Ponta/i);
    DemandaNaoConsumidaPonta = findQtyNearLine(lines, /Não\s*Consumida.*Ponta(?!.*(?:Fora|F\s*Ponta))/i);
    DemandaNaoConsumidaForaPonta = findQtyNearLine(lines, /Não\s*Consumida.*(?:Fora|F)\s*Ponta/i);
    ValorNaoConsumidaPonta = findRValueNearLine(lines, flat, /Não\s*Consumida.*Ponta(?!.*(?:Fora|F\s*Ponta))/i);
    ValorNaoConsumidaForaPonta = findRValueNearLine(lines, flat, /Não\s*Consumida.*(?:Fora|F)\s*Ponta/i);
  }

  // ===== REATIVA EXCEDENTE =====
  let ReativaExcedentePonta = EMPTY;
  let ReativaExcedenteForaPonta = EMPTY;
  let EnergiaReativaTotal = EMPTY;
  let ValorReativaExcedentePonta = EMPTY;
  let ValorReativaExcedenteForaPonta = EMPTY;
  if (isSplitTariff) {
    ReativaExcedentePonta = findQtyNearLine(lines, /Reactiv?a\s+Excedente.*Ponta(?!.*Fora)/i);
    ReativaExcedenteForaPonta = findQtyNearLine(lines, /Reactiv?a\s+Excedente.*Fora\s*Ponta/i);
    ValorReativaExcedentePonta = findRValueNearLine(lines, flat, /Reactiv?a\s+Excedente.*Ponta(?!.*Fora)/i);
    ValorReativaExcedenteForaPonta = findRValueNearLine(lines, flat, /Reactiv?a\s+Excedente.*Fora\s*Ponta/i);
  } else {
    EnergiaReativaTotal = findQtyNearLine(lines, /Reactiv?a\s+Excedente/i);
  }

  // ===== TRIBUTOS: PIS, COFINS, ICMS =====
  // Priority: table extraction > text-based extraction
  let PIS = EMPTY;
  let COFINS = EMPTY;
  let ICMS = EMPTY;

  // Use tributos from table extraction if available (most reliable)
  if (tributosFromTable?.pis) PIS = tributosFromTable.pis;
  if (tributosFromTable?.cofins) COFINS = tributosFromTable.cofins;
  if (tributosFromTable?.icms) ICMS = tributosFromTable.icms;

  // Fallback: text-based extraction for any missing tributo
  if (!PIS || !COFINS || !ICMS) {
    const pisIdx = findLine(lines, /^PIS\s*\/\s*$/i);
    if (pisIdx >= 0) {
      const nums: string[] = [];
      for (let i = pisIdx + 1; i < Math.min(pisIdx + 10, lines.length) && nums.length < 3; i++) {
        const lineNums = lines[i].match(/(\d[\d.]*,\d{2})/g);
        if (lineNums) {
          for (const n of lineNums) {
            nums.push(n);
            if (nums.length >= 3) break;
          }
        }
      }
      if (nums.length >= 3) {
        if (!PIS) PIS = nums[0];
        if (!COFINS) COFINS = nums[1];
        if (!ICMS) ICMS = nums[2];
      }
    }
    if (!PIS && !COFINS) {
      const combinedIdx = findLine(lines, /PIS\/\s*COFINS/i);
      if (combinedIdx >= 0) {
        const nums: string[] = [];
        for (let i = combinedIdx + 1; i < Math.min(combinedIdx + 6, lines.length) && nums.length < 3; i++) {
          const m = lines[i].match(/^(\d[\d.]*,\d{2})$/);
          if (m) nums.push(m[1]);
        }
        if (nums.length >= 3) {
          if (!PIS) PIS = nums[0];
          if (!COFINS) COFINS = nums[1];
          if (!ICMS) ICMS = nums[2];
        }
      }
    }
    if (!PIS || !COFINS) {
      const flatMatch = flat.match(/PIS\s*\/\s*COFINS[^\d]*?(\d[\d.]*,\d{2})[^\d]*?(\d[\d.]*,\d{2})/i);
      if (flatMatch) {
        if (!PIS) PIS = flatMatch[1];
        if (!COFINS) COFINS = flatMatch[2];
      }
    }
    if (!PIS) PIS = findTributoValue(lines, flat, /\bPIS\b(?!\/)/i);
    if (!COFINS) COFINS = findTributoValue(lines, flat, /\bCOFINS\b/i);
    if (!ICMS) ICMS = findTributoValue(lines, flat, /\bICMS\b(?!\s*%|\s*\()/i);
  }

  // ===== GDI =====
  const GDI = findTributoValue(lines, flat, /\bGDI\b/i);

  // ===== CIP (text-based) =====
  const CIP_text = (() => {
    const cipIdx = findLine(lines, /CIP\s*MUNICIPAL/i);
    if (cipIdx >= 0) {
      const region = lines.slice(Math.max(0, cipIdx - 1), Math.min(cipIdx + 5, lines.length)).join(' ');
      const money = findAllMoney(region);
      if (money.length > 0) return money[money.length - 1];
    }
    return findTributoValue(lines, flat, /\bCIP\b/i);
  })();

  // ===== ENERGIA ATIVA INJETADA GDI oUC / mUC =====
  let {
    oUC_Qtd: EnergiaAtvInjetadaGDIoUC_Qtd,
    oUC_Valor: EnergiaAtvInjetadaGDIoUC_Valor,
    mUC_Qtd: EnergiaAtvInjetadaGDImUC_Qtd,
    mUC_Valor: EnergiaAtvInjetadaGDImUC_Valor,
  } = extractGDI(lines, flat);

  // ===== SALDO ACUMULADO GD =====
  const SaldoAcumuladoGD = (() => {
    const m = flat.match(/Saldo\s*Acumulado\s*:\s*([\d.]+,\d{2})/i);
    if (m) return m[1];
    // Fallback: integer format like "14.100"
    const m2 = flat.match(/Saldo\s*Acumulado\s*:\s*(\d[\d.]*)/i);
    if (m2) return m2[1];
    return EMPTY;
  })();

  // ===== VALOR TOTAL =====
  // Best pattern: R$ value on same line as vencimento date + mes referência
  // e.g., "21/07/2026R$ 13.356,50Junho / 2026"
  const ValorTotal = (() => {
    // Strategy 1: R$ on same line as date and mes referência (most reliable)
    const venTotal = flat.match(/\d{2}\/\d{2}\/\d{4}\s*R\$\s*([\d.]+,\d{2})/);
    if (venTotal) return venTotal[1];

    // Strategy 2: R$ + value + mes referência on same line
    const totalMes = flat.match(/R\$\s*([\d.]+,\d{2})\s*(?:Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)/i);
    if (totalMes) return totalMes[1];

    // Strategy 3: "TOTAL A PAGAR" with R$
    const totalIdx = findLine(lines, /TOTAL\s+A\s+PAGAR/i);
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

    // Strategy 4: Last resort - largest R$ value
    const lastMoney = findAllMoney(flat);
    if (lastMoney.length > 0) {
      lastMoney.sort((a, b) => parseFloat(b.replace('.', '').replace(',', '.')) - parseFloat(a.replace('.', '').replace(',', '.')));
      return lastMoney[0];
    }
    return EMPTY;
  })();

  // ===== TABLE DATA OVERRIDES =====
  // Table data from pdfjs position-based extraction is much more reliable for tabular data
  let CIP = CIP_text;

  if (tableData && tableData.length > 0) {
    let cipFromTable = EMPTY;
    // Reset GDI accumulators for clean table-based extraction
    let tbl_oUC_Qtd = '' as string;
    let tbl_oUC_Valor = '' as string;
    let tbl_mUC_Qtd = '' as string;
    let tbl_mUC_Valor = '' as string;
    // Track GDI section in table for rows with truncated/missing labels
    let inGDISection = false;
    let gdiSectionType = '' as string; // 'oUC' or 'mUC'
    let lastGDILabel = '' as string;

    for (const item of tableData) {
      const lbl = item.label;
      const isFora = /Fora/i.test(lbl) || /F[\s.]*Ponta/i.test(lbl);
      const isPonta = /Ponta/i.test(lbl) && !isFora;

      // Consumo - check Convencional (no Ponta/Fora) first, then split
      if (/Consumo\s+em\s+kWh/i.test(lbl) && !/Reativ/i.test(lbl) && !/Injetada/i.test(lbl)) {
        // Convencional: label is exactly "Consumo em kWh" without Ponta/Fora
        if (!/Ponta/i.test(lbl) && !/Fora/i.test(lbl) && !/Intermedi/i.test(lbl)) {
          if (item.quantidade) ConsumoTotal = item.quantidade;
          if (item.valor) ValorConsumoForaPonta = item.valor;
        }
        // VERDE Intermediária
        else if (/Intermedi[áa]ria/i.test(lbl)) {
          if (item.quantidade && !ConsumoForaPonta) ConsumoForaPonta = item.quantidade;
        }
        // Split tariff (AZUL/VERDE)
        else if (isPonta) {
          if (item.quantidade) ConsumoPonta = item.quantidade;
          if (item.valor) ValorConsumoPonta = item.valor;
        } else if (isFora) {
          if (item.quantidade) ConsumoForaPonta = item.quantidade;
          if (item.valor) ValorConsumoForaPonta = item.valor;
        }
      }
      // Demanda Medida
      else if (/Demanda.*Medida/i.test(lbl) && !/Ultrapassagem/i.test(lbl) && !/Não.*Consumida/i.test(lbl)) {
        if (!isFora) {
          if (item.quantidade) DemandaMedidaPonta = item.quantidade;
          if (item.valor) ValorDemandaPonta = item.valor;
        } else {
          if (item.quantidade) DemandaMedidaForaPonta = item.quantidade;
          if (item.valor) ValorDemandaForaPonta = item.valor;
        }
      }
      // Ultrapassagem
      else if (/(?:Ultrapassagem|Ultrap)/i.test(lbl) && /Demanda/i.test(lbl) && !/Não\s*Consumida/i.test(lbl)) {
        if (!isFora) {
          if (item.quantidade) UltrapassagemPonta = item.quantidade;
          if (item.valor) ValorUltrapassagemPonta = item.valor;
        } else {
          if (item.quantidade) UltrapassagemForaPonta = item.quantidade;
          if (item.valor) ValorUltrapassagemForaPonta = item.valor;
        }
      }
      // Demanda Potência Não Consumida
      else if (/Não\s*Consumida/i.test(lbl) && /Demanda/i.test(lbl)) {
        if (!isFora) {
          if (item.quantidade) DemandaNaoConsumidaPonta = item.quantidade;
          if (item.valor) ValorNaoConsumidaPonta = item.valor;
        } else {
          if (item.quantidade) DemandaNaoConsumidaForaPonta = item.quantidade;
          if (item.valor) ValorNaoConsumidaForaPonta = item.valor;
        }
      }
      // Reativa Excedente
      else if (/Reactiv?a\s*Excedente/i.test(lbl) || /Energia\s*Reativa\s*Exced/i.test(lbl)) {
        if (!isFora && /Ponta/i.test(lbl)) {
          if (item.quantidade) ReativaExcedentePonta = item.quantidade;
          if (item.valor) ValorReativaExcedentePonta = item.valor;
        } else if (isFora || /F[\s.]*Ponta/i.test(lbl)) {
          if (item.quantidade) ReativaExcedenteForaPonta = item.quantidade;
          if (item.valor) ValorReativaExcedenteForaPonta = item.valor;
        } else if (!isFora && !/Ponta/i.test(lbl)) {
          // Generic reativa (Convencional)
          if (item.quantidade) EnergiaReativaTotal = item.quantidade;
          if (item.valor) ValorReativaExcedentePonta = item.valor;
        }
      }
      // CIP Municipal
      else if (/CIP\s*MUNICIPAL/i.test(lbl) || /^CONT\.IL\.PUB/i.test(lbl)) {
        if (item.valor) cipFromTable = item.valor;
      }
      // GDI items
      else if (/Energia\s*Atv\s*Injetada\s*GDI\s*oUC/i.test(lbl)) {
        if (item.quantidade && !tbl_oUC_Qtd) tbl_oUC_Qtd = item.quantidade;
        if (item.valor && !tbl_oUC_Valor) tbl_oUC_Valor = item.valor;
        inGDISection = true; gdiSectionType = 'oUC'; lastGDILabel = lbl;
      } else if (/Energia\s*Atv\s*Injetada\s*GDI\s*mUC/i.test(lbl)) {
        // Multiple mUC entries: accumulate
        if (item.quantidade) {
          tbl_mUC_Qtd = tbl_mUC_Qtd
            ? fmtSumBR(tbl_mUC_Qtd, item.quantidade)
            : item.quantidade;
        }
        if (item.valor) {
          tbl_mUC_Valor = tbl_mUC_Valor
            ? fmtSumBR(tbl_mUC_Valor, item.valor)
            : item.valor;
        }
        inGDISection = true; gdiSectionType = 'mUC'; lastGDILabel = lbl;
      } else if (inGDISection && (/^K?WH$/i.test(lbl.trim()) || lbl.trim() === '') && item.quantidade) {
        // Row with truncated/missing label inside GDI section (e.g. just "KWH" or empty)
        // Accumulate as the same GDI type as the last full-label row
        if (gdiSectionType === 'mUC') {
          tbl_mUC_Qtd = tbl_mUC_Qtd
            ? fmtSumBR(tbl_mUC_Qtd, item.quantidade)
            : item.quantidade;
          if (item.valor) {
            tbl_mUC_Valor = tbl_mUC_Valor
              ? fmtSumBR(tbl_mUC_Valor, item.valor)
              : item.valor;
          }
        } else if (gdiSectionType === 'oUC') {
          tbl_oUC_Qtd = tbl_oUC_Qtd
            ? fmtSumBR(tbl_oUC_Qtd, item.quantidade)
            : item.quantidade;
          if (item.valor) {
            tbl_oUC_Valor = tbl_oUC_Valor
              ? fmtSumBR(tbl_oUC_Valor, item.valor)
              : item.valor;
          }
        }
      } else if (lbl.trim() !== '' && !/^K?WH$/i.test(lbl.trim())) {
        // Non-GDI, non-truncated row ends the GDI section
        inGDISection = false;
      }
    }

    // Override CIP from table
    if (cipFromTable) CIP = cipFromTable;

    // Use table GDI values if found, otherwise keep text-based fallback
    if (tbl_oUC_Qtd) EnergiaAtvInjetadaGDIoUC_Qtd = tbl_oUC_Qtd;
    if (tbl_oUC_Valor) EnergiaAtvInjetadaGDIoUC_Valor = tbl_oUC_Valor;
    if (tbl_mUC_Qtd) EnergiaAtvInjetadaGDImUC_Qtd = tbl_mUC_Qtd;
    if (tbl_mUC_Valor) EnergiaAtvInjetadaGDImUC_Valor = tbl_mUC_Valor;
  }

  return {
    UC: cleanUC, Cidade, Tipo, Mercado, Concessionaria,
    MesReferencia, AnoLeitura, Vencimento, NotaFiscal,
    ModalidadeTarifaria, Subgrupo,
    ConsumoPonta, ConsumoForaPonta, ConsumoTotal,
    DemandaContratadaPonta, DemandaContratadaForaPonta,
    DemandaMedidaPonta, DemandaMedidaForaPonta,
    DemandaFaturadaPonta, DemandaFaturadaForaPonta,
    UltrapassagemPonta, UltrapassagemForaPonta,
    DemandaNaoConsumidaPonta, DemandaNaoConsumidaForaPonta,
    ValorNaoConsumidaPonta, ValorNaoConsumidaForaPonta,
    ReativaExcedentePonta, ReativaExcedenteForaPonta,
    ValorConsumoPonta, ValorConsumoForaPonta,
    ValorDemandaPonta, ValorDemandaForaPonta,
    ValorUltrapassagemPonta, ValorUltrapassagemForaPonta,
    ValorReativaExcedentePonta, ValorReativaExcedenteForaPonta,
    PIS, COFINS, ICMS, GDI, CIP,
    EnergiaReativaTotal,
    EnergiaAtvInjetadaGDIoUC_Qtd, EnergiaAtvInjetadaGDIoUC_Valor,
    EnergiaAtvInjetadaGDImUC_Qtd, EnergiaAtvInjetadaGDImUC_Valor,
    SaldoAcumuladoGD,
    ValorTotal,
  };
}

// ===================== GDI EXTRACTION =====================

function extractGDI(lines: string[], flat: string) {
  const EMPTY = '';
  let nOUC = 0;
  let nMUC = 0;
  let firstGDI = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/Energia\s*Atv\s*Injetada\s*GDI\s*oUC/i.test(lines[i])) {
      nOUC++;
      if (firstGDI < 0) firstGDI = i;
    } else if (/Energia\s*Atv\s*Injetada\s*GDI\s*mUC/i.test(lines[i])) {
      nMUC++;
      if (firstGDI < 0) firstGDI = i;
    }
  }

  if (nOUC === 0 && nMUC === 0) {
    return { oUC_Qtd: EMPTY, oUC_Valor: EMPTY, mUC_Qtd: EMPTY, mUC_Valor: EMPTY };
  }

  const chaveIdx = (() => {
    for (let i = firstGDI; i < Math.min(firstGDI + 100, lines.length); i++) {
      if (/^chave de acesso:\s*$/i.test(lines[i])) return i;
    }
    return -1;
  })();

  let sectionEnd = Math.min(firstGDI + 100, lines.length);
  for (let i = firstGDI; i < Math.min(firstGDI + 120, lines.length); i++) {
    if (/^(Declara[cç]|EMITIDO EM|NOTA FISCAL N|Importante:)/i.test(lines[i])) {
      sectionEnd = i; break;
    }
  }
  if (chaveIdx >= 0) {
    sectionEnd = Math.min(Math.max(sectionEnd, chaveIdx + 20), lines.length);
  }

  const allQtds: number[] = [];
  if (chaveIdx >= 0) {
    for (let i = chaveIdx + 1; i < Math.min(chaveIdx + 20, sectionEnd); i++) {
      const m = lines[i].match(/^(\d[\d.]*,\d{2})$/);
      if (m) allQtds.push(parseBR(m[1]));
    }
  }
  if (allQtds.length === 0) {
    for (let i = firstGDI; i < sectionEnd; i++) {
      const m = lines[i].match(/^(\d[\d.]+,\d{2})$/);
      if (m && parseBR(m[1]) >= 100) allQtds.push(parseBR(m[1]));
      if (allQtds.length >= nOUC + nMUC) break;
    }
  }

  const allRVals: number[] = [];
  const rSearchEnd = chaveIdx >= 0 ? chaveIdx : sectionEnd;
  const totalNeeded = nOUC + nMUC;

  for (let i = firstGDI; i < rSearchEnd; i++) {
    const m = lines[i].match(/^(.+?)-((?:\d{1,3}\.)*\d+,\d{2})$/);
    if (m && allRVals.length < totalNeeded) {
      allRVals.push(parseBR('-' + m[2]));
    }
  }
  if (allRVals.length < totalNeeded) {
    for (let i = firstGDI; i < rSearchEnd; i++) {
      const m = lines[i].match(/^(-\d[\d.]*,\d{2})$/);
      if (m && allRVals.length < totalNeeded) {
        allRVals.push(parseBR(m[1]));
      }
    }
  }

  const oUCQtds = allQtds.splice(0, nOUC);
  const oUCRVals = allRVals.splice(0, nOUC);

  const sumQtd = (arr: number[]) => arr.length > 0 ? fmtBRNumber(arr.reduce((a, b) => a + b, 0)) : EMPTY;
  const sumR = (arr: number[]) => arr.length > 0 ? fmtBRNumber(Math.abs(arr.reduce((a, b) => a + b, 0))) : EMPTY;

  return {
    oUC_Qtd: sumQtd(oUCQtds),
    oUC_Valor: sumR(oUCRVals),
    mUC_Qtd: sumQtd(allQtds),
    mUC_Valor: sumR(allRVals),
  };
}

// ===================== NUMBER FORMATTING =====================

function fmtBRNumber(n: number): string {
  const abs = Math.abs(n);
  const intPart = Math.floor(abs).toString();
  const decPart = Math.round((abs - Math.floor(abs)) * 100).toString().padStart(2, '0');
  let formatted = '';
  for (let i = intPart.length - 1, c = 0; i >= 0; i--, c++) {
    if (c > 0 && c % 3 === 0) formatted = '.' + formatted;
    formatted = intPart[i] + formatted;
  }
  return (n < 0 ? '-' : '') + formatted + ',' + decPart;
}

function fmtSumBR(a: string, b: string): string {
  return fmtBRNumber(parseBR(a) + parseBR(b));
}

// ===================== ITEM HELPERS =====================

function findQtyNearLine(lines: string[], labelPattern: RegExp): string {
  const idx = findLine(lines, labelPattern);
  if (idx < 0) return EMPTY;
  for (let i = idx + 1; i < Math.min(idx + 10, lines.length); i++) {
    const line = lines[i];
    if (/[A-Za-z]{4,}/.test(line) && !/kWh|kW|R\$|tarifa/i.test(line)) continue;
    const m = line.match(/([\d.]+,\d{2})/);
    if (m) return m[1];
  }
  return EMPTY;
}

function findRValueNearLine(lines: string[], flat: string, labelPattern: RegExp): string {
  const idx = findLine(lines, labelPattern);
  if (idx < 0) return EMPTY;
  const region = lines.slice(idx, Math.min(idx + 12, lines.length)).join(' ');
  const moneyVals = findAllMoney(region);
  if (moneyVals.length > 0) return moneyVals[moneyVals.length - 1];
  return EMPTY;
}

function findTributoValue(lines: string[], flat: string, labelPattern: RegExp): string {
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
