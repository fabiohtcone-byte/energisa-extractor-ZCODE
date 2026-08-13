// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist';
import path from 'path';

// Use worker path but disable it — run inline to avoid worker thread crashes
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.mjs');

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

export async function extractTableFromPDF(pdfBuffer: Buffer): Promise<TableExtraction | null> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer), disableWorker: true }).promise;
  const result: TableExtraction = { items: [], pisTotal: '', cofinsTotal: '', icmsTotal: '' };

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Step 1: Collect ALL text items with positions
    const allItems: Array<{ str: string; x: number; y: number }> = [];
    for (const item of textContent.items) {
      if (!item.str || !item.str.trim()) continue;
      allItems.push({
        str: item.str.trim(),
        x: item.transform[4],
        y: Math.round(item.transform[5]),
      });
    }

    // Step 2: Find "Itens da Fatura" Y position
    const headerItem = allItems.find(i => /^Itens da Fatura$/i.test(i.str));
    if (!headerItem) continue;
    const tableTopY = headerItem.y;

    // Step 3: Group items into rows with Y-tolerance of ±1
    allItems.sort((a, b) => b.y - a.y || a.x - b.x);

    const rows: Array<Array<{ str: string; x: number; y: number }>> = [];
    let currentRow: Array<{ str: string; x: number; y: number }> = [];
    let currentRowY = -999;

    for (const item of allItems) {
      if (Math.abs(item.y - currentRowY) <= 1) {
        currentRow.push(item);
      } else {
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [item];
        currentRowY = item.y;
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    // Step 4: Find the header row (has "Quant" and "Unid" near tableTopY)
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const avgY = row.reduce((s, r) => s + r.y, 0) / row.length;
      if (avgY > tableTopY + 10) continue;
      if (avgY < tableTopY - 50) break;
      const texts = row.map(r => r.str);
      const hasQuant = texts.some(t => /^Quant/i.test(t));
      const hasUnid = texts.some(t => /^Unid/i.test(t));
      if (hasQuant && hasUnid) { headerRowIndex = i; break; }
    }

    if (headerRowIndex < 0) continue;

    // Step 5: Collect ALL header-like texts from header row and nearby rows (±5)
    // This handles multi-line headers where "Valor (R$)" might be 3px above the main header row
    const nearbyStart = Math.max(0, headerRowIndex - 5);
    const nearbyEnd = Math.min(rows.length, headerRowIndex + 5);
    const nearbyItems = rows.slice(nearbyStart, nearbyEnd).flat();

    const headerRow = rows[headerRowIndex];

    // Find column headers with robust matching
    const quantH = headerRow.find(r => /^Quant/i.test(r.str));
    const unidH = headerRow.find(r => /^Unid/i.test(r.str));

    // Preço unit — may not have explicit header in some layouts
    const precoH = headerRow.find(r => /Pre[cç]o/i.test(r.str))
      || nearbyItems.find(r => /Pre[cç]o/i.test(r.str));

    // Valor (R$) — CRITICAL: must match "Valor (R$)" specifically, not bare "Valor" from tributos
    // The items table has "Valor (R$)" at x≈254, while the tributos section has "Valor" at x≈521
    const valorH_full = nearbyItems.find(r => /^Valor\s*\(R\$\)/i.test(r.str));
    const valorH_bare = headerRow.find(r => /^Valor\s*\(R\$\)/i.test(r.str));
    // Only use bare "Valor" (without "(R$)") if no "Valor (R$)" found, AND x is in items table range (< 420)
    const valorH_bare_safe = !valorH_full
      ? nearbyItems.find(r => /^Valor$/i.test(r.str) && r.x < 420)
      : null;
    const valorH = valorH_full || valorH_bare || valorH_bare_safe;

    // PIS/COFINS — ENERGISA MS uses "COFINS (R$)" header, others use "PIS/COFINS (R$)"
    const pisH = nearbyItems.find(r => /PIS\s*\/\s*COFINS/i.test(r.str))
      || nearbyItems.find(r => /^COFINS\s*\(R\$\)/i.test(r.str));

    // ICMS (R$) — in ENERGISA MS this header at x≈314 is the ICMS BASE CALC column
    const icmsBaseH = nearbyItems.find(r => /^ICMS\s*\(R\$\)/i.test(r.str) && r.x < 420);

    // ICMS % — look for "ICMS" text (without "(R$)") near the base column
    // Must pick the ICMS closest to icmsBaseH (smallest x > icmsBaseH.x) to avoid
    // matching "ICMS" from the other header row that represents the ICMS valor
    const icmsCandidates = nearbyItems.filter(r => /^ICMS$/i.test(r.str) && r.x > (icmsBaseH?.x ?? 300) && r.x < 420);
    const icmsPctH = icmsCandidates.length > 0
      ? icmsCandidates.reduce((a, b) => a.x < b.x ? a : b)
      : null;

    // ICMS valor column — look for "(R$)" text between ICMS% and tarifa columns
    const tarifaH = nearbyItems.find(r => /(?:^Tarifa|unit\s*R\$)/i.test(r.str) && r.x < 420);
    const icmsValorH = nearbyItems.find(r => /^\(R\$\)$/i.test(r.str)
      && r.x > (icmsPctH?.x ?? icmsBaseH?.x ?? 340)
      && r.x < (tarifaH?.x ?? 420));

    // Aliquota — "(%)" or "Alíquota" in the items table area
    const aliqH = nearbyItems.find(r => /^\(%\)$/i.test(r.str) && r.x < 420)
      || nearbyItems.find(r => /Al[ií]q/i.test(r.str) && r.x < 420);

    // Build column ranges using midpoints between adjacent header positions
    // This ensures tight, non-overlapping column boundaries
    const colXs: number[] = [
      quantH?.x ?? 180,
      precoH?.x ?? 205,
      valorH?.x ?? 250,
      pisH?.x ?? 280,
      icmsBaseH?.x ?? 315,
      icmsPctH?.x ?? 340,
      icmsValorH?.x ?? 365,
      tarifaH?.x ?? 400,
    ].sort((a, b) => a - b);

    // Compute midpoints between consecutive column X positions
    const midpoints = [0]; // left boundary
    for (let i = 0; i < colXs.length - 1; i++) {
      midpoints.push((colXs[i] + colXs[i + 1]) / 2);
    }
    midpoints.push(999); // right boundary

    // Map each column to its midpoint-based range [midpoints[i], midpoints[i+1])
    const getRange = (headerX: number | undefined, fallbackIdx: number): { min: number; max: number } => {
      if (!headerX) return { min: 0, max: 999 };
      const idx = colXs.indexOf(headerX);
      return { min: midpoints[idx], max: midpoints[idx + 1] };
    };

    const colRanges: { [key: string]: { min: number; max: number } } = {
      label:      { min: 0,   max: (unidH || quantH).x - 10 },
      unidade:    { min: (unidH?.x ?? 140) - 10, max: (unidH?.x ?? 140) + 25 },
      quantidade: { min: (quantH?.x ?? 180) - 10, max: getRange(precoH?.x, 1).max },
      precoUnit:  { min: getRange(precoH?.x, 1).min, max: getRange(valorH?.x, 2).max },
      valor:      { min: getRange(valorH?.x, 2).min, max: getRange(pisH?.x, 3).max },
      pisCofins:  { min: getRange(pisH?.x, 3).min, max: getRange(icmsBaseH?.x, 4).max },
      baseCalc:   { min: getRange(icmsBaseH?.x, 4).min, max: getRange(icmsPctH?.x, 5).max },
      aliquota:   { min: getRange(icmsPctH?.x, 5).min, max: getRange(icmsValorH?.x, 6).max },
      icms:       { min: getRange(icmsValorH?.x, 6).min, max: getRange(tarifaH?.x, 7).max },
      tarifa:     { min: getRange(tarifaH?.x, 7).min, max: 999 },
    };

    // Step 6: Find "TOTAL:" row to know where data ends
    let totalRowIndex = rows.length;
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      if (rows[i].some(r => /^TOTAL:\s*$/i.test(r.str))) { totalRowIndex = i; break; }
    }

    // Step 7: Extract data rows between header and TOTAL
    for (let i = headerRowIndex + 1; i < totalRowIndex; i++) {
      const row = rows[i].sort((a, b) => a.x - b.x);
      const joinedText = row.map(r => r.str).join(' ');

      // Skip known non-data rows
      if (/^(PIS|COFINS|ICMS)$/.test(joinedText.trim())) continue;
      if (/^(LIGA[ÇC]|Classifica[çc][aã]o|TENSÃO|ÁGUA|SERVI[ÇC]O P[ÚU]B|EMPRESA DE|SANESUL|CENTRO|ITAQUIRAI|CNPJ|Insc|DOM\.?|SEGUNDA|Rua |AV |GRUPO|CONJ|NOM|END|BAIRRO|CEP|Refer[eê]ncia|Conjunto|Tensão|Limite)/i.test(joinedText.trim())) continue;

      // Find the label (leftmost text that looks like a description, typically x < label.max)
      const labelItem = row.find(r => r.x < colRanges.label.max && r.str.length > 4 && /[a-zA-Z]/.test(r.str));
      const label = labelItem ? labelItem.str : '';

      // Skip rows without a meaningful label
      if (!label) continue;

      const getValue = (col: { min: number; max: number }, requireDigit = true): string => {
        const match = row.find(r => r.x >= col.min && r.x < col.max && (requireDigit ? /\d/.test(r.str) : true));
        return match ? match.str : '';
      };

      const tableRow: TableItem = {
        label,
        unidade: getValue(colRanges.unidade, false),
        quantidade: getValue(colRanges.quantidade),
        precoUnit: getValue(colRanges.precoUnit),
        valor: getValue(colRanges.valor),
        pisCofins: getValue(colRanges.pisCofins),
        baseCalcICMS: getValue(colRanges.baseCalc),
        aliquotaICMS: getValue(colRanges.aliquota),
        icms: getValue(colRanges.icms),
        tarifa: getValue(colRanges.tarifa),
      };

      // Only add rows that have actual data
      if (tableRow.quantidade || tableRow.valor) {
        result.items.push(tableRow);
      }
    }

    // Step 8: Extract tributos totals from the right-side table (PIS, COFINS, ICMS)
    // The tributos section has: Tributo label, Base de Cálc., Alíquota(%), Valor(R$)
    for (let i = headerRowIndex + 1; i < totalRowIndex; i++) {
      const row = rows[i];
      for (const item of row) {
        if (/^PIS$/i.test(item.str)) {
          const rowItems = [...row].sort((a, b) => a.x - b.x);
          const vals = rowItems.filter(r => r.x > 400 && /^\d[\d.]*,\d{2}$/.test(r.str)).map(r => r.str);
          if (vals.length >= 1) {
            result.pisTotal = vals[vals.length - 1];
          }
        }
        if (/^COFINS$/i.test(item.str)) {
          // COFINS valor may be on the next row in the tributos section
          const nextRow = i + 1 < totalRowIndex ? rows[i + 1] : [];
          const combined = [...row, ...nextRow].sort((a, b) => a.x - b.x);
          const vals = combined.filter(r => r.x > 400 && /^\d[\d.]*,\d{2}$/.test(r.str)).map(r => r.str);
          if (vals.length >= 1) {
            result.cofinsTotal = vals[vals.length - 1];
          }
        }
        if (/^ICMS$/i.test(item.str) && item.x > 400) {
          const rowItems = [...row].sort((a, b) => a.x - b.x);
          const vals = rowItems.filter(r => r.x > 400 && /^\d[\d.]*,\d{2}$/.test(r.str)).map(r => r.str);
          if (vals.length >= 1) {
            result.icmsTotal = vals[vals.length - 1];
          }
        }
      }
    }

    // If we found items on this page, don't look further
    if (result.items.length > 0) break;
  }

  pdf.destroy();
  return result.items.length > 0 ? result : null;
}
