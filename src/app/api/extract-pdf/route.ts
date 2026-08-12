import { NextRequest, NextResponse } from 'next/server';
import { extractEnergisaData, FIELD_LABELS, FIELD_CATEGORIES } from '@/lib/energisa-extractor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 1: text extraction
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

    // Step 2: extract fields
    const extracted = extractEnergisaData(text);
    const allValues = Object.values(extracted);
    const extractedCount = allValues.filter((v) => v !== '').length;
    const totalFields = allValues.length;
    const extractionRate = Math.round((extractedCount / totalFields) * 100);

    return NextResponse.json({
      success: true, data: extracted,
      stats: { extractedCount, totalFields, extractionRate, pageCount: numpages },
      rawText: text,
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ fields: FIELD_LABELS, categories: FIELD_CATEGORIES });
}
