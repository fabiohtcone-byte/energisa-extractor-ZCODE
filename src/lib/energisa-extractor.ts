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

// ===================== HELPER FUNCTIONS =====================

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

function findAllLineIdx(lines: string[], pattern: RegExp): number[] {
  return lines.reduce((acc, l, i) => { if (pattern.test(l)) acc.push(i); return acc; }, [] as number[]);
}

function windowLines(lines: string[], idx: number, before: number, after: number): string[] {
  const start = Math.max(0, idx - before);
  const end = Math.min(lines.length, idx + after + 1);
  return lines.slice(start, end);
}

function findAllMoney(text: string): string[] {
  const matches = text.match(/R\$\s*([\d.]+,\d{2})/g);
  if (!matches) return [];
  return matches.map(m => {
    const v = m.match(/([\d.]+,\d{2})/);
    return v ? v[1] : '';
  }).filter(Boolean);
}

function findAllNumbers(text: string): string[] {
  return text.match(/([\d.]+,\d{2})/g) || [];
}

function findNextNumber(lines: string[], startIdx: number, maxDist: number = 5): string {
  for (let i = startIdx + 1; i < Math.min(startIdx + maxDist, lines.length); i++) {
    const cleaned = lines[i].replace(/[^\d.,\-]/g, '').trim();
    if (/^[\d.]+,\d{2}$/.test(cleaned) || /^\d+$/.test(cleaned)) {
      return cleaned;
    }
  }
  return EMPTY;
}

// ===================== MAIN EXTRACTION =====================

export function extractEnergisaData(rawText: string): EnergisaInvoiceData {
  const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  const flat = lines.join(' ');

  // ===== CONCESSIONÁRIA — search line-by-line, limit to one line =====
  const Concessionaria = (() => {
    for (const line of lines.slice(0, 20)) {
      if (/ENERGISA/i.test(line) && line.length > 10 && line.length < 100) {
        const m = line.match(/(ENERGISA.{5,90})/i);
        if (m) {
          let name = m[1].trim().replace(/\s+/g, ' ');
          // Truncate at date patterns to avoid grabbing dates/numbers
          const dateCut = name.search(/\d{2}\s*\/\s*\d{2}/);
          if (dateCut > 20) name = name.substring(0, dateCut).trim();
          return name;
        }
      }
    }
    return EMPTY;
  })();

  // ===== TIPO =====
  const Tipo = (() => {
    const upper = flat.toUpperCase();
    if (/SERVI[ÇC]O\s+P[ÚU]BLICO/.test(upper)) return 'SERVIÇO PÚBLICO';
    if (/PODER\s+P[ÚU]BLICO/.test(upper)) return 'PODER PÚBLICO';
    if (/RESIDENCIAL/.test(upper)) return 'RESIDENCIAL';
    if (/COMERCIAL/.test(upper)) return 'COMERCIAL';
    if (/INDUSTRIAL/.test(upper)) return 'INDUSTRIAL';
    if (/RURAL/.test(upper)) return 'RURAL';
    return EMPTY;
  })();

  // ===== MERCADO =====
  const Mercado = (() => {
    const patterns = [
      /Mercado\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{2,20})/i,
      /Classe\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{2,25})/i,
      /Segmento\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{2,25})/i,
    ];
    const m = matchAny(flat, patterns);
    if (m && m.length < 30) return m.toUpperCase().trim();
    return EMPTY;
  })();

  // ===== CIDADE — extract short word before (AG: XX), skip company names =====
  const Cidade = (() => {
    // Find all lines with (AG: pattern
    for (const line of lines.slice(0, 50)) {
      const m = line.match(/([A-ZÀ-Ú]{3,25})\s*\(\s*AG\s*:\s*\d+\s*\)/);
      if (m) {
        const candidate = m[1].trim().toUpperCase();
        // Skip company suffixes and common non-city words
        const skipWords = ['SA', 'S/A', 'LTDA', 'ME', 'EPP', 'SANESUL', 'EMPRESA', 'ENERGISA',
          'DISTRIBUIDORA', 'COPEL', 'CEMIG', 'CPFL', 'ELETROPAULO'];
        if (!skipWords.includes(candidate) && candidate.length >= 3) {
          return candidate;
        }
        // If the match includes MS/SP etc. state before city, try to get the city after state
        const stateCity = line.match(/([A-Z]{2})\s+([A-ZÀ-Ú]{3,25})\s*\(\s*AG/i);
        if (stateCity && !skipWords.includes(stateCity[2])) {
          return stateCity[2].trim();
        }
      }
    }
    // Fallback: look for city near state abbreviation MS
    const msPattern = /([A-ZÀ-Ú]{4,25})\s*-?\s*MS/i;
    const msm = flat.match(msPattern);
    if (msm) {
      const c = msm[1].trim().toUpperCase();
      if (c.length >= 3 && c.length <= 25 && !['ENERGISA', 'SANESUL'].includes(c)) return c;
    }
    return EMPTY;
  })();

  // ===== UC — prioritize dotted format X.XXX.XXX-XX =====
  const UC = (() => {
    // Strategy 1: labeled UC
    const labelPatterns = [
      /UC\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
      /Unidade\s+Consumidora\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
      /(?:C[óo]digo|N[º°]?\s*UC|Instala[cç][aã]o)\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
    ];
    const fromLabel = matchAny(flat, labelPatterns);
    if (fromLabel) {
      // Prefer dotted format: clean up to standard format
      return fromLabel;
    }

    // Strategy 2: standalone dotted UC pattern X.XXX.XXX-XX (search first 50 lines)
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      // Match exactly: digit(s).3digits.3digits-2digits
      const m = lines[i].match(/^(\d{1,3}\.\d{3}\.\d{3}-\d{2})$/);
      if (m) return m[1];
      // Also try if it's embedded in a short line
      const m2 = lines[i].match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
      if (m2 && lines[i].length < 30) return m2[1];
    }

    // Strategy 3: broader search in all text for dotted format
    const dottedMatch = flat.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
    if (dottedMatch) return dottedMatch[1];

    return EMPTY;
  })();

  // ===== MÊS REFERÊNCIA =====
  const MesReferencia = (() => {
    const meses = 'Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';
    const patterns = [
      new RegExp(`(Ref[\.:]?\s*|Refer[eê]ncia|Compet[eê]ncia|Per[ií]odo|M[eê]s)\s*[:\-]?\s*(${meses})\s*[\\/\-]\s*(\d{4})`, 'i'),
      new RegExp(`(${meses})\s*[\\/\-]\s*(\d{4})`, 'i'),
      new RegExp(`(${meses})\s+de\s*(\d{4})`, 'i'),
      // Numeric: MM/YYYY or MM-YYYY
      /(?:Ref[\.:]?\s*)?(\d{2})\s*[\\/\-]\s*(\d{4})/,
    ];
    const numToMonth: Record<string, string> = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
    };
    for (const p of patterns) {
      const m = flat.match(p);
      if (m && m[1] && m[2]) {
        const g1 = m[1].trim();
        const g2 = m[2].trim();
        // If group 1 is a month name
        if (/^(?:Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)$/i.test(g1)) {
          return `${g1.charAt(0).toUpperCase() + g1.slice(1).toLowerCase()} / ${g2}`;
        }
        // If group 1 is numeric month (2 digits)
        if (/^\d{2}$/.test(g1) && numToMonth[g1]) {
          return `${numToMonth[g1]} / ${g2}`;
        }
      }
    }
    return EMPTY;
  })();

  // ===== ANO LEITURA =====
  const AnoLeitura = (() => {
    const patterns = [
      /Leitura\s+(?:Atual|Anterior)?\s*[:\-]?\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i,
      /Data\s+Leitura\s*[:\-]?\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i,
      /Medi[cç][aã]o\s*[:\-]?\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i,
    ];
    const m = matchAny(flat, patterns);
    if (m) return m;
    if (MesReferencia) {
      const ym = MesReferencia.match(/(\d{4})/);
      if (ym) return ym[1];
    }
    return EMPTY;
  })();

  // ===== VENCIMENTO =====
  const Vencimento = (() => {
    const patterns = [
      /Venc[ie]mento\s*[:\-]?\s*(\d{2}\s*[\\/]\s*\d{2}\s*[\\/]\s*\d{4})/i,
      /Data\s+Venc[ie]mento\s*[:\-]?\s*(\d{2}\s*[\\/]\s*\d{2}\s*[\\/]\s*\d{4})/i,
      /Venc\.?\s*(\d{2}[\\/]\d{2}[\\/]\d{4})/i,
    ];
    const m = matchAny(flat, patterns);
    if (m) return m.replace(/\s+/g, '');
    return EMPTY;
  })();

  // ===== NOTA FISCAL =====
  const NotaFiscal = (() => {
    const patterns = [
      /NOTA\s+FISCAL\s*N[º°]?\s*[:\-]?\s*([\d.]+)/i,
      /NF\s*[:\-]?\s*N[º°]?\s*([\d.]+)/i,
    ];
    const fromLabels = matchAny(flat, patterns);
    if (fromLabels) return fromLabels;
    const nfIdx = findLine(lines, /NOTA\s+FISCAL/i);
    if (nfIdx >= 0) {
      const region = windowLines(lines, nfIdx, 0, 3).join(' ');
      const m = region.match(/(\d{5,12})/);
      if (m) return m[1];
    }
    return EMPTY;
  })();

  // ===== MODALIDADE TARIFÁRIA =====
  const ModalidadeTarifaria = (() => {
    const patterns = [
      /(?:Classifica[çc][aã]o|Modalidade|Tarifa)\s*[:\-]?\s*(Azul|Verde|Vermelha|Convencional|Hor[áa]rio\s+[Ss]azonal)/i,
      /\b(Azul|Verde|Vermelha|Convencional)\b/i,
    ];
    const m = matchAny(flat, patterns);
    if (m) return m.toUpperCase();
    if (/HOR[ÁA]RIO\s+SAZONAL/i.test(flat)) return 'HORÁRIO SAZONAL';
    return EMPTY;
  })();

  // ===== SUBGRUPO =====
  const Subgrupo = (() => {
    const classIdx = findLine(lines, /Classifica[çc][aã]o/i);
    if (classIdx >= 0) {
      const region = lines.slice(classIdx, Math.min(classIdx + 3, lines.length)).join(' ');
      const m = region.match(/(A[1-4]|B[1-4]|AS|BS)/);
      if (m) return m[1].toUpperCase();
    }
    const patterns = [
      /(?:Subgrupo|Sub-grupo|Grupo)\s*[:\-]?\s*(A[1-4]|B[1-4]|AS|BS)/i,
      /Classifica[çc][aã]o.*?(A[1-4]|B[1-4])/i,
    ];
    const m = matchAny(flat, patterns);
    return m ? m.toUpperCase() : EMPTY;
  })();

  // ===== Determine if it's a split tariff (Azul/Verde) =====
  const isSplitTariff = /AZUL|VERDE|HORÁRIO.*SAZONAL/i.test(flat);

  // ===== CONSUMO =====
  // For Convencional (B1-B4): single consumption → ConsumoTotal
  // For Azul/Verde: split into Ponta and Fora Ponta
  let ConsumoPonta = EMPTY;
  let ConsumoForaPonta = EMPTY;
  let ConsumoTotal = EMPTY;
  let ValorConsumoPonta = EMPTY;
  let ValorConsumoForaPonta = EMPTY;

  if (isSplitTariff) {
    // --- Split tariff: extract Ponta and Fora Ponta separately ---
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

    // R$ values for consumption
    ValorConsumoPonta = findItemRValue(lines, /Consumo\s+em\s+kWh.*?Ponta(?!.*Fora)/i);
    ValorConsumoForaPonta = findItemRValue(lines, /Consumo\s+em\s+kWh.*?Fora\s*Ponta/i);
  } else {
    // --- Convencional: single consumption ---
    // Find "CONSUMO FATURADO" or "Consumo em kWh" without Ponta/FP
    const consIdx = findLine(lines, /CONSUMO\s+FATURADO/i);
    if (consIdx >= 0) {
      for (let i = consIdx + 1; i < Math.min(consIdx + 8, lines.length); i++) {
        const m = lines[i].match(/([\d.]+,\d{2})/);
        if (m) { ConsumoTotal = m[1]; break; }
      }
    }
    // Fallback: "Consumo em kWh" section (without Ponta/FP)
    if (!ConsumoTotal) {
      const consKwhIdx = findLine(lines, /Consumo\s+em\s+kWh/i);
      if (consKwhIdx >= 0) {
        for (let i = consKwhIdx + 1; i < Math.min(consKwhIdx + 8, lines.length); i++) {
          const m = lines[i].match(/([\d.]+,\d{2})/);
          if (m) { ConsumoTotal = m[1]; break; }
        }
      }
    }
    // Fallback 2: KWH prefix line
    if (!ConsumoTotal) {
      for (const line of lines) {
        const km = line.match(/^KWH([\d.,]+)$/i);
        if (km) { ConsumoTotal = km[1]; break; }
      }
    }
    // Fallback 3: look for "Consumo" keyword near a reasonable kWh number
    if (!ConsumoTotal) {
      const consAnyIdx = findLine(lines, /\bConsumo\b/i);
      if (consAnyIdx >= 0) {
        for (let i = consAnyIdx + 1; i < Math.min(consAnyIdx + 6, lines.length); i++) {
          const line = lines[i];
          // Must be a number line (not text)
          if (/[A-Za-z]{3,}/.test(line)) continue;
          const m = line.match(/([\d.]+,\d{2})/);
          if (m) {
            const v = parseFloat(m[1].replace('.', '').replace(',', '.'));
            // Consumption in kWh should be reasonable (10-500000)
            if (v >= 10 && v <= 500000) { ConsumoTotal = m[1]; break; }
          }
        }
      }
    }
    // R$ value for single consumption
    ValorConsumoForaPonta = findItemRValue(lines, /Consumo\s+em\s+kWh(?!.*Ponta)/i);
    if (!ValorConsumoForaPonta) {
      ValorConsumoForaPonta = findItemRValue(lines, /CONSUMO\s+FATURADO/i);
    }
  }

  // ===== DEMANDA (only for split tariffs) =====
  let DemandaContratadaPonta = EMPTY;
  let DemandaContratadaForaPonta = EMPTY;
  let DemandaMedidaPonta = EMPTY;
  let DemandaMedidaForaPonta = EMPTY;
  let DemandaFaturadaPonta = EMPTY;
  let DemandaFaturadaForaPonta = EMPTY;
  let ValorDemandaPonta = EMPTY;
  let ValorDemandaForaPonta = EMPTY;

  if (isSplitTariff) {
    // Contratada
    DemandaContratadaPonta = findItemQuantity(lines, /Demanda\s+Contrat[ae]da.*?Ponta(?![^\n]*Fora)/i);
    DemandaContratadaForaPonta = findItemQuantity(lines, /Demanda\s+Contrat[ae]da.*?Fora\s*Ponta/i);
    // Medida
    DemandaMedidaPonta = findItemQuantity(lines, /Demanda\s+Medida.*?Ponta(?![^\n]*Fora)/i);
    DemandaMedidaForaPonta = findItemQuantity(lines, /Demanda\s+Medida.*?Fora\s*Ponta/i);
    // Faturada (fallback to Medida)
    DemandaFaturadaPonta = findItemQuantity(lines, /Demanda\s+Fatur[ae]da.*?Ponta(?![^\n]*Fora)/i) || DemandaMedidaPonta;
    DemandaFaturadaForaPonta = findItemQuantity(lines, /Demanda\s+Fatur[ae]da.*?Fora\s*Ponta/i) || DemandaMedidaForaPonta;
    // R$ values
    ValorDemandaPonta = findItemRValue(lines, /Demanda\s+(?:Medida|Fatur[ae]da|Pot[eê]ncia).*?Ponta(?![^\n]*Fora)/i);
    ValorDemandaForaPonta = findItemRValue(lines, /Demanda\s+(?:Medida|Fatur[ae]da|Pot[eê]ncia).*?Fora\s*Ponta/i);
  }

  // ===== ULTRAPASSAGEM (only for split tariffs) =====
  let UltrapassagemPonta = EMPTY;
  let UltrapassagemForaPonta = EMPTY;
  let ValorUltrapassagemPonta = EMPTY;
  let ValorUltrapassagemForaPonta = EMPTY;

  if (isSplitTariff) {
    UltrapassagemPonta = findItemQuantity(lines, /Ultrapassagem.*?Ponta(?![^\n]*Fora)/i);
    UltrapassagemForaPonta = findItemQuantity(lines, /Ultrapassagem.*?Fora\s*Ponta/i);
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
    ReativaExcedentePonta = findItemQuantity(lines, /Reactiv?a\s+Excedente.*?Ponta(?![^\n]*Fora)/i);
    ReativaExcedenteForaPonta = findItemQuantity(lines, /Reactiv?a\s+Excedente.*?Fora\s*Ponta/i);
    ValorReativaExcedentePonta = findItemRValue(lines, /Reactiv?a\s+Excedente.*?Ponta(?![^\n]*Fora)/i);
    ValorReativaExcedenteForaPonta = findItemRValue(lines, /Reactiv?a\s+Excedente.*?Fora\s*Ponta/i);
  } else {
    // Single reativa for convencional
    EnergiaReativaTotal = findItemQuantity(lines, /Reactiv?a\s+Excedente/i);
  }

  // ===== TRIBUTOS (PIS, COFINS, ICMS, GDI, CIP) =====
  // These typically appear in a specific section. Search by label and grab nearby numbers.

  const PIS = extractTributo(lines, flat, /\bPIS\b/i);
  const COFINS = extractTributo(lines, flat, /\bCOFINS\b/i);
  const ICMS = extractTributo(lines, flat, /\bICMS\b/i);
  const GDI = extractTributo(lines, flat, /\bGDI\b/i);
  const CIP = extractTributo(lines, flat, /\bCIP\b/i);

  // ===== VALOR TOTAL =====
  const ValorTotal = (() => {
    const patterns = [
      /TOTAL\s*(?:A\s+PAGAR|GERAL|DA\s+FATURA)?\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /Valor\s+Total\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /TOTAL\s*R\$\s*([\d.]+,\d{2})/i,
    ];
    const m = matchAny(flat, patterns);
    if (m) return m;
    // Fallback: largest R$ value
    const allMoney = findAllMoney(flat);
    if (allMoney.length > 0) {
      allMoney.sort((a, b) => {
        const va = parseFloat(a.replace('.', '').replace(',', '.'));
        const vb = parseFloat(b.replace('.', '').replace(',', '.'));
        return vb - va;
      });
      return allMoney[0];
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

// ===================== ITEM EXTRACTION HELPERS =====================

/** Find quantity (kWh or kW) near an item label. Skips text-only lines. */
function findItemQuantity(lines: string[], labelPattern: RegExp): string {
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

/** Find R$ value near an item label. Returns the last money value in the nearby region. */
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

/** Extract a tax/fee value (PIS, COFINS, ICMS, GDI, CIP) */
function extractTributo(lines: string[], flat: string, labelPattern: RegExp): string {
  // Strategy 1: R$ on the same line as the label in flat text
  const sameLine = matchAny(flat, [
    new RegExp(`${labelPattern.source}[^\d]*R\$\s*([\d.]+,\d{2})`, 'i'),
  ]);
  if (sameLine) return sameLine;

  // Strategy 2: find the label line, then search nearby lines for numbers
  const idx = findLine(lines, labelPattern);
  if (idx >= 0) {
    // Search forward first
    for (let i = idx + 1; i < Math.min(idx + 6, lines.length); i++) {
      const m = lines[i].match(/([\d.]+,\d{2})/);
      if (m) return m[1];
    }
    // Also check the label line itself for embedded number
    const selfMatch = lines[idx].match(/([\d.]+,\d{2})/);
    if (selfMatch) return selfMatch[1];
    // Search backward
    for (let i = idx - 1; i >= Math.max(0, idx - 3); i--) {
      const m = lines[i].match(/([\d.]+,\d{2})/);
      if (m) return m[1];
    }
  }

  // Strategy 3: search for the label and grab the next number in flat text
  const flatMatch = flat.match(new RegExp(`${labelPattern.source}[^\d]*?([\d.]+,\d{2})`, 'i'));
  if (flatMatch) return flatMatch[1];

  return EMPTY;
}

// ===================== FIELD LABELS AND CATEGORIES =====================

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
