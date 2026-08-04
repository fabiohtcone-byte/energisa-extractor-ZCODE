    const chaveIdx2 = findLineIndex(lines, /chave de acesso/i);
    const demandCandidates: string[] = [];
    if (chaveIdx2 >= 0) {
      for (let i = chaveIdx2 + 1; i < Math.min(chaveIdx2 + 6, lines.length); i++) {
        const m = lines[i].match(/^(d[d.]+,[d]{2})$/);
        if (m) demandCandidates.push(m[1]);
      }
    }

    if (demandCandidates.length >= 2) {
      DemandaMedidaPonta = demandCandidates[0];
      DemandaMedidaForaPonta = demandCandidates[1];
    } else if (demandCandidates.length === 1) {
      DemandaMedidaPonta = demandCandidates[0];
    }===============================}

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

function match(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  return m && m[1] ? m[1].trim() : EMPTY;
}

function findLineIndex(lines: string[], pattern: RegExp): number {
  return lines.findIndex(l => pattern.test(l));
}

export function extractEnergisaData(rawText: string): EnergisaInvoiceData {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const flat = lines.join(' ');

  // === CONCESSIONÁRIA (line like "ENERGISA MATO GROSSO DO SUL - DISTR. DE ENERGIA S.A.") ===
  const Concessionaria = (() => {
    for (const line of lines) {
      if (line.includes('ENERGISA') && (line.includes('DISTR') || line.includes('S.A') || line.includes('S/A'))) {
        return line.trim();
      }
    }
    return EMPTY;
  })();

  // === TIPO ===
  const Tipo = (() => {
    for (const line of lines) {
      if (/SERVI[Çc]O\s+P[ÚU]BLICO/i.test(line)) return 'SERVIÇO PÚBLICO';
      if (/PODER\s+P[ÚU]BLICO/i.test(line)) return 'PODER PÚBLICO';
      if (/RESIDENCIAL/i.test(line)) return 'RESIDENCIAL';
      if (/COMERCIAL/i.test(line)) return 'COMERCIAL';
      if (/INDUSTRIAL/i.test(line)) return 'INDUSTRIAL';
    }
    return EMPTY;
  })();

  // === MERCADO (RURAL, CENTRO, etc. - line between Insc. Est. and client name) ===
  let Mercado = EMPTY;
  const inscIdx = findLineIndex(lines, /Insc\.\s*Est/i);
  if (inscIdx >= 0) {
    for (let i = inscIdx + 1; i < Math.min(inscIdx + 5, lines.length); i++) {
      const l = lines[i];
      if (/^(RURAL|URBANO|CENTRO|VILA\s|ZONA)/i.test(l) && l.length < 30) {
        Mercado = l.toUpperCase();
        break;
      }
    }
  }

  // === CIDADE (pattern: "DOURADOS (AG: 10)") ===
  const Cidade = match(flat, /([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+)\s*\(AG:\s*\d+\)/);

  // === CLASSIFICAÇÃO ===
  const classifIdx = findLineIndex(lines, /Classifica[cç][aã]o:/i);
  const classifText = classifIdx >= 0 ? lines[classifIdx] : '';

  let ModalidadeTarifaria = EMPTY;
  let Subgrupo = EMPTY;

  if (classifText) {
    if (/AZUL/i.test(classifText)) ModalidadeTarifaria = 'AZUL';
    else if (/VERDE/i.test(classifText)) ModalidadeTarifaria = 'VERDE';
    else if (/VERMELHA/i.test(classifText)) ModalidadeTarifaria = 'VERMELHA';
    else if (/CONVENCIONAL/i.test(classifText)) ModalidadeTarifaria = 'CONVENCIONAL';

    const sg = classifText.match(/\/\s*([AB]\d)\b/);
    if (sg) Subgrupo = sg[1].toUpperCase();
  }

  // === SUMMARY LINE ("21/07/2026R$ 672.485,41Junho / 2026") ===
  const summaryLine = lines.find(l => /\d{2}\/\d{2}\/\d{4}R\$/.test(l)) || '';
  const Vencimento = match(summaryLine, /(\d{2}\/\d{2}\/\d{4})R\$/);
  const ValorTotal = match(summaryLine, /R\$\s*([\d.]+,[\d]{2})/);
  const MesReferencia = (() => {
    const m = summaryLine.match(/(Janeiro|Fevereiro|Mar[cç]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s*\/\s*(\d{4})/i);
    return m ? `${m[1]} / ${m[2]}` : EMPTY;
  })();

  // === UC (number like 1.443.786.051-67, near NOTA FISCAL) ===
  let UC = EMPTY;
  const nfIdx = findLineIndex(lines, /NOTA\s+FISCAL\s*N[º°]/i);
  if (nfIdx >= 0) {
    // Search in range around NOTA FISCAL for UC number
    for (let i = Math.max(0, nfIdx - 3); i <= Math.min(nfIdx + 4, lines.length - 1); i++) {
      const m = lines[i].match(/^(\d[\d.]+-\d+)$/);
      if (m) { UC = m[1]; break; }
    }
  }
  // Fallback: search for standalone UC number pattern anywhere
  if (!UC) {
    for (const line of lines) {
      const m = line.match(/^(\d{2,3}\.\d{3}\.\d{3}-\d{2})$/);
      if (m) { UC = m[1]; break; }
    }
  }

  // === NOTA FISCAL ===
  const NotaFiscal = match(flat, /NOTA\s+FISCAL\s*N[º°]?\s*:?\s*([\d.]+)/i);

  // === DATA EMISSÃO ===
  const DataEmissao = match(flat, /DATA\s+DE\s+EMISS[ÃA]O:\s*(\d{2}\/\d{2}\/\d{4})/i);

  // === ANO LEITURA (from Leitura Atual date) ===
  const AnoLeitura = match(flat, /Leitura\s+Atual:\s*\d{2}\/\d{2}\/(\d{4})/i);

  // === TRIBUTOS SECTION ===
  // Structure: PIS value, COFINS value, Base calc, PIS rate, COFINS rate, ICMS rate
  // Then ICMS section: ICMS base, ICMS value concatenated
  const pisCofinsIdx = findLineIndex(lines, /PIS\/\s*COFINS/i);
  let PIS = EMPTY;
  let COFINS = EMPTY;

  if (pisCofinsIdx >= 0) {
    // PIS value is typically 2-3 lines BEFORE "PIS/COFINS" label
    // PIS and COFINS values are AFTER "PIS/" label
    const afterPis = lines.slice(pisCofinsIdx + 1, Math.min(pisCofinsIdx + 6, lines.length));
    const numLines = afterPis.filter(l => /^[\d.]+,[\d]{2}$/.test(l.trim()));
    if (numLines.length >= 2) {
      PIS = numLines[0].trim();
      COFINS = numLines[1].trim();
    } else if (numLines.length === 1) {
      PIS = numLines[0].trim();
    }
  }

  // ICMS: Find line containing "ICMS (R$)" and extract concatenated values
  let ICMS = EMPTY;
  const icmsRLineIdx = findLineIndex(lines, /ICMS\s*\(R\$\)/i);
  if (icmsRLineIdx >= 0 && icmsRLineIdx + 1 < lines.length) {
    const nextLine = lines[icmsRLineIdx + 1];
    const nums = nextLine.match(/([\d.]+,[\d]{2})/g);
    if (nums && nums.length >= 2) {
      // First number = ICMS value, second = ICMS base
      ICMS = nums[0];
    } else if (nums && nums.length === 1) {
      ICMS = nums[0];
    }
  }

  // === CIP ===
  let CIP = EMPTY;
  const cipIdx = findLineIndex(lines, /CIP\s*MUNICIPAL/i);
  if (cipIdx >= 0) {
    for (let i = cipIdx; i < Math.min(cipIdx + 10, lines.length); i++) {
      const m = lines[i].match(/([\d.]+,[\d]{2})/);
      if (m) { CIP = m[1]; break; }
    }
  }

  // === GDI ===
  let GDI = EMPTY;
  const gdiIdx = findLineIndex(lines, /GDI/i);
  if (gdiIdx >= 0) {
    for (let i = gdiIdx; i < Math.min(gdiIdx + 5, lines.length); i++) {
      const m = lines[i].match(/-?([\d.]+,[\d]{2})/);
      if (m) { GDI = m[1]; break; }
    }
  }

  // === DEMANDA CONTRATADA ("Demanda ponta - kW" / "Demanda fora ponta - kW" then value on next lines) ===
  let DemandaContratadaPonta = EMPTY;
  let DemandaContratadaForaPonta = EMPTY;
  const demPontaIdx = findLineIndex(lines, /Demanda\s+ponta\s*[-–]?\s*kW/i);
  const demFPIdx = findLineIndex(lines, /Demanda\s+fora\s+ponta\s*[-–]?\s*kW/i);
  
  if (demPontaIdx >= 0 && demPontaIdx + 2 < lines.length) {
    const m = lines[demPontaIdx + 2].match(/^(\d+)$/);
    if (m) DemandaContratadaPonta = m[1];
  }
  if (demFPIdx >= 0 && demFPIdx + 2 < lines.length) {
    const m = lines[demFPIdx + 2].match(/^(\d+)$/);
    if (m) DemandaContratadaForaPonta = m[1];
  }

  // === CONSUMO (kWh) ===
  // Ponta: from "KWH75.009,90" lines near Ponta meter section
  // Fora Ponta: large number between "chave de acesso" and meter section
  let ConsumoPonta = EMPTY;
  let ConsumoForaPonta = EMPTY;
  let ConsumoTotal = EMPTY;

  // Find KWH lines with numbers
  const kwhLines = lines.map((l, i) => ({ line: l, idx: i }))
    .filter(o => /^KWH[\d.,]+$/.test(o.line));

  // Find Ponta meter section (meter ID like 00000Z71944Ponta)
  const pontaMeterIdx = findLineIndex(lines, /\d{5}Z\d+Ponta$/);
  const foraPontaMeterIdx = findLineIndex(lines, /\d{5}Z\d+Fora\s*Ponta$/);

  // Find "chave de acesso" line
  const chaveIdx = findLineIndex(lines, /chave de acesso/i);

  if (kwhLines.length > 0) {
    // Azul tariff: has Ponta/FP
    // Find KWH lines after Ponta meter label
    const pontaKwh = kwhLines.find(o => o.idx > pontaMeterIdx - 5 && o.idx < pontaMeterIdx + 20);
    if (pontaKwh) {
      const m = pontaKwh.line.match(/^KWH([\d.,]+)$/);
      if (m) ConsumoPonta = m[1];
    }
  }

  // Fora Ponta: large number between "chave de acesso" and meter section
  if (chaveIdx >= 0) {
    for (let i = chaveIdx + 1; i < Math.min(chaveIdx + 5, lines.length); i++) {
      const m = lines[i].match(/^([\d.]+,[\d]{2})$/);
      if (m) {
        const val = parseFloat(m[1].replace('.', '').replace(',', '.'));
        // Fora Ponta consumption is typically > 1000 kWh
        if (val > 1000) {
          ConsumoForaPonta = m[1];
          break;
        }
      }
    }
  }

  // Convencional (B3): single consumption
  const isAzul = ModalidadeTarifaria === 'AZUL';
  if (!isAzul) {
    // Find consumption from "CONSUMO FATURADO" section
    const consFatIdx = findLineIndex(lines, /CONSUMO\s+FATURADO/i);
    if (consFatIdx >= 0) {
      for (let i = consFatIdx + 1; i < Math.min(consFatIdx + 5, lines.length); i++) {
        const m = lines[i].match(/^(\d[\d.]+,[\d]{2})$/);
        if (m) { ConsumoTotal = m[1]; break; }
      }
    }
    // Fallback: first KWH value
    if (!ConsumoTotal && kwhLines.length > 0) {
      const m = kwhLines[0].line.match(/^KWH([\d.,]+)$/);
      if (m) ConsumoTotal = m[1];
    }
  }

  // === DEMANDA MEDIDA (from items data) ===
  // Find item labels and extract values from subsequent data lines
  let DemandaMedidaPonta = EMPTY;
  let DemandaMedidaForaPonta = EMPTY;
  let DemandaFaturadaPonta = EMPTY;
  let DemandaFaturadaForaPonta = EMPTY;

  const itemLabels: { type: string; period: string; lineIdx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/Consumo\s+em\s+kWh\s*[-–]?\s*Fora\s*Ponta/i.test(l)) {
      itemLabels.push({ type: 'consumo', period: 'fp', lineIdx: i });
    } else if (/Consumo\s+em\s+kWh\s*[-–]?\s*Ponta/i.test(l) && !/Fora/i.test(l)) {
      itemLabels.push({ type: 'consumo', period: 'p', lineIdx: i });
    } else if (/Demanda\s+.*?Medida.*?Fora\s*Ponta|Demanda\s+.*?Medida.*?\s+FP/i.test(l)) {
      itemLabels.push({ type: 'demanda_medida', period: 'fp', lineIdx: i });
    } else if (/Demanda\s+.*?Medida.*?\s+Ponta/i.test(l)) {
      itemLabels.push({ type: 'demanda_medida', period: 'p', lineIdx: i });
    } else if (/Ultrap.*?Fora\s*Ponta|Ultrap.*?F\s*Ponta/i.test(l)) {
      itemLabels.push({ type: 'ultrapassagem', period: 'fp', lineIdx: i });
    } else if (/Ultrap.*?Ponta/i.test(l)) {
      itemLabels.push({ type: 'ultrapassagem', period: 'p', lineIdx: i });
    } else if (/Reativa\s+Exced.*?Fora\s*Ponta|Reativa\s+Exced.*?Fponta/i.test(l)) {
      itemLabels.push({ type: 'reativa', period: 'fp', lineIdx: i });
    } else if (/Reativa\s+Exced/i.test(l)) {
      itemLabels.push({ type: 'reativa', period: 'p', lineIdx: i });
    }
  }

  // Extract values from data lines after item labels
  // The data region starts after the last item label and has number lines
  if (itemLabels.length > 0) {
    const lastLabelIdx = itemLabels[itemLabels.length - 1].lineIdx;
    const dataLines = lines.slice(lastLabelIdx + 1, Math.min(lastLabelIdx + 35, lines.length))
      .filter(l => /^[\d.,]+$/.test(l));

    // Data line groups: tariff, quantity, unit_price, value (repeated for each item)
    // For demand/ultrapassagem, the quantity (kW) is what we need
    // Demand values typically range from 1 to 5000 kW
    
    const demMedP = itemLabels.find(l => l.type === 'demanda_medida' && l.period === 'p');
    const demMedFP = itemLabels.find(l => l.type === 'demanda_medida' && l.period === 'fp');

    if (demMedP) {
      // Demand Ponta: look in the data lines for a number in 1-5000 range
      for (const dl of dataLines) {
        const nums = dl.match(/([\d.]+,[\d]{2})/g);
        if (nums) {
          for (const n of nums) {
            const v = parseFloat(n.replace('.', '').replace(',', '.'));
            if (v >= 1 && v <= 5000) { DemandaMedidaPonta = n; break; }
          }
          if (DemandaMedidaPonta) break;
        }
      }
    }
    if (demMedFP) {
      let startOffset = 0;
      if (DemandaMedidaPonta) {
        // Skip the line we already used for Ponta
        for (let i = 0; i < dataLines.length; i++) {
          if (dataLines[i].includes(DemandaMedidaPonta)) { startOffset = i + 1; break; }
        }
      }
      for (let i = startOffset; i < dataLines.length; i++) {
        const nums = dataLines[i].match(/([\d.]+,[\d]{2})/g);
        if (nums) {
          for (const n of nums) {
            const v = parseFloat(n.replace('.', '').replace(',', '.'));
            if (v >= 1 && v <= 5000 && n !== DemandaMedidaPonta) { DemandaMedidaForaPonta = n; break; }
          }
          if (DemandaMedidaForaPonta) break;
        }
      }
    }

    DemandaFaturadaPonta = DemandaMedidaPonta;
    DemandaFaturadaForaPonta = DemandaMedidaForaPonta;
  }

  // === ULTRAPASSAGEM ===
  let UltrapassagemPonta = EMPTY;
  let UltrapassagemForaPonta = EMPTY;
  const ultraP = itemLabels.find(l => l.type === 'ultrapassagem' && l.period === 'p');
  const ultraFP = itemLabels.find(l => l.type === 'ultrapassagem' && l.period === 'fp');

  if (ultraP || ultraFP) {
    const lastLabelIdx = itemLabels[itemLabels.length - 1].lineIdx;
    const dataLines = lines.slice(lastLabelIdx + 1, Math.min(lastLabelIdx + 35, lines.length))
      .filter(l => /^[\d.,]+$/.test(l));

    if (ultraP) {
      for (const dl of dataLines) {
        const nums = dl.match(/([\d.]+,[\d]{2})/g);
        if (nums) {
          for (const n of nums) {
            const v = parseFloat(n.replace('.', '').replace(',', '.'));
            if (v > 0 && v <= 5000 && v !== parseFloat(DemandaMedidaPonta.replace('.', '').replace(',', '.'))) {
              UltrapassagemPonta = n; break;
            }
          }
          if (UltrapassagemPonta) break;
        }
      }
    }
    if (ultraFP) {
      for (const dl of dataLines) {
        const nums = dl.match(/([\d.]+,[\d]{2})/g);
        if (nums) {
          for (const n of nums) {
            const v = parseFloat(n.replace('.', '').replace(',', '.'));
            if (v > 0 && v <= 5000 && n !== UltrapassagemPonta && n !== DemandaMedidaForaPonta && n !== DemandaMedidaPonta) {
              UltrapassagemForaPonta = n; break;
            }
          }
          if (UltrapassagemForaPonta) break;
        }
      }
    }
  }

  // === REATIVA EXCEDENTE ===
  let ReativaExcedentePonta = EMPTY;
  let ReativaExcedenteForaPonta = EMPTY;
  let EnergiaReativaTotal = EMPTY;
  const reativaP = itemLabels.find(l => l.type === 'reativa' && l.period === 'p');
  const reativaFP = itemLabels.find(l => l.type === 'reativa' && l.period === 'fp');

  if (reativaP || reativaFP) {
    const lastLabelIdx = itemLabels[itemLabels.length - 1].lineIdx;
    const dataLines = lines.slice(lastLabelIdx + 1, Math.min(lastLabelIdx + 35, lines.length))
      .filter(l => /^[\d.,]+$/.test(l));

    if (reativaP) {
      for (const dl of dataLines) {
        const nums = dl.match(/([\d.]+,[\d]{2})/g);
        if (nums) { ReativaExcedentePonta = nums[0]; break; }
      }
    }
    if (reativaFP) {
      for (const dl of dataLines) {
        const nums = dl.match(/([\d.]+,[\d]{2})/g);
        if (nums && nums[0] !== ReativaExcedentePonta) { ReativaExcedenteForaPonta = nums[0]; break; }
      }
    }
    if (!ReativaExcedentePonta && !ReativaExcedenteForaPonta) {
      const reativaItem = itemLabels.find(l => l.type === 'reativa');
      if (reativaItem) {
        for (const dl of dataLines) {
          const nums = dl.match(/([\d.]+,[\d]{2})/g);
          if (nums) { EnergiaReativaTotal = nums[0]; break; }
        }
      }
    }
  }

  // === VALORES R$ ===
  // The item values (R$) appear as a group of numbers after the data rows
  // Pattern: ~6 values that sum to the PIS/COFINS base
  let ValorConsumoPonta = EMPTY;
  let ValorConsumoForaPonta = EMPTY;
  let ValorDemandaPonta = EMPTY;
  let ValorDemandaForaPonta = EMPTY;
  let ValorUltrapassagemPonta = EMPTY;
  let ValorUltrapassagemForaPonta = EMPTY;
  let ValorReativaExcedentePonta = EMPTY;
  let ValorReativaExcedenteForaPonta = EMPTY;

  if (itemLabels.length > 0) {
    const lastLabelIdx = itemLabels[itemLabels.length - 1].lineIdx;
    const region = lines.slice(lastLabelIdx + 10, Math.min(lastLabelIdx + 28, lines.length));
    const valorLines = region.filter(l => /^\d[\d.]+,[\d]{2}$/.test(l.trim()));

    if (valorLines.length >= 6 && isAzul) {
      // Order: ConsumoFP, AdicBAmarela, DemandaFP, DemandaP, Reativa, ConsumoP
      ValorConsumoForaPonta = valorLines[0];
      ValorConsumoPonta = valorLines[5];
      if (valorLines.length >= 4) {
        ValorDemandaForaPonta = valorLines[2];
        ValorDemandaPonta = valorLines[3];
      }
      if (valorLines.length >= 6) {
        ValorReativaExcedentePonta = valorLines[4];
      }
    } else if (valorLines.length >= 2) {
      ValorConsumoForaPonta = valorLines[0];
    }
  }

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
