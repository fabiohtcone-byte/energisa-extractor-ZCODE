'use client'

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Loader2,
  CalendarDays,
  Receipt,
  DollarSign,
  MapPin,
  Tag,
  TrendingUp,
  ShieldCheck,
  ArrowDownUp,
} from 'lucide-react';
import { FIELD_LABELS, FIELD_CATEGORIES, type EnergisaInvoiceData } from '@/lib/energisa-fields';

interface FileProgress {
  fileName: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: ExtractionResult;
  errorMsg?: string;
}

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

// Category icon & color mapping
const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  'Identificação': { icon: <Tag className="h-4 w-4" />, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'Datas e Documentos': { icon: <CalendarDays className="h-4 w-4" />, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  'Tarifa': { icon: <Receipt className="h-4 w-4" />, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  'Consumo (kWh)': { icon: <Zap className="h-4 w-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Demanda Contratada (kW)': { icon: <ShieldCheck className="h-4 w-4" />, color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  'Demanda Medida (kW)': { icon: <TrendingUp className="h-4 w-4" />, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  'Demanda Faturada (kW)': { icon: <DollarSign className="h-4 w-4" />, color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  'Ultrapassagem (kW)': { icon: <ArrowDownUp className="h-4 w-4" />, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  'Demanda Não Consumida (kW)': { icon: <AlertCircle className="h-4 w-4" />, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  'Reativa Excedente (kWh)': { icon: <Zap className="h-4 w-4" />, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Valores - Consumo (R$)': { icon: <DollarSign className="h-4 w-4" />, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  'Valores - Demanda (R$)': { icon: <DollarSign className="h-4 w-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Valores - Ultrapassagem (R$)': { icon: <DollarSign className="h-4 w-4" />, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  'Valores - Demanda Não Consumida (R$)': { icon: <DollarSign className="h-4 w-4" />, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  'Valores - Reativa Excedente (R$)': { icon: <DollarSign className="h-4 w-4" />, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Tributos e Encargos (R$)': { icon: <Receipt className="h-4 w-4" />, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  'Energia Injetada GDI oUC': { icon: <Zap className="h-4 w-4" />, color: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-200' },
  'Energia Injetada GDI mUC': { icon: <Zap className="h-4 w-4" />, color: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-200' },
  'Geração Distribuída': { icon: <Zap className="h-4 w-4" />, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  'Total': { icon: <DollarSign className="h-4 w-4" />, color: 'text-slate-800', bg: 'bg-slate-100', border: 'border-slate-300' },
};

const DEFAULT_CAT_META = { icon: <Tag className="h-4 w-4" />, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };

export default function Home() {
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [debugMode, setDebugMode] = useState(false);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      toast.error('Selecione ao menos um arquivo PDF.');
      return;
    }

    setIsProcessing(true);
    const newResults: ExtractionResult[] = [];

    const initialProgress: FileProgress[] = pdfFiles.map((f) => ({
      fileName: f.name,
      status: 'pending',
    }));
    setFileProgress(initialProgress);

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];

      setFileProgress((prev) =>
        prev.map((p, idx) =>
          idx === i ? { ...p, status: 'processing' as const } : p
        )
      );

      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/extract-pdf', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();

        if (!response.ok) {
          setFileProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'error' as const, errorMsg: result.error } : p
            )
          );
          toast.error(`${file.name}: ${result.error}`);
        } else {
          const extractionResult: ExtractionResult = {
            fileName: file.name,
            data: result.data,
            stats: result.stats,
            rawText: result.rawText,
          };
          newResults.push(extractionResult);
          setFileProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'done' as const, result: extractionResult } : p
            )
          );
          toast.success(`${file.name}: ${result.stats.extractedCount}/${result.stats.totalFields} campos (${result.stats.extractionRate}%)`);
        }
      } catch {
        setFileProgress((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: 'error' as const, errorMsg: 'Erro ao processar' } : p
          )
        );
        toast.error(`${file.name}: Erro ao processar.`);
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
    setFileProgress([]);

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
        body: JSON.stringify({ invoices: results.map((r) => ({ ...r.data, _fileName: r.fileName })) }),
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

      toast.success('Excel exportado! Colunas em amarelo são para preenchimento manual.');
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
                    {!isProcessing && (
                      <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
                        <FileText className="h-8 w-8" />
                      </div>
                    )}
                    {!isProcessing && (
                      <div>
                        <p className="text-base font-semibold text-slate-700">
                          Arraste faturas PDF aqui
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          ou clique para selecionar os arquivos
                        </p>
                      </div>
                    )}
                    {!isProcessing && (
                      <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={debugMode}
                          onChange={(e) => setDebugMode(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <Bug className="h-4 w-4 text-slate-500" />
                        <span className="text-xs text-slate-500">Modo Debug (mostra texto bruto do PDF)</span>
                      </label>
                    )}
                  </div>

                  {isProcessing && fileProgress.length > 0 && (
                    <div className="w-full max-w-md mx-auto text-left">
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-700">
                            Processando faturas
                          </span>
                          <span className="text-sm font-medium text-emerald-700">
                            {fileProgress.filter((p) => p.status === 'done' || p.status === 'error').length}/{fileProgress.length}
                          </span>
                        </div>
                        <Progress
                          value={(fileProgress.filter((p) => p.status === 'done' || p.status === 'error').length / fileProgress.length) * 100}
                          className="h-2.5 [&>div]:bg-emerald-500"
                        />
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {fileProgress.map((fp, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                              fp.status === 'processing'
                                ? 'bg-emerald-50 border border-emerald-200'
                                : fp.status === 'done'
                                  ? 'bg-slate-50'
                                  : fp.status === 'error'
                                    ? 'bg-red-50 border border-red-100'
                                    : 'bg-slate-50/50'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {fp.status === 'pending' && (
                                <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                              )}
                              {fp.status === 'processing' && (
                                <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                              )}
                              {fp.status === 'done' && (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              )}
                              {fp.status === 'error' && (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`truncate text-sm ${
                                fp.status === 'processing' ? 'font-medium text-emerald-800' :
                                fp.status === 'error' ? 'text-red-700' :
                                fp.status === 'done' ? 'text-slate-700' : 'text-slate-400'
                              }`}>
                                {fp.fileName}
                              </p>
                              {fp.status === 'processing' && (
                                <p className="text-xs text-emerald-600 mt-0.5">Extraindo dados...</p>
                              )}
                              {fp.status === 'done' && fp.result && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {fp.result.stats.extractedCount}/{fp.result.stats.totalFields} campos ({fp.result.stats.extractionRate}%) — {fp.result.data.UC || 'UC não encontrada'}
                                </p>
                              )}
                              {fp.status === 'error' && (
                                <p className="text-xs text-red-500 mt-0.5">{fp.errorMsg}</p>
                              )}
                            </div>
                            {fp.status === 'done' && fp.result && (
                              <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                                fp.result.stats.extractionRate >= 70
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : fp.result.stats.extractionRate >= 40
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                              }`}>
                                {fp.result.stats.extractionRate}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

          {/* Results Tab - NEW LAYOUT */}
          <TabsContent value="results">
            {results.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhuma fatura processada ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {results.map((result, idx) => {
                  const d = result.data;
                  const rate = result.stats.extractionRate;
                  const rateColor = rate >= 70 ? 'emerald' : rate >= 40 ? 'amber' : 'red';

                  // Count extracted per category
                  const catStats = FIELD_CATEGORIES.map((cat) => {
                    const extracted = cat.fields.filter((f) => d[f]).length;
                    return { cat, extracted, total: cat.fields.length, rate: Math.round((extracted / cat.fields.length) * 100) };
                  }).filter((cs) => cs.total > 0);

                  return (
                    <div key={`${result.fileName}-${idx}`} className="space-y-4">
                      {/* ===== HEADER CARD ===== */}
                      <Card className="overflow-hidden">
                        <div className={`h-1.5 ${rateColor === 'emerald' ? 'bg-emerald-500' : rateColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} />
                        <CardContent className="p-5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Left: file info + key fields */}
                            <div className="flex items-start gap-4">
                              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 flex-shrink-0">
                                <FileText className="h-6 w-6" />
                              </div>
                              <div className="space-y-1">
                                <h3 className="text-base font-semibold text-slate-900">{result.fileName}</h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                                  {d.UC && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                      <span className="font-mono font-medium text-slate-800">{d.UC}</span>
                                    </span>
                                  )}
                                  {d.Cidade && (
                                    <span>{d.Cidade}</span>
                                  )}
                                  {d.MesReferencia && (
                                    <span className="flex items-center gap-1">
                                      <CalendarDays className="h-3.5 w-3.5 text-violet-500" />
                                      {d.MesReferencia}
                                    </span>
                                  )}
                                  {d.ModalidadeTarifaria && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                                      {d.ModalidadeTarifaria}
                                    </span>
                                  )}
                                  {d.Subgrupo && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                                      {d.Subgrupo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: extraction rate + key value */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              {d.ValorTotal && (
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">Valor Total</p>
                                  <p className="text-lg font-bold text-slate-900 font-mono">R$ {d.ValorTotal}</p>
                                </div>
                              )}
                              <div className="text-right">
                                <p className="text-xs text-slate-500">Extração</p>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={rate}
                                    className={`h-2 w-20 ${
                                      rateColor === 'emerald' ? '[&>div]:bg-emerald-500' :
                                      rateColor === 'amber' ? '[&>div]:bg-amber-500' :
                                      '[&>div]:bg-red-500'
                                    }`}
                                  />
                                  <span className={`text-sm font-bold ${
                                    rateColor === 'emerald' ? 'text-emerald-700' :
                                    rateColor === 'amber' ? 'text-amber-700' :
                                    'text-red-700'
                                  }`}>
                                    {rate}%
                                  </span>
                                </div>
                              </div>
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

                          {/* Quick stats row */}
                          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-100">
                            {d.ConsumoTotal && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Zap className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-slate-500">Consumo:</span>
                                <span className="font-mono font-medium text-slate-800">{d.ConsumoTotal} kWh</span>
                              </div>
                            )}
                            {d.ConsumoPonta && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <span className="text-slate-500">Ponta:</span>
                                <span className="font-mono text-slate-700">{d.ConsumoPonta}</span>
                              </div>
                            )}
                            {d.ConsumoForaPonta && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <span className="text-slate-500">FP:</span>
                                <span className="font-mono text-slate-700">{d.ConsumoForaPonta}</span>
                              </div>
                            )}
                            {d.Vencimento && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <CalendarDays className="h-3.5 w-3.5 text-violet-500" />
                                <span className="text-slate-500">Venc:</span>
                                <span className="font-mono text-slate-700">{d.Vencimento}</span>
                              </div>
                            )}
                            {d.NotaFiscal && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Receipt className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-slate-500">NF:</span>
                                <span className="font-mono text-slate-700">{d.NotaFiscal}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-sm">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-slate-500">{result.stats.pageCount} pág.</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* ===== CATEGORY CARDS GRID ===== */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {catStats.map(({ cat, extracted, total, rate: catRate }) => {
                          const meta = CATEGORY_META[cat.category] || DEFAULT_CAT_META;
                          const hasData = extracted > 0;

                          return (
                            <div
                              key={cat.category}
                              className={`rounded-xl border p-4 transition-all ${meta.bg} ${meta.border} ${hasData ? 'shadow-sm' : 'opacity-60'}`}
                            >
                              {/* Category header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={meta.color}>{meta.icon}</span>
                                  <h4 className={`text-sm font-semibold ${meta.color}`}>{cat.category}</h4>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  catRate === 100 ? 'bg-emerald-200 text-emerald-800' :
                                  catRate > 0 ? 'bg-amber-200 text-amber-800' :
                                  'bg-slate-200 text-slate-600'
                                }`}>
                                  {extracted}/{total}
                                </span>
                              </div>

                              {/* Fields */}
                              <div className="space-y-1.5">
                                {cat.fields.map((fieldKey) => {
                                  const value = d[fieldKey];
                                  const isEmpty = !value;
                                  const label = FIELD_LABELS[fieldKey];
                                  // Simplify label by removing category prefix
                                  const shortLabel = label
                                    .replace(/.*Ponta.*/, 'Ponta')
                                    .replace(/.*Fora Ponta.*/, 'Fora Ponta')
                                    .replace(/.*Total.*/, 'Total')
                                    .replace(/\(kWh\)/, '')
                                    .replace(/\(kW\)/, '')
                                    .replace(/\(R\$\)/, '')
                                    .trim();

                                  return (
                                    <div
                                      key={fieldKey}
                                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm ${
                                        isEmpty ? 'bg-white/40' : 'bg-white/80'
                                      }`}
                                    >
                                      <span className={`truncate ${isEmpty ? 'text-slate-400' : 'text-slate-700'}`}>
                                        {shortLabel}
                                      </span>
                                      {isEmpty ? (
                                        <span className="text-[11px] text-slate-300 italic flex-shrink-0">—</span>
                                      ) : (
                                        <span className="font-mono text-xs font-semibold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 flex-shrink-0">
                                          {value}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* ===== CAMPOS MANUAIS ===== */}
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <h4 className="text-sm font-semibold text-amber-700">Campos Manuais (Preencher no Excel)</h4>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <span className="text-sm text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200">Gerência</span>
                          <span className="text-sm text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200">LOCINS</span>
                        </div>
                      </div>

                      {/* Debug: Raw Text */}
                      {debugMode && result.rawText && (
                        <Card className="border-amber-200 bg-amber-50/50">
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
                    </div>
                  );
                })}

                {/* Export bar */}
                <Card>
                  <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <FileSpreadsheet className="h-5 w-5" />
                      <span>
                        <strong>{results.length}</strong> fatura{results.length !== 1 ? 's' : ''} pronta{results.length !== 1 ? 's' : ''} para exportação.
                        Colunas em amarelo no Excel são para preenchimento manual.
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
          Extração de Faturas ENERGISA — Colunas em amarelo no Excel devem ser preenchidas manualmente.
        </div>
      </footer>
    </div>
  );
}
