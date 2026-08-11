import * as pdfjsLib from 'pdfjs-dist';

// Set worker path to avoid "fake worker" errors
pdfjsLib.GlobalWorkerOptions.workerSrc = require('path').join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.mjs');

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
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
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

    // Step 3: Group items into rows with Y-tolerance of ±3
    // Sort all items by Y desc then X asc
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

    // Step 5: Find column X boundaries from header row
    const headerRow = rows[headerRowIndex];
    const quantH = headerRow.find(r => /^Quant/i.test(r.str));
    const unidH = headerRow.find(r => /^Unid/i.test(r.str));
    const precoH = headerRow.find(r => /Pre[cç]o/i.test(r.str))
      || rows.slice(headerRowIndex - 3, headerRowIndex + 3).flat().find(r => /Pre[cç]o/i.test(r.str));
    const valorH = headerRow.find(r => /^Valor/i.test(r.str));
    const pisH = headerRow.find(r => /PIS\/COFINS/i.test(r.str))
      || rows.slice(headerRowIndex - 3, headerRowIndex + 3).flat().find(r => /PIS\//i.test(r.str));
    const baseH = rows.slice(headerRowIndex - 3, headerRowIndex + 3).flat().find(r => /Base Calc/i.test(r.str));
    const aliqH = rows.slice(headerRowIndex - 3, headerRowIndex + 3).flat().find(r => /%?\s*Al[ií]q/i.test(r.str));
    const icmsH = headerRow.find(r => /^ICMS \(/i.test(r.str))
      || rows.slice(headerRowIndex - 3, headerRowIndex + 3).flat().find(r => /^ICMS \(/i.test(r.str));
    const tarifH = rows.slice(headerRowIndex - 3, headerRowIndex + 3).flat().find(r => /^Tarifa/i.test(r.str));

    // Build column ranges from header positions
    const colRanges: { [key: string]: { min: number; max: number } } = {
      label:      { min: 0,   max: (unidH || quantH).x - 10 },
      unidade:    { min: (unidH?.x ?? 140) - 10, max: (unidH?.x ?? 140) + 25 },
      quantidade: { min: (quantH?.x ?? 180) - 10, max: (precoH?.x ?? 205) - 10 },
      precoUnit:  { min: (precoH?.x ?? 205) - 10, max: (valorH?.x ?? 250) - 10 },
      valor:      { min: (valorH?.x ?? 250) - 10, max: (valorH?.x ?? 250) + 35 },
      pisCofins:  { min: (pisH?.x ?? 280) - 10, max: (pisH?.x ?? 280) + 35 },
      baseCalc:   { min: (baseH?.x ?? 315) - 10, max: (baseH?.x ?? 315) + 30 },
      aliquota:   { min: (aliqH?.x ?? 345) - 10, max: (aliqH?.x ?? 345) + 20 },
      icms:       { min: (icmsH?.x ?? 370) - 10, max: (icmsH?.x ?? 370) + 40 },
      tarifa:     { min: (tarifH?.x ?? 405) - 10, max: (tarifH?.x ?? 405) + 50 },
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

      // Find the label (leftmost text that looks like a description, typically x < 140)
      const labelItem = row.find(r => r.x < colRanges.label.max && r.str.length > 4 && /[a-zA-Z]/.test(r.str));
      const label = labelItem ? labelItem.str : '';

      // Skip rows without a meaningful label
      if (!label) continue;

      const getValue = (col: { min: number; max: number }): string => {
        const match = row.find(r => r.x >= col.min && r.x < col.max && /\d/.test(r.str));
        return match ? match.str : '';
      };

      const tableRow: TableItem = {
        label,
        unidade: getValue(colRanges.unidade),
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

    // If we found items on this page, don't look further
    if (result.items.length > 0) break;
  }

  return result.items.length > 0 ? result : null;
}
