import { NextRequest, NextResponse } from 'next/server';
import { ExtractionError, extractInvoiceFromBuffer } from '@/lib/pdf-extraction';

// Helper to load CJS modules bypassing Turbopack
async function loadCJS<T>(path: string): Promise<T> {
  const mod = await import('node:module');
  const nodeRequire = (mod as any).createRequire(import.meta.url);
  return new Function('req', 'cwd', 'return req(cwd + \"' + path + '\")')(nodeRequire, process.cwd());
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Steps 1-3 (pdf-parse text, pdfjs table, CJS field extractor) live in the shared helper
    const { data, stats } = await extractInvoiceFromBuffer(buffer);

    return NextResponse.json({ success: true, data, stats });
  } catch (error) {
    if (error instanceof ExtractionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
