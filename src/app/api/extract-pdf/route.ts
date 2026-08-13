import { NextRequest, NextResponse } from 'next/server';

// Types for the extraction
interface TableItem {
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

interface TableExtraction {
  items: TableItem[];
  pisTotal: string;
  cofinsTotal: string;
  icmsTotal: string;
}

interface EnergisaInvoiceData {
  [key: string]: string;
}

// Helper to load CJS modules bypassing Turbopack
async function loadCJS<T>(path: string): Promise<T> {
  const mod = await import('node:module');
  const nodeRequire = (mod as any).createRequire(import.meta.url);
  return new Function('req', 'cwd', 'return req(cwd + "' + path + '")')(nodeRequire, process.cwd());
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 1: text extraction via pdf-parse
    let text = '';
    let numpages = 0;
    try {
      const pdfModule = await import('pdf-parse');
      const pdfData = await (pdfModule.default || pdfModule)(buffer);
      text = pdfData.text;
      numpages = pdfData.numpages;
    } catch (e) {
      return NextResponse.json({ error: 'PDF: ' + (e as Error).message }, { status: 500 });
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Sem texto' }, { status: 422 });
    }

    // Step 2: table extraction via pdfjs-dist
    let tableExtraction: TableExtraction | undefined;
    try {
      const tableModule = await loadCJS<{ extractTableFromPDF: (buf: Buffer) => Promise<TableExtraction | null> }>('/dist/energisa-table-extractor.cjs');
      const result = await Promise.race([
        tableModule.extractTableFromPDF(buffer),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('table extraction timeout')), 15000)),
      ]);
      if (result?.items?.length > 0) tableExtraction = result;
    } catch (e) {
      console.log('Table extraction skipped:', (e as Error).message);
    }

    // Step 3: extract fields using compiled CJS extractor
    const extractorModule = await loadCJS<{ extractEnergisaData: (text: string, table?: TableExtraction) => EnergisaInvoiceData }>('/dist/energisa-extractor.cjs');
    const extracted = extractorModule.extractEnergisaData(text, tableExtraction);
    const allValues = Object.values(extracted);
    const extractedCount = allValues.filter((v) => v !== '').length;
    const totalFields = allValues.length;
    const extractionRate = Math.round((extractedCount / totalFields) * 100);

    return NextResponse.json({
      success: true,
      data: extracted,
      stats: { extractedCount, totalFields, extractionRate, pageCount: numpages, tableItems: tableExtraction?.items?.length ?? 0 },
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const extractorModule = await loadCJS<{ FIELD_LABELS: Record<string, string>; FIELD_CATEGORIES: { category: string; fields: string[] }[] }>('/dist/energisa-extractor.cjs');
    return NextResponse.json({
      fields: extractorModule.FIELD_LABELS || {},
      categories: extractorModule.FIELD_CATEGORIES || [],
    });
  } catch {
    return NextResponse.json({ fields: {}, categories: [] });
  }
}
