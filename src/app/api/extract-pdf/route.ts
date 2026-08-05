import { NextRequest, NextResponse } from 'next/server';
import { extractEnergisaData, FIELD_LABELS, FIELD_CATEGORIES } from '@/lib/energisa-extractor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas arquivos PDF são aceitos.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Load pdf-parse v1.1.1 - access the PDF function directly to skip debug mode
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = require('pdf-parse/lib/pdf-parse.js');
    const pdfData = await pdfModule(buffer);
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível extrair texto do PDF. O arquivo pode ser escaneado/imagem.' },
        { status: 422 }
      );
    }

    const extracted = extractEnergisaData(text);

    const allValues = Object.values(extracted);
    const extractedCount = allValues.filter((v) => v !== '').length;
    const totalFields = allValues.length;
    const extractionRate = Math.round((extractedCount / totalFields) * 100);

    const response: Record<string, unknown> = {
      success: true,
      data: extracted,
      stats: {
        extractedCount,
        totalFields,
        extractionRate,
        pageCount: pdfData.numpages,
      },
      rawTextLength: text.length,
    };

    // Always include raw text for debugging
    response.rawText = text;

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar o PDF. Tente novamente.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    fields: FIELD_LABELS,
    categories: FIELD_CATEGORIES,
  });
}