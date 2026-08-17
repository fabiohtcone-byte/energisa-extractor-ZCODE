'use client'

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Zap,
  BarChart3,
  FileSpreadsheet,
  Bug,
} from 'lucide-react';
import { FIELD_LABELS, FIELD_CATEGORIES, type EnergisaInvoiceData } from '@/lib/energisa-fields';

interface ExtractionResult {
  fileName: string;
  data: EnergisaInvoiceData;
  stats: {
    extractedCount: number;
    totalFields: number;
    extractionRate: number;
    pageCount: number;
  };
  rawText?: string;
}

export default function Home() {
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [debugMode, setDebugMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      toast.error('Selecione ao menos um arquivo PDF.');
      return;
    }

    setIsProcessing(true);
    const newResults: ExtractionResult[] = [];

    if (pdfFiles.length === 1) {
      // Single file: use the simple endpoint
      const file = pdfFiles[0];
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/extract-pdf', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
          toast.error(`${file.name}: ${result.error}`);
        } else {
          newResults.push({
            fileName: file.name,
            data: result.data,
            stats: result.stats,
            rawText: result.rawText,
          });
          toast.success(`${file.name}: ${result.stats.extractedCount}/${result.stats.totalFields} campos (${result.stats.extractionRate}%)`);
        }
      } catch {
        toast.error(`${file.name}: Erro ao processar.`);
      }
    } else {
      // Multiple files: use batch endpoint (single Node.js process, no repeated cold-start)
      try {
        const formData = new FormData();
        for (const f of pdfFiles) {
          formData.append('file', f);
        }
        const response = await fetch('/api/extract-batch', {
          method: 'POST',
          body: formData,
        });
        const results = await response.json();
        if (!response.ok || !Array.isArray(results)) {
          toast.error(results?.error || 'Erro no processamento em lote.');
        } else {
          for (const r of results) {
            if (r.error) {
              toast.error(`${r.fileName}: ${r.error}`);
            } else {
              newResults.push({
                fileName: r.fileName,
                data: r.data,
                stats: r.stats,
              });
              toast.success(`${r.fileName}: ${r.stats.extractedCount}/${r.stats.totalFields} campos (${r.stats.extractionRate}%)`);
            }
          }
        }
      } catch {
        toast.error('Erro ao processar arquivos em lote.');
      }
    }

    setResults((prev) => {
      const updated = [...newResults];
      for (const existing of prev) {
        const existingUC = existing.data.UC.replace(/[^0-9]/g, '');
        const alreadyAdded = updated.some(
          (r) => r.data.UC.replace(/[^0-9]/g, '') === existingUC && existingUC !== ''
        );
        if (!alreadyAdded) updated.push(existing);
      }
      for (const nr of newResults) {
        const nrUC = nr.data.UC.replace(/[^0-9]/g, '');
        if (nrUC && prev.some((r) => r.data.UC.replace(/[^0-9]/g, '') === nrUC)) {
          toast.info(`UC ${nr.data.UC} atualizada com nova extração.`);
        }
      }
      return updated;
    });
    setIsProcessing(false);

    if (newResults.length > 0) {
      setActiveTab('results');
    }
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
        e.target.value = '';
      }
    },
    [processFiles]
  );

  const clearAll = useCallback(() => {
    setResults([]);
    setActiveTab('upload');
    toast.info('Todas as faturas foram removidas.');
  }, []);

  const removeResult = useCallback((index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
    toast.info('Fatura removida.');
  }, []);

  const exportToExcel = useCallback(async () => {
    if (results.length === 0) {
      toast.error('Nenhuma fatura para exportar.');
      return;
    }

    try {
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices: results.map((r) => r.data) }),
      });

      if (!response.ok) {
        toast.error('Erro ao gerar Excel.');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'faturas_energisa.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Excel exportado com sucesso! Colunas Gerência e LOCINS estão vazias para preenchimento manual.');
    } catch {
      toast.error('Erro ao exportar.');
    }
  }, [results]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">Extração de Faturas ENERGISA</h1>
              <p className="text-xs sm:text-sm text-slate-500">Extraia 40+ campos automaticamente de faturas de energia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {results.length > 0 && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hidden sm:flex gap-1">
                <FileText className="h-3 w-3" />
                {results.length} fatura{results.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar Excel</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="results" disabled={results.length === 0} className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Resultados ({results.length})
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Enviar Faturas em PDF
                </CardTitle>
                <CardDescription>
                  Arraste e solte faturas ENERGISA em PDF ou clique para selecionar. Múltiplos arquivos permitidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200
                    ${isDragging ? 'border-emerald-500 bg-emerald-50 scale-[1.01]' : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50'}
                    ${isProcessing ? 'pointer-events-none opacity-60' : ''}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-3">
                    {isProcessing ? (
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
                    ) : (
                      <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
                        <FileText className="h-8 w-8" />
                      </div>
                    )}
                    <div>
                      <p className="text-base font-semibold text-slate-700">
                        {isProcessing ? 'Processando...' : 'Arraste faturas PDF aqui'}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {isProcessing
                          ? 'Extraindo dados dos PDFs...'
                          : 'ou clique para selecionar os arquivos'}
                      </p>
                    </div>
                    {/* Debug toggle */}
                    <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={debugMode}
                        onChange={(e) => setDebugMode(e.target.checked)}
                        disabled={isProcessing}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <Bug className="h-4 w-4 text-slate-500" />
                      <span className="text-xs text-slate-500">Modo Debug (mostra texto bruto do PDF)</span>
                    </label>
                  </div>
                </div>

                {results.length > 0 && (
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      {results.length} fatura{results.length !== 1 ? 's' : ''} processada{results.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Limpar Tudo
                      </Button>
                      <Button size="sm" onClick={exportToExcel} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                        <Download className="h-4 w-4" />
                        Exportar Excel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">40+ Campos</p>
                      <p className="text-xs text-slate-500">UC, consumo, demanda, tributos e mais</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Exportar Excel</p>
                      <p className="text-xs text-slate-500">Gerência e LOCINS para preenchimento manual</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Múltiplos Modelos</p>
                      <p className="text-xs text-slate-500">Compatível com diferentes formatos ENERGISA</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            {results.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhuma fatura processada ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {results.map((result, idx) => (
                  <>
                  <Card key={`${result.fileName}-${idx}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-100">
                            <FileText className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{result.fileName}</CardTitle>
                            <CardDescription className="text-xs">
                              {result.stats.pageCount} página{result.stats.pageCount !== 1 ? 's' : ''} | {result.stats.extractedCount}/{result.stats.totalFields} campos extraídos
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-40">
                            <Progress
                              value={result.stats.extractionRate}
                              className={`h-2 ${
                                result.stats.extractionRate >= 70
                                  ? '[&>div]:bg-emerald-500'
                                  : result.stats.extractionRate >= 40
                                    ? '[&>div]:bg-amber-500'
                                    : '[&>div]:bg-red-500'
                              }`}
                            />
                            <span className="text-xs font-medium text-slate-600 w-10 text-right">
                              {result.stats.extractionRate}%
                            </span>
                          </div>
                          <Badge
                            variant={
                              result.stats.extractionRate >= 70
                                ? 'default'
                                : result.stats.extractionRate >= 40
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className={
                              result.stats.extractionRate >= 70
                                ? 'bg-emerald-100 text-emerald-700'
                                : ''
                            }
                          >
                            {result.stats.extractionRate >= 70 ? (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            ) : (
                              <AlertCircle className="h-3 w-3 mr-1" />
                            )}
                            {result.stats.extractionRate >= 70 ? 'Boa extração' : 'Revisar manualmente'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeResult(idx)}
                            className="h-8 w-8 text-slate-400 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[300px]">Campo</TableHead>
                              <TableHead>Valor Extraído</TableHead>
                              <TableHead className="w-[60px] text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {FIELD_CATEGORIES.map((cat) => (
                              <>
                                <TableRow key={`cat-${cat.category}-${idx}`}>
                                  <TableCell
                                    colSpan={3}
                                    className="bg-slate-50 font-semibold text-xs text-slate-600 uppercase tracking-wider"
                                  >
                                    {cat.category}
                                  </TableCell>
                                </TableRow>
                                {cat.fields.map((fieldKey) => {
                                  const value = result.data[fieldKey];
                                  const isEmpty = !value;
                                  return (
                                    <TableRow key={`${fieldKey}-${idx}`}>
                                      <TableCell className="text-sm text-slate-700 font-medium">
                                        {FIELD_LABELS[fieldKey]}
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {isEmpty ? (
                                          <span className="text-slate-400 italic">Não extraído</span>
                                        ) : (
                                          <span className="text-slate-800 font-mono text-xs bg-slate-50 px-2 py-1 rounded">
                                            {value}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {isEmpty ? (
                                          <AlertCircle className="h-4 w-4 text-slate-300 mx-auto" />
                                        ) : (
                                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </>
                            ))}
                            {/* Gerência e LOCINS - manual */}
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="bg-amber-50 font-semibold text-xs text-amber-700 uppercase tracking-wider"
                              >
                                Campos Manuais (Preencher no Excel)
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-sm text-slate-700 font-medium">Gerência</TableCell>
                              <TableCell className="text-sm text-slate-400 italic">Preencher manualmente no Excel</TableCell>
                              <TableCell className="text-center">
                                <AlertCircle className="h-4 w-4 text-amber-400 mx-auto" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-sm text-slate-700 font-medium">LOCINS</TableCell>
                              <TableCell className="text-sm text-slate-400 italic">Preencher manualmente no Excel</TableCell>
                              <TableCell className="text-center">
                                <AlertCircle className="h-4 w-4 text-amber-400 mx-auto" />
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Debug: Raw Text */}
                  {result.rawText && (
                    <Card className="mt-2 border-amber-200 bg-amber-50/50">
                      <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                          <Bug className="h-4 w-4" />
                          Texto Bruto Extraído do PDF
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <pre className="text-[10px] leading-tight text-slate-700 bg-white border border-amber-200 rounded p-3 overflow-auto max-h-80 font-mono whitespace-pre-wrap break-all">
                          {result.rawText}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                  </>
                ))}

                {/* Export bar */}
                <Card>
                  <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <FileSpreadsheet className="h-5 w-5" />
                      <span>
                        <strong>{results.length}</strong> fatura{results.length !== 1 ? 's' : ''} pronta{results.length !== 1 ? 's' : ''} para exportação.
                        As colunas <strong>Gerência</strong> e <strong>LOCINS</strong> estarão vazias no Excel para preenchimento manual.
                      </span>
                    </div>
                    <Button onClick={exportToExcel} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      <Download className="h-4 w-4" />
                      Exportar para Excel
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 text-center text-xs text-slate-400">
          Extração de Faturas ENERGISA — Campos Gerência e LOCINS devem ser preenchidos manualmente no Excel exportado.
        </div>
      </footer>
    </div>
  );
}
