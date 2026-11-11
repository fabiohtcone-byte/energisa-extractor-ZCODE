// Shared PDF → invoice data extraction pipeline.
// Used by /api/extract-pdf (upload) and /api/network-files/extract (network share).

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

export interface ExtractedInvoice {
  data: Record<string, string>;
  stats: {
    extractedCount: number;
    totalFields: number;
    extractionRate: number;
    pageCount: number;
    tableItems: number;
  };
}

export class ExtractionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Helper to load CJS modules bypassing Turbopack
async function loadCJS<T>(path: string): Promise<T> {
  const mod = await import('node:module');
  const nodeRequire = (mod as any).createRequire(import.meta.url);
  return new Function('req', 'cwd', 'return req(cwd + "' + path + '")')(nodeRequire, process.cwd());
}

export async function extractInvoiceFromBuffer(buffer: Buffer): Promise<ExtractedInvoice> {
  // Step 1: text extraction via pdf-parse
  let text = '';
  let numpages = 0;
  try {
    // Import the internal lib directly: pdf-parse's index.js runs a debug
    // routine (reading test/data/05-versions-space.pdf) when bundled.
    const pdfModule: any = await import('pdf-parse/lib/pdf-parse.js');
    const pdfData = await (pdfModule.default || pdfModule)(buffer);
    text = pdfData.text;
    numpages = pdfData.numpages;
  } catch (e) {
    throw new ExtractionError('PDF: ' + (e as Error).message, 500);
  }

  if (!text || text.trim().length === 0) {
    throw new ExtractionError('Sem texto', 422);
  }

  // Step 2: table extraction via pdfjs-dist
  let tableExtraction: TableExtraction | undefined;
  try {
    const tableModule = await loadCJS<{ extractTableFromPDF: (buf: Buffer) => Promise<TableExtraction | null> }>('/dist/energisa-table-extractor.cjs');
    const result = await Promise.race([
      tableModule.extractTableFromPDF(buffer),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('table extraction timeout')), 15000)),
    ]);
    if (result?.items?.length && result.items.length > 0) tableExtraction = result;
  } catch (e) {
    console.log('Table extraction skipped:', (e as Error).message);
  }

  // Step 3: extract fields using compiled CJS extractor
  const extractorModule = await loadCJS<{ extractEnergisaData: (text: string, table?: TableExtraction) => Record<string, string> }>('/dist/energisa-extractor.cjs');
  const extracted = extractorModule.extractEnergisaData(text, tableExtraction);
  const allValues = Object.values(extracted);
  const extractedCount = allValues.filter((v) => v !== '').length;
  const totalFields = allValues.length;
  const extractionRate = Math.round((extractedCount / totalFields) * 100);

  return {
    data: extracted,
    stats: { extractedCount, totalFields, extractionRate, pageCount: numpages, tableItems: tableExtraction?.items?.length ?? 0 },
  };
}
