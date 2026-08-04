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

/** Try multiple regex patterns against text, return first match group 1 */
function matchAny(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  return EMPTY;
}

/** Find line index matching pattern */
function findLine(lines: string[], pattern: RegExp): number {
  return lines.findIndex(l => pattern.test(l));
}

/** Find all line indices matching pattern */
function findAllLines(lines: string[], pattern: RegExp): number[] {
  return lines.reduce((acc, l, i) => { if (pattern.test(l)) acc.push(i); return acc; }, [] as number[]);
}

/** Extract first monetary value (R$ X.XXX,XX) from text */
function extractMoney(text: string): string {
  const m = text.match(/R\$\s*([\d.]+,\d{2})/);
  return m ? m[1] : EMPTY;
}

/** Extract first number with Brazilian format (X.XXX,XX or just X) */
function extractNumber(text: string): string {
  const m = text.match(/([\d.]+,\d{2})/);
  if (m) return m[1];
  const m2 = text.match(/(\d+[.,]?\d*)/);
  return m2 ? m2[1] : EMPTY;
}

/** Get lines in a window around an index */
function windowLines(lines: string[], idx: number, before: number, after: number): string[] {
  const start = Math.max(0, idx - before);
  const end = Math.min(lines.length, idx + after + 1);
  return lines.slice(start, end);
}

/** Find next numeric line after index */
function findNextNumber(lines: string[], startIdx: number, maxDist: number = 5): string {
  for (let i = startIdx + 1; i < Math.min(startIdx + maxDist, lines.length); i++) {
    const cleaned = lines[i].replace(/[^\d.,\-]/g, '').trim();
    if (/^[\d.]+,\d{2}$/.test(cleaned) || /^\d+$/.test(cleaned)) {
      return cleaned;
    }
  }
  return EMPTY;
}

/** Find all monetary values in a text region */
function findAllMoney(text: string): string[] {
  const matches = text.match(/R\$\s*([\d.]+,\d{2})/g);
  if (!matches) return [];
  return matches.map(m => {
    const v = m.match(/([\d.]+,\d{2})/);
    return v ? v[1] : '';
  }).filter(Boolean);
}

/** Find all plain numbers (Brazilian format) in text */
function findAllNumbers(text: string): string[] {
  const matches = text.match(/([\d.]+,\d{2})/g);
  return matches || [];
}

/** Extract monetary value from or near a line containing a keyword */
function extractValueNearKeyword(lines: string[], keywordPattern: RegExp, direction: 'next' | 'prev' = 'next', maxDist: number = 5): string {
  const idx = findLine(lines, keywordPattern);
  if (idx < 0) return EMPTY;
  
  if (direction === 'next') {
    return findNextNumber(lines, idx, maxDist);
  } else {
    for (let i = idx - 1; i >= Math.max(0, idx - maxDist); i--) {
      const cleaned = lines[i].replace(/[^\d.,\-]/g, '').trim();
      if (/^[\d.]+,\d{2}$/.test(cleaned) || /^\d+$/.test(cleaned)) {
        return cleaned;
      }
    }
  }
  return EMPTY;
}

// ===================== MAIN EXTRACTION FUNCTION =====================

export function extractEnergisaData(rawText: string): EnergisaInvoiceData {
  const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  const flat = lines.join(' ');
  // Also create a version with normalized whitespace for broader matching
  const flatNorm = flat.replace(/\s+/g, ' ');

  // ===== CONCESSIONÁRIA =====
  const Concessionaria = (() => {
    // Look for ENERGISA company name in header area (first 15 lines)
    const headerArea = lines.slice(0, 20).join(' ');
    const m = headerArea.match(/(ENERGISA[^\n]*?(?:DISTRIBUIDORA|DISTR|ENERGIA|S\.?A\.?|S\/A)[^\n]*)/i);
    if (m) return m[1].trim().replace(/\s+/g, ' ');
    // Fallback: any line with ENERGISA
    for (const line of lines.slice(0, 15)) {
      if (/ENERGISA/i.test(line) && line.length > 10 && line.length < 120) {
        return line.replace(/\s+/g, ' ').trim();
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
    // Look for "Tipo:" or "Classe:" label
    const tipoIdx = findLine(lines, /(?:Tipo|Classe|Classe\s*Consumo)\s*[:\-]/i);
    if (tipoIdx >= 0) {
      const m = lines[tipoIdx].match(/(?:Tipo|Classe|Classe\s*Consumo)\s*[:\-]\s*(.+)/i);
      if (m) return m[1].trim().toUpperCase();
    }
    return EMPTY;
  })();

  // ===== MERCADO =====
  const Mercado = (() => {
    const patterns = [
      /Mercado\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{2,20})/i,
      /(?:Classe|Segmento)\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{2,20})/i,
    ];
    const m = matchAny(flatNorm, patterns);
    if (m && m.length < 30) return m.toUpperCase().trim();
    // Check near "Insc. Est" or "CNPJ"
    const refIdx = findLine(lines, /Insc\.?\s*Est\.|CNPJ/i);
    if (refIdx >= 0) {
      for (let i = refIdx + 1; i < Math.min(refIdx + 5, lines.length); i++) {
        const l = lines[i];
        if (/^(RURAL|URBANO|PODER|SERVIÇO|RESIDENCIAL|COMERCIAL|INDUSTRIAL)/i.test(l) && l.length < 40) {
          return l.toUpperCase().trim();
        }
      }
    }
    return EMPTY;
  })();

  // ===== CIDADE =====
  const Cidade = (() => {
    // Pattern: "CIDADE (AG: XX)" or "CIDADE - AG XX" or near "Município"
    const patterns = [
      /([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+)*)\s*\(?\s*AG\s*:?\s*\d+/,
      /Munic[ií]pio\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+)/i,
      /(?:Localidade|Cidade)\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+)/i,
    ];
    const m = matchAny(flatNorm, patterns);
    if (m) return m.replace(/\s+/g, ' ').trim();
    return EMPTY;
  })();

  // ===== UC (Unidade Consumidora) =====
  const UC = (() => {
    // Try multiple UC patterns
    const patterns = [
      /UC\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
      /Unidade\s+Consumidora\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
      /(?:C[óo]digo|N[º°]?\s*UC)\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
      /(?:Instala[cç][aã]o)\s*[:\-]?\s*(\d[\d.]*-?\d*)/i,
    ];
    const fromLabels = matchAny(flatNorm, patterns);
    if (fromLabels) return fromLabels;
    
    // Fallback: standalone number that looks like a UC (formatted with dots and dash)
    for (const line of lines.slice(0, 40)) {
      const m = line.match(/^(\d{1,3}\.\d{3}\.\d{3}(?:-\d{2})?)$/);
      if (m) return m[1];
      const m2 = line.match(/^(\d{7,12})$/);
      if (m2) return m2[1];
    }
    return EMPTY;
  })();

  // ===== MÊS REFERÊNCIA =====
  const MesReferencia = (() => {
    const meses = 'Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro';
    const patterns = [
      new RegExp(`(?:Ref[\.:]|Refer[eê]ncia|Compet[eê]ncia|Per[ií]odo)\s*[:\-]?\s*(${meses})\s*[\\/\-]\s*(\d{4})`, 'i'),
      new RegExp(`(?:M[eê]s|Fat\s*)\s*[:\-]?\s*(${meses})\s*[\\/\-]\s*(\d{4})`, 'i'),
      new RegExp(`(${meses})\s*[\\/\-]\s*(\d{4})`, 'i'),
      new RegExp(`(\d{2})\s*[\\/\-]\s*(\d{4})`),
    ];
    for (const p of patterns) {
      const m = flatNorm.match(p);
      if (m && m[1] && m[2]) {
        return `${m[1].trim()} / ${m[2].trim()}`;
      }
    }
    return EMPTY;
  })();

  // ===== ANO LEITURA =====
  const AnoLeitura = (() => {
    // From "Leitura Atual: DD/MM/YYYY" or similar
    const patterns = [
      /Leitura\s+(?:Atual|Anterior)?\s*[:\-]?\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i,
      /Data\s+Leitura\s*[:\-]?\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i,
      /Medi[cç][aã]o\s*[:\-]?\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i,
    ];
    const m = matchAny(flatNorm, patterns);
    if (m) return m;
    // Fallback: extract year from MesReferencia
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
      // Date immediately before R$ (common layout)
      /(\d{2}[\\/]\d{2}[\\/]\d{4})\s*R\$/,
    ];
    const m = matchAny(flatNorm, patterns);
    if (m) return m.replace(/\s+/g, '');
    return EMPTY;
  })();

  // ===== NOTA FISCAL =====
  const NotaFiscal = (() => {
    const patterns = [
      /NOTA\s+FISCAL\s*N[º°]?\s*[:\-]?\s*([\d.]+)/i,
      /NF\s*[:\-]?\s*N[º°]?\s*([\d.]+)/i,
      /N[º°]?\s*Nota\s*Fiscal\s*[:\-]?\s*([\d.]+)/i,
      /([\d]{5,12})\s*[-–]?\s*NOTA\s+FISCAL/i,
    ];
    const fromLabels = matchAny(flatNorm, patterns);
    if (fromLabels) return fromLabels;
    // Look for large number near "Nota Fiscal" label
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
      /(?:Classifica[çc][aã]o|Modalidade|Tarifa)\s*[:\-]?\s*(Azul|Verde|Vermelha|Convencional|Hor[áa]rio\s+[Ss]azonal|Hor[áa]ria\s+[Aa]zul|B[áa]sica)/i,
      /\b(Azul|Verde|Vermelha|Convencional)\b/i,
    ];
    const m = matchAny(flatNorm, patterns);
    if (m) return m.toUpperCase();
    // Check for "HORÁRIO SAZONAL" as separate pattern
    if (/HOR[ÁA]RIO\s+SAZONAL/i.test(flatNorm)) return 'HORÁRIO SAZONAL';
    return EMPTY;
  })();

  // ===== SUBGRUPO =====
  const Subgrupo = (() => {
    const patterns = [
      /(?:Subgrupo|Sub-grupo|Grupo)\s*[:\-]?\s*(A[1-4]|B[1-4]|AS|BS|A4a|B4a|B4f|A3a|A2a|A1a)/i,
      /\b(A[1-4]|B[1-4])\b/,
      /Classifica[çc][aã]o.*?(A[1-4]|B[1-4])/i,
    ];
    // More specific: look near "Classificação" line
    const classIdx = findLine(lines, /Classifica[çc][aã]o/i);
    if (classIdx >= 0) {
      const region = lines.slice(classIdx, Math.min(classIdx + 3, lines.length)).join(' ');
      const m = region.match(/(A[1-4]|B[1-4]|AS|BS)/);
      if (m) return m[1].toUpperCase();
    }
    const m = matchAny(flatNorm, patterns);
    if (m) return m.toUpperCase();
    return EMPTY;
  })();

  // ===== CONSUMO PONTA (kWh) =====
  const ConsumoPonta = (() => {
    // Strategy 1: Find "Consumo Ponta" or "Consumo em kWh - Ponta" then nearby number
    const pontaIdx = findLine(lines, /Consumo.*?Ponta|Ponta.*?Consumo/i);
    if (pontaIdx >= 0 && !/Fora/i.test(lines[pontaIdx])) {
      // Look for kWh number in nearby lines
      for (let i = pontaIdx + 1; i < Math.min(pontaIdx + 6, lines.length); i++) {
        const m = lines[i].match(/([\d.]+,\d{2})/);
        if (m) {
          const v = parseFloat(m[1].replace('.', '').replace(',', '.'));
          if (v > 0) return m[1];
        }
        // Also check for integer kWh values
        const m2 = lines[i].match(/(\d+)\s*kWh/i);
        if (m2) return m2[1];
      }
    }
    // Strategy 2: find KWH prefix numbers near "Ponta"
    for (let i = 0; i < lines.length; i++) {
      if (/Ponta/i.test(lines[i]) && !/Fora/i.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const m = lines[j].match(/^KWH([\d.,]+)$/i);
          if (m) return m[1];
          const m2 = lines[j].match(/([\d.]+,\d{2})/);
          if (m2) {
            const v = parseFloat(m2[1].replace('.', '').replace(',', '.'));
            if (v >= 0) return m2[1];
          }
        }
      }
    }
    return EMPTY;
  })();

  // ===== CONSUMO FORA PONTA (kWh) =====
  const ConsumoForaPonta = (() => {
    const fpIdx = findLine(lines, /Consumo.*?Fora\s*Ponta|Fora\s*Ponta.*?Consumo/i);
    if (fpIdx >= 0) {
      for (let i = fpIdx + 1; i < Math.min(fpIdx + 6, lines.length); i++) {
        const m = lines[i].match(/([\d.]+,\d{2})/);
        if (m) {
          const v = parseFloat(m[1].replace('.', '').replace(',', '.'));
          if (v > 0 && m[1] !== ConsumoPonta) return m[1];
        }
        const m2 = lines[i].match(/(\d+)\s*kWh/i);
        if (m2) return m2[1];
      }
    }
    // Strategy 2: KWH prefix near "Fora Ponta"
    for (let i = 0; i < lines.length; i++) {
      if (/Fora\s*Ponta/i.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const m = lines[j].match(/^KWH([\d.,]+)$/i);
          if (m) return m[1];
          const m2 = lines[j].match(/([\d.]+,\d{2})/);
          if (m2) {
            const v = parseFloat(m2[1].replace('.', '').replace(',', '.'));
            if (v >= 0 && m2[1] !== ConsumoPonta) return m2[1];
          }
        }
      }
    }
    return EMPTY;
  })();

  // ===== CONSUMO TOTAL (kWh) =====
  const ConsumoTotal = (() => {
    const patterns = [
      /Consumo\s+Total\s*[:\-]?\s*([\d.]+,?\d*)/i,
      /Total\s+Consumo\s*[:\-]?\s*([\d.]+,?\d*)/i,
    ];
    const m = matchAny(flatNorm, patterns);
    if (m) return m;
    // Fallback: KWH line not associated with Ponta/FP
    if (!ConsumoPonta && !ConsumoForaPonta) {
      for (const line of lines) {
        const km = line.match(/^KWH([\d.,]+)$/i);
        if (km) return km[1];
      }
    }
    return EMPTY;
  })();

  // ===== DEMANDA CONTRATADA PONTA (kW) =====
  const DemandaContratadaPonta = (() => {
    // Look for "Demanda Contratada Ponta" or similar
    const idx = findLine(lines, /Demanda\s+Contrat[ae]da.*?Ponta|Ponta.*?Demanda\s+Contrat/i);
    if (idx >= 0 && !/Fora/i.test(lines[idx])) {
      for (let i = idx + 1; i < Math.min(idx + 6, lines.length); i++) {
        const m = lines[i].match(/(\d+[.,]?\d*)\s*kW?/i);
        if (m) return m[1];
        const m2 = lines[i].match(/^(\d+)$/);
        if (m2 && parseInt(m2[1]) > 0) return m2[1];
      }
    }
    // Fallback: look for number after "Demanda Contratada" when only Ponta section
    const dcIdx = findLine(lines, /Demanda\s+Contrat[ae]da/i);
    if (dcIdx >= 0) {
      const nextFew = lines.slice(dcIdx + 1, dcIdx + 8);
      for (const l of nextFew) {
        const m = l.match(/^(\d+)$/);
        if (m && parseInt(m[1]) > 0) return m[1];
        const m2 = l.match(/([\d.]+,\d{2})/);
        if (m2) {
          const v = parseFloat(m2[1].replace('.', '').replace(',', '.'));
          if (v > 0 && v <= 10000) return m2[1];
        }
      }
    }
    return EMPTY;
  })();

  // ===== DEMANDA CONTRATADA FORA PONTA (kW) =====
  const DemandaContratadaForaPonta = (() => {
    const idx = findLine(lines, /Demanda\s+Contrat[ae]da.*?Fora\s*Ponta|Fora\s*Ponta.*?Demanda\s+Contrat/i);
    if (idx >= 0) {
      for (let i = idx + 1; i < Math.min(idx + 6, lines.length); i++) {
        const m = lines[i].match(/(\d+[.,]?\d*)\s*kW?/i);
        if (m) return m[1];
        const m2 = lines[i].match(/^(\d+)$/);
        if (m2 && parseInt(m2[1]) > 0) return m2[1];
      }
    }
    return EMPTY;
  })();

  // ===== HELPERS: Find itemized billing data =====
  // ENERGISA invoices have itemized sections like:
  // "Consumo em kWh - Ponta" | tarifa | qty | unit_price | total
  // "Consumo em kWh - Fora Ponta" | tarifa | qty | unit_price | total
  // etc.
  
  function findItemQuantity(labelPattern: RegExp): string {
    const idx = findLine(lines, labelPattern);
    if (idx < 0) return EMPTY;
    // Look in the next several lines for a number (the quantity)
    for (let i = idx + 1; i < Math.min(idx + 10, lines.length); i++) {
      const line = lines[i];
      // Skip lines that look like labels/tariffs
      if (/[A-Za-z]{3,}/.test(line) && !/kWh|kW|R\$/.test(line)) continue;
      // Match a number that could be quantity (kWh or kW)
      const m = line.match(/([\d.]+,\d{2})/);
      if (m) {
        const v = parseFloat(m[1].replace('.', '').replace(',', '.'));
        // Quantity should be reasonable for consumption or demand
        if (v > 0) return m[1];
      }
    }
    return EMPTY;
  }

  function findItemValue(labelPattern: RegExp): string {
    const idx = findLine(lines, labelPattern);
    if (idx < 0) return EMPTY;
    // Look for R$ value near this item (could be on same line or nearby)
    const region = windowLines(lines, idx, 0, 12).join(' ');
    const moneyVals = findAllMoney(region);
    // The last money value is typically the total for this item
    if (moneyVals.length > 0) {
      return moneyVals[moneyVals.length - 1];
    }
    // Try plain numbers
    const nums = findAllNumbers(region);
    if (nums.length > 0) {
      return nums[nums.length - 1];
    }
    return EMPTY;
  }

  // ===== DEMANDA MEDIDA PONTA (kW) =====
  const DemandaMedidaPonta = findItemQuantity(/Demanda\s+(?:Medida|Pot[eê]ncia).*?Ponta(?!\s*Fora)/i);

  // ===== DEMANDA MEDIDA FORA PONTA (kW) =====
  const DemandaMedidaForaPonta = findItemQuantity(/Demanda\s+(?:Medida|Pot[eê]ncia).*?Fora\s*Ponta/i);

  // ===== DEMANDA FATURADA PONTA (kW) =====
  const DemandaFaturadaPonta = findItemQuantity(/Demanda\s+Fatur[ae]da.*?Ponta(?!\s*Fora)/i);

  // ===== DEMANDA FATURADA FORA PONTA (kW) =====
  const DemandaFaturadaForaPonta = findItemQuantity(/Demanda\s+Fatur[ae]da.*?Fora\s*Ponta/i);

  // If faturada not found, use medida as fallback
  const _DemFaturadaPonta = DemandaFaturadaPonta || DemandaMedidaPonta;
  const _DemFaturadaFP = DemandaFaturadaForaPonta || DemandaMedidaForaPonta;

  // ===== ULTRAPASSAGEM PONTA (kW) =====
  const UltrapassagemPonta = findItemQuantity(/Ultrapassagem.*?Ponta(?!\s*Fora)/i);

  // ===== ULTRAPASSAGEM FORA PONTA (kW) =====
  const UltrapassagemForaPonta = findItemQuantity(/Ultrapassagem.*?Fora\s*Ponta/i);

  // ===== REATIVA EXCEDENTE PONTA (kWh) =====
  const ReativaExcedentePonta = findItemQuantity(/(?:Energia\s+)?Reactiv?a\s+Excedente.*?Ponta(?!\s*Fora)/i);

  // ===== REATIVA EXCEDENTE FORA PONTA (kWh) =====
  const ReativaExcedenteForaPonta = findItemQuantity(/(?:Energia\s+)?Reactiv?a\s+Excedente.*?Fora\s*Ponta/i);

  // ===== ENERGIA REATIVA TOTAL =====
  const EnergiaReativaTotal = (() => {
    if (ReativaExcedentePonta || ReativaExcedenteForaPonta) return EMPTY;
    return findItemQuantity(/(?:Energia\s+)?Reactiv?a\s+Excedente/i);
  })();

  // ===== VALORES R$ (monetary values for each item) =====
  const ValorConsumoPonta = findItemValue(/Consumo\s+em\s+kWh.*?Ponta(?!\s*Fora)/i);
  const ValorConsumoForaPonta = findItemValue(/Consumo\s+em\s+kWh.*?Fora\s*Ponta/i);
  const ValorDemandaPonta = findItemValue(/Demanda\s+(?:Medida|Fatur[ae]da|Pot[eê]ncia).*?Ponta(?!\s*Fora)/i);
  const ValorDemandaForaPonta = findItemValue(/Demanda\s+(?:Medida|Fatur[ae]da|Pot[eê]ncia).*?Fora\s*Ponta/i);
  const ValorUltrapassagemPonta = findItemValue(/Ultrapassagem.*?Ponta(?!\s*Fora)/i);
  const ValorUltrapassagemForaPonta = findItemValue(/Ultrapassagem.*?Fora\s*Ponta/i);
  const ValorReativaExcedentePonta = findItemValue(/(?:Energia\s+)?Reactiv?a\s+Excedente.*?Ponta(?!\s*Fora)/i);
  const ValorReativaExcedenteForaPonta = findItemValue(/(?:Energia\s+)?Reactiv?a\s+Excedente.*?Fora\s*Ponta/i);

  // ===== PIS =====
  const PIS = (() => {
    const patterns = [
      /PIS\s*(?:\/\s*COFINS)?\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /PIS\s*[:\-]?\s*([\d.]+,\d{2})/i,
    ];
    const fromLabels = matchAny(flatNorm, patterns);
    if (fromLabels) return fromLabels;
    
    // Look near "PIS/COFINS" section
    const pisIdx = findLine(lines, /PIS/i);
    if (pisIdx >= 0) {
      const region = windowLines(lines, pisIdx, 0, 8).join(' ');
      const moneys = findAllMoney(region);
      if (moneys.length >= 1) return moneys[0];
      const nums = findAllNumbers(region);
      if (nums.length >= 1) return nums[0];
    }
    return EMPTY;
  })();

  // ===== COFINS =====
  const COFINS = (() => {
    const patterns = [
      /COFINS\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /PIS\s*\/\s*COFINS[^\d]*R\$\s*[\d.]+,\d{2}[^\d]*R\$\s*([\d.]+,\d{2})/i,
    ];
    const fromLabels = matchAny(flatNorm, patterns);
    if (fromLabels) return fromLabels;
    
    const cofinsIdx = findLine(lines, /COFINS/i);
    if (cofinsIdx >= 0) {
      const region = windowLines(lines, cofinsIdx, 0, 8).join(' ');
      const moneys = findAllMoney(region);
      // If PIS was found, COFINS is likely the second value
      if (PIS && moneys.length >= 2) {
        // Return the one that's not PIS
        return moneys.find(m => m !== PIS) || EMPTY;
      }
      if (moneys.length >= 1) return moneys[moneys.length - 1];
    }
    return EMPTY;
  })();

  // ===== ICMS =====
  const ICMS = (() => {
    const patterns = [
      /ICMS\s*(?:\(R\$\))?\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /ICMS\s*[:\-]?\s*([\d.]+,\d{2})/i,
      /(?:Base\s+de\s+C[áa]lculo|Valor)\s+ICMS\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
    ];
    const fromLabels = matchAny(flatNorm, patterns);
    if (fromLabels) return fromLabels;
    
    const icmsIdx = findLine(lines, /ICMS/i);
    if (icmsIdx >= 0) {
      const region = windowLines(lines, icmsIdx, 0, 8).join(' ');
      const moneys = findAllMoney(region);
      if (moneys.length >= 1) return moneys[0];
    }
    return EMPTY;
  })();

  // ===== GDI =====
  const GDI = (() => {
    const patterns = [
      /GDI\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /GDI\s*[:\-]?\s*-?([\d.]+,\d{2})/i,
    ];
    const fromLabels = matchAny(flatNorm, patterns);
    if (fromLabels) return fromLabels;
    
    const gdiIdx = findLine(lines, /\bGDI\b/i);
    if (gdiIdx >= 0) {
      return extractValueNearKeyword(lines, /\bGDI\b/i);
    }
    return EMPTY;
  })();

  // ===== CIP =====
  const CIP = (() => {
    const patterns = [
      /CIP\s*(?:MUNICIPAL)?\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /CIP\s*(?:MUNICIPAL)?\s*[:\-]?\s*([\d.]+,\d{2})/i,
      /Cont[ri]bui[çc][aã]o\s+de\s+Ilumina[çc][aã]o\s+P[úu]blica\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
    ];
    const fromLabels = matchAny(flatNorm, patterns);
    if (fromLabels) return fromLabels;
    
    const cipIdx = findLine(lines, /\bCIP\b/i);
    if (cipIdx >= 0) {
      return extractValueNearKeyword(lines, /\bCIP\b/i);
    }
    return EMPTY;
  })();

  // ===== VALOR TOTAL =====
  const ValorTotal = (() => {
    const patterns = [
      /TOTAL\s*(?:A\s+PAGAR|GERAL|DA\s+FATURA)?\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /Valor\s+Total\s*[:\-]?\s*R\$\s*([\d.]+,\d{2})/i,
      /TOTAL\s*R\$\s*([\d.]+,\d{2})/i,
      /R\$\s*([\d.]+,\d{2})\s*.*?TOTAL/i,
    ];
    const fromLabels = matchAny(flatNorm, patterns);
    if (fromLabels) return fromLabels;
    
    // Fallback: largest R$ value in the document
    const allMoney = findAllMoney(flatNorm);
    if (allMoney.length > 0) {
      // Sort by value descending
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
    DemandaFaturadaPonta: _DemFaturadaPonta,
    DemandaFaturadaForaPonta: _DemFaturadaFP,
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
