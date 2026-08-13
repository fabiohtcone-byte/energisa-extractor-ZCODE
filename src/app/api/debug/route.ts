import { NextRequest, NextResponse } from 'next/server';
import { extractEnergisaData, TableItem, TableExtraction } from '@/lib/energisa-extractor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 1: text extraction
    let text = '';
    try {
      const pdfModule = await import('pdf-parse');
      const pdfData = await (pdfModule.default || pdfModule)(buffer);
      text = pdfData.text;
    } catch (e) {
      return NextResponse.json({ error: 'PDF parse: ' + (e as Error).message }, { status: 500 });
    }

    // Step 2: table extraction with full debug info
    let tableResult: any = null;
    try {
      const mod = await import('node:module');
      const nodeRequire = (mod as any).createRequire(import.meta.url);
      const loadTable = new Function('req', 'cwd', 'return req(cwd + "/dist/energisa-table-extractor.cjs")');
      const tableModule = loadTable(nodeRequire, process.cwd()) as {
        extractTableFromPDF: (buf: Buffer) => Promise<TableExtraction | null>;
      };
      const result = await Promise.race([
        tableModule.extractTableFromPDF(buffer),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
      ]);
      if (result?.items?.length > 0) tableResult = result;
    } catch (e) {
      tableResult = { error: (e as Error).message };
    }

    // Extract UC using the actual function
    let extractedUC = 'ERROR';
    let fullData: any = null;
    try {
      const tbl = tableResult && tableResult.items ? tableResult as TableExtraction : undefined;
      fullData = extractEnergisaData(text, tbl);
      extractedUC = String(fullData.UC) + ' [type:' + typeof fullData.UC + ']';
    } catch(e) {
      extractedUC = 'EXCEPTION: ' + (e as Error).message + ' ' + (e as Error).stack?.substring(0,200);
    }

    return NextResponse.json({
      rawText: text,
      tableExtraction: tableResult,
      extractedUC,
      fieldCount: fullData ? Object.keys(fullData).length : 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
