import { NextRequest, NextResponse } from 'next/server';
import { extractEnergisaData, FIELD_LABELS, FIELD_CATEGORIES, TableItem } from '@/lib/energisa-extractor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 1: text extraction via pdf-parse (dynamic import to bypass Turbopack)
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

    // Step 2: table extraction via pdfjs-dist (position-based)
    // Uses createRequire + Function constructor to hide CJS require from Turbopack
    let tableData: TableItem[] | undefined;
    try {
      const mod = await import('node:module');
      const nodeRequire = (mod as any).createRequire(import.meta.url);
      // Use Function constructor so Turbopack can't trace the require target
      const loadTable = new Function('req', 'cwd', 'return req(cwd + "/dist/energisa-table-extractor.cjs")');
      const tableModule = loadTable(nodeRequire, process.cwd()) as {
        extractTableFromPDF: (buf: Buffer) => Promise<{ items: TableItem[] } | null>;
      };
      const result = await Promise.race([
        tableModule.extractTableFromPDF(buffer),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('table extraction timeout')), 15000)),
      ]);
      if (result?.items?.length > 0) {
        tableData = result.items;
      }
    } catch (e) {
      console.log('Table extraction skipped:', (e as Error).message);
    }

    // Step 3: extract fields (text + table override)
    const extracted = extractEnergisaData(text, tableData);
    const allValues = Object.values(extracted);
    const extractedCount = allValues.filter((v) => v !== '').length;
    const totalFields = allValues.length;
    const extractionRate = Math.round((extractedCount / totalFields) * 100);

    return NextResponse.json({
      success: true,
      data: extracted,
      stats: { extractedCount, totalFields, extractionRate, pageCount: numpages, tableItems: tableData?.length ?? 0 },
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ fields: FIELD_LABELS, categories: FIELD_CATEGORIES });
}