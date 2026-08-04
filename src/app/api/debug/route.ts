import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = require('pdf-parse/lib/pdf-parse.js');
    const pdfData = await pdfModule(buffer);
    const lines = pdfData.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    return NextResponse.json({ lines, totalLines: lines.length, rawText: pdfData.text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}