import * as pdfjsLib from 'pdfjs-dist';

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

// Column X-position boundaries (based on ENERGISA AZUL A4 PDF analysis)
const COL = {
  label:     { min: 0,   max: 145 },
  unidade:   { min: 145, max: 180 },
  quantidade: { min: 180, max: 205 },
  precoUnit: { min: 205, max: 245 },
  valor:     { min: 245, max: 280 },
  pisCofins: { min: 280, max: 315 },
  baseCalc:  { min: 315, max: 340 },
  aliquota:  { min: 340, max: 360 },
  icms:      { min: 360, max: 395 },
  tarifa:    { min: 395, max: 430 },
};

function inCol(x: number, col: { min: number; max: number }): boolean {
  return x >= col.min && x < col.max;
}

export async function extractTableFromPDF(pdfBuffer: Buffer): Promise<TableExtraction | null> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const result: TableExtraction = { items: [], pisTotal: '', cofinsTotal: '', icmsTotal: '' };

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Find "Itens da Fatura" to identify table section
    let inTable = false;
    let headersFound = false;
    const rows: Map<number, Array<{ str: string; x: number }>> = new Map();

    for (const item of textContent.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const str = item.str.trim();

      if (!inTable) {
        if (/^Itens da Fatura$/i.test(str)) inTable = true;
        continue;
      }

      // Detect end of table section (next major section)
      if (/^TOTAL:/i.test(str)) break;
      if (/^chave de acesso/i.test(str)) break;
      if (/^Declara[cç]|^EMITIDO EM|^NOTA FISCAL N|^Importante:/i.test(str)) break;

      // Collect items by Y position
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ str, x });
    }

    if (rows.size === 0) continue;

    // Sort Y positions top-to-bottom (higher Y = higher on page)
    const sortedYs = Array.from(rows.keys()).map(Number).sort((a, b) => b - a);

    // Find column header row to calibrate positions
    let headerY = -1;
    for (const y of sortedYs) {
      const items = rows.get(y)!;
      const texts = items.map(i => i.str);
      const hasQuant = texts.some(t => /^Quant/i.test(t));
      const hasUnid = texts.some(t => /^Unid/i.test(t));
      if (hasQuant && hasUnid) { headerY = y; break; }
    }

    // If no header found, use default positions
    let colRanges = COL;
    if (headerY >= 0) {
      const headerItems = rows.get(headerY)!;
      // Try to calibrate from actual column header positions
      const quantItem = headerItems.find(i => /^Quant/i.test(i.str));
      const valorItem = headerItems.find(i => /^Valor/i.test(i.str));
      const pisItem = headerItems.find(i => /^PIS/i.test(i.str));
      const baseItem = headerItems.find(i => /^Base Calc/i.test(i.str));
      const icmsItem = headerItems.find(i => /^ICMS/i.test(i.str));
      const tarifItem = headerItems.find(i => /^Tarifa/i.test(i.str));

      // Calibrate columns based on header positions
      if (quantItem && valorItem && pisItem) {
        const qMin = quantItem.x - 5;
        const vMin = valorItem.x - 5;
        const pMax = pisItem.x + 30;
        const bMin = baseItem ? baseItem.x - 5 : 315;
        const iMin = icmsItem ? icmsItem.x - 5 : 360;
        const tMin = tarifItem ? tarifItem.x - 5 : 395;
        const tMax = tMin + 40;
        colRanges = {
          label:     { min: 0, max: qMin },
          unidade:   { min: qMin, max: quantItem.x - 5 },
          quantidade: { min: quantItem.x - 5, max: vMin },
          precoUnit: { min: vMin, max: pisItem.x - 5 },
          valor:     { min: pisItem.x - 5, max: pMax },
          pisCofins: { min: pisItem.x - 5, max: bMin },
          baseCalc:  { min: bMin, max: iMin },
          aliquota:  { min: iMin, max: icmsItem ? icmsItem.x - 5 : 360 },
          icms:      { min: iMin, max: tMin },
          tarifa:    { min: tMin, max: tMax },
        };
      }
    }

    // Extract table rows
    for (const y of sortedYs) {
      const items = rows.get(y)!.sort((a, b) => a.x - b.x);
      const texts = items.map(i => i.str).join(' ');

      // Skip header rows
      if (/^(Itens|Unid\.|Quant\.|Preço unit|com tributos|Valor \(|PIS\/|Base Calc|% Alíq|ICMS \(|Tarifa|Unit \()/i.test(texts)) continue;

      // Try to find a label (item name)
      const labelItem = items.find(i => inCol(i.x, colRanges.label));
      const label = labelItem ? labelItem.str : '';

      // Skip if no label and no numeric content
      if (!label && !/\d/.test(texts)) continue;

      // Extract column values
      const getValue = (col: { min: number; max: number }): string => {
        const match = items.find(i => inCol(i.x, col) && /\d/.test(i.str));
        return match ? match.str : '';
      };

      const row: TableItem = {
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

      // Only add rows that have actual data (label or numeric values)
      if (label || row.quantidade || row.valor) {
        result.items.push(row);
      }
    }
  }

  return result.items.length > 0 ? result : null;
}
