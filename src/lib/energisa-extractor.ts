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
  EnergiaAtvInjetadaGDIoUC_Qtd: string;
  EnergiaAtvInjetadaGDIoUC_Valor: string;
  EnergiaAtvInjetadaGDImUC_Qtd: string;
  EnergiaAtvInjetadaGDImUC_Valor: string;
  ValorTotal: string;
}

const EMPTY = '';

// ===================== HELPERS =====================

// Parse Brazilian number format: "1.135,00" → 1135.00, "-110,49" → -110.49
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

export function extractEnergisaData(rawText: string): EnergisaInvoiceData {
  const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  const flat = lines.join(' ');

  // ===== CONCESSIONÁRIA =====
  // Full company name on its own line near the top
  const Concessionaria = (() => {
    for (const line of lines.slice(0, 20)) {
      if (/^ENERGISA/i.test(line) && line.length > 15 && !/\d{2}\s*\/\s*\d{2}/.test(line)) {
        return line.replace(/\s+/g, ' ');
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
  // Look for classification line: "SERVIÇO PÚBLICO / ÁGUA, ESGOTO E SANEAMENTO"
  const Mercado = (() => {
    const m = flat.match(/SERVI[ÇC]O\s+P[ÚU]BLICO\s*\/\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú,\s]{3,40}?)(?:\s*TENSÃO|\s*\d|\s*$)/i);
    if (m) {
      const val = m[1].trim().replace(/\s+/g, ' ');
      if (val.length < 50) return val.toUpperCase();
    }
    return EMPTY;
  })();

  // ===== CIDADE =====
  // Pattern: "DOURADOS (AG: 10)"
  const Cidade = (() => {
    for (const line of lines.slice(0, 60)) {
      const m = line.match(/([A-ZÀ-Ú]{4,25})\s*\(\s*AG\s*:\s*\d+\s*\)/);
      if (m) {
        const name = m[1].toUpperCase();
        // Skip company names
        const skip = ['SANESUL', 'ENERGISA', 'DISTRIBUIDORA', 'SA'];
        if (!skip.includes(name)) return name;
      }
    }
    return EMPTY;
  })();

  // ===== UC =====
  // Pattern: dotted format X.XXX.XXX-XX on its own line or with "KWH" prefix
  const UC = (() => {
    // Strategy 1: line with only UC (e.g., "3.562.051-59", "43.210.051-68", "131.752.051-07")
    for (const line of lines) {
      const m = line.match(/^(\d{1,3}\.\d{3}\.\d{3}-\d{2})$/);
      if (m) return m[1];
    }
    // Strategy 2: UC embedded in short line
    for (const line of lines) {
      const m = line.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
      if (m && line.length < 40 && !/CNPJ|CPF|CEP/i.test(line)) return m[1];
    }
    // Strategy 3: broad search
    const broad = flat.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
    return broad ? broad[1] : EMPTY;
  })();

  // ===== MÊS REFERÊNCIA =====
  // Pattern: "Junho / 2026" or "JUNHO / 2026"
  const MesReferencia = (() => {
    const meses = 'Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';
    const numToMonth: Record<string, string> = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
    };
    // Named month pattern
    const nameMatch = flat.match(new RegExp(`(${meses})\\s*[\\/\\-]\\s*(\\d{4})`, 'i'));
    if (nameMatch) {
      const month = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      return `${month} / ${nameMatch[2]}`;
    }
    // Numeric month pattern (e.g., "06/2026")
    const numMatch = flat.match(/(\d{2})\s*[\\/]\s*(\d{4})/);
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
  // ENERGISA PDFs often concatenate "VENCIMENTO" with other labels like "MATRÍCULA"
  // The date may appear BEFORE or AFTER the label
  const Vencimento = (() => {
    // Strategy 1: find line containing VENCIMENTO (even concatenated), check nearby for date
    const venIdx = findLine(lines, /VENCIMENTO/i);
    if (venIdx >= 0) {
      // Check lines BEFORE the label (ENERGISA often puts date before)
      for (let i = venIdx - 1; i >= Math.max(0, venIdx - 5); i--) {
        const m = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
        if (m) return m[1];
      }
      // Check lines AFTER the label
      for (let i = venIdx + 1; i < Math.min(venIdx + 3, lines.length); i++) {
        const m = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
        if (m) return m[1];
      }
      // Check same line
      const sameLine = lines[venIdx].match(/(\d{2}\/\d{2}\/\d{4})/);
      if (sameLine) return sameLine[1];
    }
    // Strategy 2: "TOTAL A PAGAR" area - date often nearby
    const totalIdx = findLine(lines, /TOTAL\s+A\s+PAGAR/i);
    if (totalIdx >= 0) {
      for (let i = totalIdx - 3; i <= Math.min(totalIdx + 3, lines.length - 1); i++) {
        if (i < 0) continue;
        const m = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
        if (m) return m[1];
      }
    }
    return EMPTY;
  })();

  // ===== NOTA FISCAL =====
  const NotaFiscal = (() => {
    const m = flat.match(/NOTA\s+FISCAL\s*N[º°]?\s*[:\-]?\s*(\d[\d.]*)/i);
    return m ? m[1] : EMPTY;
  })();

  // ===== MODALIDADE TARIFÁRIA =====
  const ModalidadeTarifaria = (() => {
    // In the classification line: "MTC-CONVENCIONAL BAIXA TENSÃO / B3"
    if (/CONVENCIONAL/i.test(flat)) return 'CONVENCIONAL';
    if (/AZUL/i.test(flat) && /HOR[ÁA]RIO/i.test(flat)) return 'HORÁRIO AZUL';
    if (/AZUL/i.test(flat)) return 'AZUL';
    if (/VERDE/i.test(flat) && /HOR[ÁA]RIO/i.test(flat)) return 'HORÁRIO VERDE';
    if (/VERDE/i.test(flat)) return 'VERDE';
    return EMPTY;
  })();

  // ===== SUBGRUPO =====
  // Pattern: "/ B3" in classification line
  const Subgrupo = (() => {
    const m = flat.match(/\/(\s*[AB]\d?\s*)(?:\s|\/|$)/);
    if (m) return m[1].trim().toUpperCase();
    // Fallback: search in classification area
    const classIdx = findLine(lines, /Classifica[çc][aã]o/i);
    if (classIdx >= 0) {
      const region = lines.slice(classIdx, Math.min(classIdx + 3, lines.length)).join(' ');
      const m2 = region.match(/\b([AB][1-4]|AS|BS)\b/);
      if (m2) return m2[1].toUpperCase();
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
    const pontaIdx = findLine(lines, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)/i);
    const fpIdx = findLine(lines, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
    if (pontaIdx >= 0) ConsumoPonta = findNumNearLine(lines, pontaIdx, 1, 8, false);
    if (fpIdx >= 0) ConsumoForaPonta = findNumNearLine(lines, fpIdx, 1, 8, false);
    ValorConsumoPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)/i);
    ValorConsumoForaPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
  } else {
    // Convencional: look for "KWH1.044,00" or "KWH 1.044,00"
    for (const line of lines) {
      const km = line.match(/^KWH\s*([\d.,]+)$/i);
      if (km) { ConsumoTotal = km[1]; break; }
    }
    // Fallback: "CONSUMO FATURADO" area
    if (!ConsumoTotal) {
      const consIdx = findLine(lines, /CONSUMO\s+FATURADO/i);
      if (consIdx >= 0) {
        // Look for numbers near CONSUMO FATURADO, but skip the month reference line
        for (let i = consIdx + 1; i < Math.min(consIdx + 15, lines.length); i++) {
          const line = lines[i];
          if (/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/i.test(line)) continue;
          if (/[A-Za-z]{4,}/.test(line)) continue;
          const m = line.match(/^([\d.]+,\d{2})$/);
          if (m) { ConsumoTotal = m[1]; break; }
        }
      }
    }
    // R$ value for consumo (Convencional)
    ValorConsumoForaPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh(?!.*Ponta)/i);
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
    DemandaContratadaPonta = findQtyNearLine(lines, /Demanda\s+Contrat[ae]da.*Ponta(?![^\n]*Fora)/i);
    DemandaContratadaForaPonta = findQtyNearLine(lines, /Demanda\s+Contrat[ae]da.*Fora\s*Ponta/i);
    DemandaMedidaPonta = findQtyNearLine(lines, /Demanda\s+Medida.*Ponta(?![^\n]*Fora)/i);
    DemandaMedidaForaPonta = findQtyNearLine(lines, /Demanda\s+Medida.*Fora\s*Ponta/i);
    DemandaFaturadaPonta = findQtyNearLine(lines, /Demanda\s+Fatur[ae]da.*Ponta(?![^\n]*Fora)/i) || DemandaMedidaPonta;
    DemandaFaturadaForaPonta = findQtyNearLine(lines, /Demanda\s+Fatur[ae]da.*Fora\s*Ponta/i) || DemandaMedidaForaPonta;
    ValorDemandaPonta = findRValueNearLine(lines, flat, /Demanda\s+(?:Medida|Fatur[ae]da).*Ponta(?![^\n]*Fora)/i);
    ValorDemandaForaPonta = findRValueNearLine(lines, flat, /Demanda\s+(?:Medida|Fatur[ae]da).*Fora\s*Ponta/i);
  }

  // ===== ULTRAPASSAGEM (only split tariffs) =====
  let UltrapassagemPonta = EMPTY;
  let UltrapassagemForaPonta = EMPTY;
  let ValorUltrapassagemPonta = EMPTY;
  let ValorUltrapassagemForaPonta = EMPTY;
  if (isSplitTariff) {
    UltrapassagemPonta = findQtyNearLine(lines, /Ultrapassagem.*Ponta(?![^\n]*Fora)/i);
    UltrapassagemForaPonta = findQtyNearLine(lines, /Ultrapassagem.*Fora\s*Ponta/i);
    ValorUltrapassagemPonta = findRValueNearLine(lines, flat, /Ultrapassagem.*Ponta(?![^\n]*Fora)/i);
    ValorUltrapassagemForaPonta = findRValueNearLine(lines, flat, /Ultrapassagem.*Fora\s*Ponta/i);
  }

  // ===== REATIVA EXCEDENTE =====
  let ReativaExcedentePonta = EMPTY;
  let ReativaExcedenteForaPonta = EMPTY;
  let EnergiaReativaTotal = EMPTY;
  let ValorReativaExcedentePonta = EMPTY;
  let ValorReativaExcedenteForaPonta = EMPTY;
  if (isSplitTariff) {
    ReativaExcedentePonta = findQtyNearLine(lines, /Reactiv?a\s+Excedente.*Ponta(?![^\n]*Fora)/i);
    ReativaExcedenteForaPonta = findQtyNearLine(lines, /Reactiv?a\s+Excedente.*Fora\s*Ponta/i);
    ValorReativaExcedentePonta = findRValueNearLine(lines, flat, /Reactiv?a\s+Excedente.*Ponta(?![^\n]*Fora)/i);
    ValorReativaExcedenteForaPonta = findRValueNearLine(lines, flat, /Reactiv?a\s+Excedente.*Fora\s*Ponta/i);
  } else {
    EnergiaReativaTotal = findQtyNearLine(lines, /Reactiv?a\s+Excedente/i);
  }

  // ===== TRIBUTOS: PIS, COFINS, ICMS =====
  // ENERGISA format (from real PDF):
  // Line N: "PIS/"  Line N+1: "COFINS (R$)"  Line N+2: "18,47 85,09 236,20"
  // Or on the same flat section: "PIS/COFINS (R$) 18,47 85,09 236,20"
  let PIS = EMPTY;
  let COFINS = EMPTY;
  let ICMS = EMPTY;

  (() => {
    // Strategy 1: Find "PIS/" line (the label is split)
    const pisIdx = findLine(lines, /^PIS\s*\/\s*$/i);
    if (pisIdx >= 0) {
      // Next line might be "COFINS (R$)" or values
      // Check next few lines for the 3 consecutive numbers
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
        PIS = nums[0]; COFINS = nums[1]; ICMS = nums[2];
      }
    }
    // Strategy 2: "PIS/COFINS" on same line
    if (!PIS && !COFINS) {
      const combinedIdx = findLine(lines, /PIS\/\s*COFINS/i);
      if (combinedIdx >= 0) {
        const nums: string[] = [];
        for (let i = combinedIdx + 1; i < Math.min(combinedIdx + 6, lines.length) && nums.length < 3; i++) {
          const m = lines[i].match(/^(\d[\d.]*,\d{2})$/);
          if (m) nums.push(m[1]);
        }
        if (nums.length >= 3) {
          PIS = nums[0]; COFINS = nums[1]; ICMS = nums[2];
        }
      }
    }
    // Strategy 3: flat text search
    if (!PIS || !COFINS) {
      const flatMatch = flat.match(/PIS\s*\/\s*COFINS[^\d]*?(\d[\d.]*,\d{2})[^\d]*?(\d[\d.]*,\d{2})/i);
      if (flatMatch) {
        if (!PIS) PIS = flatMatch[1];
        if (!COFINS) COFINS = flatMatch[2];
      }
    }
    // Strategy 4: Individual fallback
    if (!PIS) PIS = findTributoValue(lines, flat, /\bPIS\b(?!\/)/i);
    if (!COFINS) COFINS = findTributoValue(lines, flat, /\bCOFINS\b/i);
    if (!ICMS) ICMS = findTributoValue(lines, flat, /\bICMS\b(?!\s*%)/i);
  })();

  // ===== GDI =====
  const GDI = findTributoValue(lines, flat, /\bGDI\b/i);

  // ===== ENERGIA ATIVA INJETADA GDI oUC / mUC =====
  // ENERGISA GDI tabular layout: quantities appear as standalone numbers
  // after "chave de acesso:", R$ values are negative numbers before it.
  // When multiple mUC entries exist, they must be SUMMED.
  const {
    oUC_Qtd: EnergiaAtvInjetadaGDIoUC_Qtd,
    oUC_Valor: EnergiaAtvInjetadaGDIoUC_Valor,
    mUC_Qtd: EnergiaAtvInjetadaGDImUC_Qtd,
    mUC_Valor: EnergiaAtvInjetadaGDImUC_Valor,
  } = (() => {
    // Count how many oUC and mUC label lines exist
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
    if (nOUC === 0 && nMUC === 0) return { oUC_Qtd: EMPTY, oUC_Valor: EMPTY, mUC_Qtd: EMPTY, mUC_Valor: EMPTY };

    // Find "chave de acesso:" as section anchor
    const chaveIdx = (() => {
      for (let i = firstGDI; i < Math.min(firstGDI + 40, lines.length); i++) {
        if (/^chave de acesso:\s*$/i.test(lines[i])) return i;
      }
      return -1;
    })();

    // Find section end boundary
    let sectionEnd = Math.min(firstGDI + 45, lines.length);
    for (let i = firstGDI; i < Math.min(firstGDI + 55, lines.length); i++) {
      if (/^(Declara[cç]|EMITIDO EM|NOTA FISCAL N|Importante:)/i.test(lines[i])) { sectionEnd = i; break; }
    }

    // --- Quantities (kWh) after "chave de acesso:" ---
    const allQtds: number[] = [];
    if (chaveIdx >= 0) {
      for (let i = chaveIdx + 1; i < Math.min(chaveIdx + 10, sectionEnd); i++) {
        const m = lines[i].match(/^(\d[\d.]*,\d{2})$/);
        if (m) allQtds.push(parseBR(m[1]));
      }
    }
    // Fallback: large standalone numbers in GDI section
    if (allQtds.length === 0) {
      for (let i = firstGDI; i < sectionEnd; i++) {
        const m = lines[i].match(/^(\d[\d.]+,\d{2})$/);
        if (m && parseBR(m[1]) >= 100) allQtds.push(parseBR(m[1]));
        if (allQtds.length >= nOUC + nMUC) break;
      }
    }

    // --- R$ Values (negative numbers before "chave de acesso:") ---
    const allRVals: number[] = [];
    const rSearchEnd = chaveIdx >= 0 ? chaveIdx : sectionEnd;
    for (let i = firstGDI; i < rSearchEnd; i++) {
      const m = lines[i].match(/^(-\d[\d.]*,\d{2})$/);
      if (m) allRVals.push(parseBR(m[1]));
    }

    // Split: first nOUC values → oUC, next nMUC → mUC (sum each group)
    const oUCQtds = allQtds.splice(0, nOUC);
    const oUCRVals = allRVals.splice(0, nOUC);
    // Remaining are mUC
    const mUCQtds = allQtds; // already spliced
    const mUCRVals = allRVals;

    const fmt = (n: number) => n.toFixed(2).replace('.', ',');
    const fmtInt = (n: number) => {
      const abs = Math.abs(n);
      const intPart = Math.floor(abs).toString();
      const decPart = Math.round((abs - Math.floor(abs)) * 100).toString().padStart(2, '0');
      let formatted = '';
      for (let i = intPart.length - 1, c = 0; i >= 0; i--, c++) {
        if (c > 0 && c % 3 === 0) formatted = '.' + formatted;
        formatted = intPart[i] + formatted;
      }
      return (n < 0 ? '-' : '') + formatted + ',' + decPart;
    };

    const sumQtd = (arr: number[]) => arr.length > 0 ? fmtInt(arr.reduce((a, b) => a + b, 0)) : EMPTY;
    const sumR = (arr: number[]) => arr.length > 0 ? fmtInt(arr.reduce((a, b) => a + b, 0)) : EMPTY;

    return {
      oUC_Qtd: sumQtd(oUCQtds),
      oUC_Valor: sumR(oUCRVals),
      mUC_Qtd: sumQtd(mUCQtds),
      mUC_Valor: sumR(mUCRVals),
    };
  })();

  // ===== CIP =====
  const CIP = (() => {
    const cipIdx = findLine(lines, /CIP\s*MUNICIPAL/i);
    if (cipIdx >= 0) {
      // Look on same line and nearby for R$ value
      const region = lines.slice(Math.max(0, cipIdx - 1), Math.min(cipIdx + 5, lines.length)).join(' ');
      const money = findAllMoney(region);
      if (money.length > 0) return money[money.length - 1];
    }
    return findTributoValue(lines, flat, /\bCIP\b/i);
  })();

  // ===== VALOR TOTAL =====
  const ValorTotal = (() => {
    // Strategy 1: "TOTAL A PAGAR" with R$ on same or next line
    const totalIdx = findLine(lines, /TOTAL\s+A\s+PAGAR/i);
    if (totalIdx >= 0) {
      // Check same line
      const m1 = lines[totalIdx].match(/R\$\s*([\d.]+,\d{2})/);
      if (m1) return m1[1];
      // Check next lines
      for (let i = totalIdx + 1; i < Math.min(totalIdx + 3, lines.length); i++) {
        const m2 = lines[i].match(/R\$\s*([\d.]+,\d{2})/);
        if (m2) return m2[1];
        const m3 = lines[i].match(/^(\d[\d.]+,\d{2})$/);
        if (m3) return m3[1];
      }
    }
    // Strategy 2: flat search
    const flatMatch = flat.match(/TOTAL\s*A\s+PAGAR[^\d]*?R\$\s*([\d.]+,\d{2})/i);
    if (flatMatch) return flatMatch[1];
    // Strategy 3: "R$ X.XXX,XX" near end of document
    const lastMoney = findAllMoney(flat);
    if (lastMoney.length > 0) {
      // The total is typically one of the largest values
      lastMoney.sort((a, b) => parseFloat(b.replace('.', '').replace(',', '.')) - parseFloat(a.replace('.', '').replace(',', '.')));
      return lastMoney[0];
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
    EnergiaReativaTotal,
    EnergiaAtvInjetadaGDIoUC_Qtd, EnergiaAtvInjetadaGDIoUC_Valor,
    EnergiaAtvInjetadaGDImUC_Qtd, EnergiaAtvInjetadaGDImUC_Valor,
    ValorTotal,
  };
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
  { category: 'Energia Injetada GDI oUC', fields: ['EnergiaAtvInjetadaGDIoUC_Qtd', 'EnergiaAtvInjetadaGDIoUC_Valor'] },
  { category: 'Energia Injetada GDI mUC', fields: ['EnergiaAtvInjetadaGDImUC_Qtd', 'EnergiaAtvInjetadaGDImUC_Valor'] },
  { category: 'Total', fields: ['ValorTotal'] },
];
