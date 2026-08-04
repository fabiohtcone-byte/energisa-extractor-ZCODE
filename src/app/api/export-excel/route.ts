import { NextRequest, NextResponse } from 'next/server';
import { FIELD_LABELS, type EnergisaInvoiceData } from '@/lib/energisa-extractor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoices } = body as { invoices: EnergisaInvoiceData[] };

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json({ error: 'Nenhuma fatura para exportar.' }, { status: 400 });
    }

    // Dynamic import xlsx
    const XLSX = await import('xlsx');

    // Build headers: all fields + Gerência + LOCINS (manual)
    const fieldKeys = Object.keys(FIELD_LABELS) as (keyof EnergisaInvoiceData)[];
    const headers = [
      ...fieldKeys.map((k) => FIELD_LABELS[k]),
      'Gerência', // Manual
      'LOCINS',   // Manual
    ];

    // Build rows
    const rows = invoices.map((inv) => {
      return [
        ...fieldKeys.map((k) => inv[k] || ''),
        '', // Gerência - preenchido manualmente
        '', // LOCINS - preenchido manualmente
      ];
    });

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = headers.map(() => ({ wch: 28 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faturas ENERGISA');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="faturas_energisa.xlsx"',
      },
    });
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
    return NextResponse.json({ error: 'Erro ao gerar Excel.' }, { status: 500 });
  }
}
