'use client'

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FIELD_LABELS, FIELD_CATEGORIES, type EnergisaInvoiceData } from '@/lib/energisa-fields';
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
  Calendar,
  Receipt,
  DollarSign,
  MapPin,
  Tag,
  TrendingUp,
  Shield,
  ArrowUpRight,
  Sparkles,
  Building2,
  Hash,
  Clock,
  Gauge,
  CircleDot,
  BatteryCharging,
  Sun,
  PiggyBank,
  CircleDollarSign,
  Minus,
  Plus,
  X,
} from 'lucide-react';

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

/* ── Category visual config ── */
const CAT_CFG: Record<string, { icon: React.ReactNode; accent: string; soft: string; ring: string }> = {
  'Identificação':                    { icon: <Building2 className="h-3.5 w-3.5" />,  accent: 'text-blue-600',    soft: 'bg-blue-50/80',    ring: 'ring-blue-200' },
  'Datas e Documentos':              { icon: <Calendar className="h-3.5 w-3.5" />,   accent: 'text-violet-600',  soft: 'bg-violet-50/80',  ring: 'ring-violet-200' },
  'Tarifa':                           { icon: <Tag className="h-3.5 w-3.5" />,        accent: 'text-indigo-600',  soft: 'bg-indigo-50/80',  ring: 'ring-indigo-200' },
  'Consumo (kWh)':                    { icon: <Zap className="h-3.5 w-3.5" />,       accent: 'text-emerald-600', soft: 'bg-emerald-50/80', ring: 'ring-emerald-200' },
  'Demanda Contratada (kW)':         { icon: <Shield className="h-3.5 w-3.5" />,    accent: 'text-sky-600',     soft: 'bg-sky-50/80',     ring: 'ring-sky-200' },
  'Demanda Medida (kW)':             { icon: <Gauge className="h-3.5 w-3.5" />,     accent: 'text-teal-600',    soft: 'bg-teal-50/80',    ring: 'ring-teal-200' },
  'Demanda Faturada (kW)':           { icon: <TrendingUp className="h-3.5 w-3.5" />, accent: 'text-cyan-600',    soft: 'bg-cyan-50/80',    ring: 'ring-cyan-200' },
  'Ultrapassagem (kW)':              { icon: <ArrowUpRight className="h-3.5 w-3.5" />, accent: 'text-orange-600', soft: 'bg-orange-50/80',  ring: 'ring-orange-200' },
  'Demanda Não Consumida (kW)':      { icon: <Minus className="h-3.5 w-3.5" />,     accent: 'text-rose-600',    soft: 'bg-rose-50/80',    ring: 'ring-rose-200' },
  'Reativa Excedente (kWh)':         { icon: <BatteryCharging className="h-3.5 w-3.5" />, accent: 'text-amber-600', soft: 'bg-amber-50/80',  ring: 'ring-amber-200' },
  'Valores - Consumo (R$)':          { icon: <CircleDollarSign className="h-3.5 w-3.5" />, accent: 'text-green-600', soft: 'bg-green-50/80', ring: 'ring-green-200' },
  'Valores - Demanda (R$)':          { icon: <CircleDollarSign className="h-3.5 w-3.5" />, accent: 'text-emerald-600', soft: 'bg-emerald-50/80', ring: 'ring-emerald-200' },
  'Valores - Ultrapassagem (R$)':    { icon: <CircleDollarSign className="h-3.5 w-3.5" />, accent: 'text-orange-600', soft: 'bg-orange-50/80', ring: 'ring-orange-200' },
  'Valores - Demanda Não Consumida (R$)': { icon: <CircleDollarSign className="h-3.5 w-3.5" />, accent: 'text-rose-600', soft: 'bg-rose-50/80', ring: 'ring-rose-200' },
  'Valores - Reativa Excedente (R$)':{ icon: <CircleDollarSign className="h-3.5 w-3.5" />, accent: 'text-amber-600', soft: 'bg-amber-50/80', ring: 'ring-amber-200' },
  'Tributos e Encargos (R$)':        { icon: <PiggyBank className="h-3.5 w-3.5" />,  accent: 'text-red-600',     soft: 'bg-red-50/80',     ring: 'ring-red-200' },
  'Energia Injetada GDI oUC':        { icon: <Sun className="h-3.5 w-3.5" />,        accent: 'text-lime-600',    soft: 'bg-lime-50/80',    ring: 'ring-lime-200' },
  'Energia Injetada GDI mUC':        { icon: <Sun className="h-3.5 w-3.5" />,        accent: 'text-lime-600',    soft: 'bg-lime-50/80',    ring: 'ring-lime-200' },
  'Geração Distribuída':             { icon: <Sparkles className="h-3.5 w-3.5" />,   accent: 'text-green-600',   soft: 'bg-green-50/80',   ring: 'ring-green-200' },
  'Total':                           { icon: <DollarSign className="h-3.5 w-3.5" />,  accent: 'text-slate-700',   soft: 'bg-slate-100/80',  ring: 'ring-slate-300' },
};
const FALLBACK_CFG = { icon: <Tag className="h-3.5 w-3.5" />, accent: 'text-slate-600', soft: 'bg-slate-50/80', ring: 'ring-slate-200' };

/* ── Helpers ── */
function shortenLabel(label: string): string {
  return label
    .replace(/^Demanda (Contratada|Medida|Faturada) /, '')
    .replace(/^Demanda Potência Não Consumida - /, 'Não Consumida ')
    .replace(/^Valor (Consumo|Demanda|Ultrapassagem|Reativa Excedente|Não Consumida) /, '')
    .replace(/^Energia Atv Injetada GDI /, '')
    .replace(/^Consumo em kWh \(Grupo B\)/, 'Consumo kWh')
    .replace(/^Consumo \(R\$\) \(Grupo B\)/, 'Consumo R$')
    .replace(/^Ultrapassagem /, '')
    .replace(/^Reativa Excedente /, '')
    .replace(/^Energia Reativa Total/, 'Total')
    .replace(/^Saldo Acumulado GD/, 'Saldo GD')
    .replace(/\s*\(kWh\)\s*/, '')
    .replace(/\s*\(kW\)\s*/, '')
    .replace(/\s*\(R\$\)\s*/, '')
    .trim();
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function Home() {
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  [isDragging]; // used in className
  const [activeTab, setActiveTab] = useState<'upload' | 'results'>('upload');
  const [debugMode, setDebugMode] = useState(false);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── file processing ── */
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (pdfFiles.length === 0) { toast.error('Selecione ao menos um arquivo PDF.'); return; }
    setIsProcessing(true);
    const newResults: ExtractionResult[] = [];
    setFileProgress(pdfFiles.map((f) => ({ fileName: f.name, status: 'pending' as const })));

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setFileProgress((p) => p.map((x, idx) => idx === i ? { ...x, status: 'processing' as const } : x));
      try {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/extract-pdf', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) {
          setFileProgress((p) => p.map((x, idx) => idx === i ? { ...x, status: 'error' as const, errorMsg: json.error } : x));
          toast.error(`${file.name}: ${json.error}`);
        } else {
          const er: ExtractionResult = { fileName: file.name, data: json.data, stats: json.stats, rawText: json.rawText };
          newResults.push(er);
          setFileProgress((p) => p.map((x, idx) => idx === i ? { ...x, status: 'done' as const, result: er } : x));
          toast.success(`${file.name}: ${json.stats.extractedCount}/${json.stats.totalFields} campos (${json.stats.extractionRate}%)`);
        }
      } catch {
        setFileProgress((p) => p.map((x, idx) => idx === i ? { ...x, status: 'error' as const, errorMsg: 'Erro ao processar' } : x));
        toast.error(`${file.name}: Erro ao processar.`);
      }
    }

    setResults((prev) => {
      const updated = [...newResults];
      for (const e of prev) {
        const uc = e.data.UC.replace(/\D/g, '');
        if (uc && !updated.some((r) => r.data.UC.replace(/\D/g, '') === uc)) updated.push(e);
      }
      for (const n of newResults) {
        const uc = n.data.UC.replace(/\D/g, '');
        if (uc && prev.some((r) => r.data.UC.replace(/\D/g, '') === uc)) toast.info(`UC ${n.data.UC} atualizada.`);
      }
      return updated;
    });
    setIsProcessing(false);
    setFileProgress([]);
    if (newResults.length > 0) setActiveTab('results');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files); }, [processFiles]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ''; } }, [processFiles]);
  const clearAll = useCallback(() => { setResults([]); setActiveTab('upload'); toast.info('Faturas removidas.'); }, []);
  const removeResult = useCallback((i: number) => { setResults((p) => p.filter((_, x) => x !== i)); toast.info('Fatura removida.'); }, []);

  const exportToExcel = useCallback(async () => {
    if (!results.length) { toast.error('Nenhuma fatura.'); return; }
    try {
      const res = await fetch('/api/export-excel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoices: results.map((r) => ({ ...r.data, _fileName: r.fileName })) }) });
      if (!res.ok) { toast.error('Erro ao gerar Excel.'); return; }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'faturas_energisa.xlsx';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast.success('Excel exportado!');
    } catch { toast.error('Erro ao exportar.'); }
  }, [results]);

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">

      {/* ══════════ HEADER ══════════ */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">ENERGISA</span>
              <span className="text-[11px] text-white/40 font-medium">Extractor</span>
            </div>
          </div>

          {/* Nav pills */}
          <nav className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => results.length > 0 && setActiveTab('results')}
              disabled={results.length === 0}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'results'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed'
              }`}
            >
              Resultados {results.length > 0 && <span className="ml-1 text-emerald-400">({results.length})</span>}
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {results.length > 0 && (
              <button
                onClick={exportToExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ══════════ MAIN ══════════ */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">

        {/* ══════════ UPLOAD TAB ══════════ */}
        {activeTab === 'upload' && (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center max-w-xl mx-auto pt-8 pb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium mb-6">
                <Sparkles className="h-3 w-3" />
                Extração automática de 40+ campos
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
                Extraia dados de faturas<br />
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">ENERGISA</span> em segundos
              </h1>
              <p className="text-sm text-white/40 leading-relaxed">
                Arraste PDFs de faturas de energia e obtenha consumo, demanda, tributos e mais — pronto para Excel.
              </p>
            </div>

            {/* Upload zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative group cursor-pointer rounded-2xl border border-dashed transition-all duration-300
                ${isProcessing ? 'pointer-events-none opacity-50 border-white/10' : isDragging ? 'border-emerald-500/60 bg-emerald-500/5 scale-[1.01]' : 'border-white/10 bg-white/[0.02] hover:border-emerald-500/30 hover:bg-white/[0.04]'}
              `}
            >
              <input ref={fileInputRef} type="file" accept="application/pdf" multiple onChange={handleFileChange} className="hidden" />
              <div className="p-12 sm:p-16 flex flex-col items-center gap-4">
                {!isProcessing && (
                  <>
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/10 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white/80">Arraste faturas PDF aqui</p>
                      <p className="text-xs text-white/30 mt-1">ou clique para selecionar</p>
                    </div>
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 mt-2 cursor-pointer select-none"
                    >
                      <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
                      <Bug className="h-3 w-3 text-white/30" />
                      <span className="text-[11px] text-white/30">Debug</span>
                    </label>
                  </>
                )}

                {/* Processing */}
                {isProcessing && fileProgress.length > 0 && (
                  <div className="w-full max-w-lg mx-auto space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60 font-medium">Processando faturas</span>
                      <span className="text-emerald-400 font-mono">
                        {fileProgress.filter((p) => p.status === 'done' || p.status === 'error').length}/{fileProgress.length}
                      </span>
                    </div>
                    <Progress
                      value={(fileProgress.filter((p) => p.status === 'done' || p.status === 'error').length / fileProgress.length) * 100}
                      className="h-1 bg-white/[0.06] [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-cyan-400 [&>div]:rounded-full"
                    />
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {fileProgress.map((fp, i) => (
                        <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                          fp.status === 'processing' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          fp.status === 'error' ? 'bg-red-500/10 border border-red-500/20' :
                          fp.status === 'done' ? 'bg-white/[0.04]' : 'bg-white/[0.02]'
                        }`}>
                          <div className="flex-shrink-0">
                            {fp.status === 'pending' && <div className="h-4 w-4 rounded-full border border-white/20" />}
                            {fp.status === 'processing' && <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />}
                            {fp.status === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                            {fp.status === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
                          </div>
                          <span className={`flex-1 truncate ${fp.status === 'processing' ? 'text-emerald-300' : fp.status === 'error' ? 'text-red-300' : 'text-white/60'}`}>
                            {fp.fileName}
                          </span>
                          {fp.status === 'done' && fp.result && (
                            <span className="text-emerald-400 font-mono">{fp.result.stats.extractionRate}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { icon: <Zap className="h-3.5 w-3.5" />, label: '40+ Campos', desc: 'UC, consumo, demanda, tributos' },
                { icon: <FileSpreadsheet className="h-3.5 w-3.5" />, label: 'Exportar Excel', desc: 'Com Gerência e LOCINS' },
                { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Multi-modelo', desc: 'Conv., Azul, Verde, GDI' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-white/40">{f.icon}</div>
                  <div>
                    <p className="text-xs font-medium text-white/80">{f.label}</p>
                    <p className="text-[10px] text-white/30">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Existing results quick bar */}
            {results.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-xs text-white/50">{results.length} fatura{results.length !== 1 ? 's' : ''} processada{results.length !== 1 ? 's' : ''}</span>
                <div className="flex gap-2">
                  <button onClick={clearAll} className="text-xs text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Limpar
                  </button>
                  <button onClick={() => setActiveTab('results')} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                    Ver resultados <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ RESULTS TAB ══════════ */}
        {activeTab === 'results' && (
          <div className="space-y-8">
            {results.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/30">Nenhuma fatura processada.</p>
              </div>
            ) : (
              results.map((result, idx) => {
                const d = result.data;
                const rate = result.stats.extractionRate;
                const isGood = rate >= 70;
                const isMid = rate >= 40 && !isGood;

                return (
                  <div key={`${result.fileName}-${idx}`} className="space-y-5">

                    {/* ─── INVOICE HEADER ─── */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                      {/* Top accent line */}
                      <div className={`h-0.5 w-full ${
                        isGood ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' :
                        isMid ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                        'bg-gradient-to-r from-red-500 to-rose-500'
                      }`} />

                      <div className="p-6">
                        {/* Row 1: file + key info */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-start gap-4 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                              <FileText className="h-5 w-5 text-white/40" />
                            </div>
                            <div className="min-w-0">
                              <h2 className="text-sm font-semibold text-white/90 truncate">{result.fileName}</h2>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                {d.UC && (
                                  <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                                    <MapPin className="h-3 w-3" />
                                    <span className="font-mono">{d.UC}</span>
                                  </span>
                                )}
                                {d.Cidade && <span className="text-xs text-white/40">{d.Cidade}</span>}
                                {d.MesReferencia && (
                                  <span className="inline-flex items-center gap-1 text-xs text-violet-400">
                                    <Calendar className="h-3 w-3" />{d.MesReferencia}
                                  </span>
                                )}
                                {d.ModalidadeTarifaria && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                                    {d.ModalidadeTarifaria}
                                  </span>
                                )}
                                {d.Subgrupo && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                                    {d.Subgrupo}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: KPIs */}
                          <div className="flex items-center gap-5 flex-shrink-0">
                            {d.ValorTotal && (
                              <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Valor Total</p>
                                <p className="text-xl font-bold font-mono bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                                  R$ {d.ValorTotal}
                                </p>
                              </div>
                            )}
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Extração</p>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      isGood ? 'bg-emerald-400' : isMid ? 'bg-amber-400' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-bold font-mono ${
                                  isGood ? 'text-emerald-400' : isMid ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                  {rate}%
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeResult(idx)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Quick stats strip */}
                        <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-white/[0.06]">
                          {[
                            { v: d.ConsumoTotal, l: 'Consumo', u: 'kWh', icon: <Zap className="h-3 w-3 text-emerald-400" /> },
                            { v: d.ConsumoPonta, l: 'Ponta', u: 'kWh', icon: null },
                            { v: d.ConsumoForaPonta, l: 'FP', u: 'kWh', icon: null },
                            { v: d.Vencimento, l: 'Vencimento', u: '', icon: <Clock className="h-3 w-3 text-violet-400" /> },
                            { v: d.NotaFiscal, l: 'NF', u: '', icon: <Hash className="h-3 w-3 text-white/30" /> },
                          ].filter(x => x.v).map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              {s.icon}
                              <span className="text-white/30">{s.l}:</span>
                              <span className="font-mono text-white/70">{s.v}{s.u && <span className="text-white/30 ml-0.5">{s.u}</span>}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-1.5 text-xs text-white/30">
                            <FileText className="h-3 w-3" />{result.stats.pageCount} pág.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ─── CATEGORY GRID ─── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {FIELD_CATEGORIES.map((cat) => {
                        const cfg = CAT_CFG[cat.category] || FALLBACK_CFG;
                        const extracted = cat.fields.filter((f) => d[f]).length;
                        const total = cat.fields.length;
                        const catRate = Math.round((extracted / total) * 100);
                        const hasData = extracted > 0;

                        return (
                          <div
                            key={cat.category}
                            className={`rounded-xl border p-4 transition-all duration-200 ${
                              hasData
                                ? `bg-white/[0.03] border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.05]`
                                : `bg-white/[0.01] border-white/[0.04] opacity-40`
                            }`}
                          >
                            {/* Cat header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={cfg.accent}>{cfg.icon}</span>
                                <span className={`text-xs font-semibold ${cfg.accent}`}>{cat.category}</span>
                              </div>
                              <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${
                                catRate === 100 ? 'bg-emerald-500/15 text-emerald-400' :
                                catRate > 0 ? 'bg-amber-500/15 text-amber-400' :
                                'bg-white/[0.06] text-white/30'
                              }`}>
                                {extracted}/{total}
                              </span>
                            </div>

                            {/* Fields */}
                            <div className="space-y-1">
                              {cat.fields.map((fk) => {
                                const val = d[fk];
                                const empty = !val;
                                const label = shortenLabel(FIELD_LABELS[fk]);
                                return (
                                  <div
                                    key={fk}
                                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                                      empty ? 'bg-white/[0.01]' : 'bg-white/[0.04]'
                                    }`}
                                  >
                                    <span className={`truncate ${empty ? 'text-white/20' : 'text-white/60'}`}>
                                      {label}
                                    </span>
                                    {empty ? (
                                      <span className="text-white/10 flex-shrink-0">—</span>
                                    ) : (
                                      <span className="font-mono text-[11px] font-medium text-white/90 bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08] flex-shrink-0">
                                        {val}
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

                    {/* ─── CAMPOS MANUAIS ─── */}
                    <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 flex items-center gap-4">
                      <AlertCircle className="h-4 w-4 text-amber-400/60 flex-shrink-0" />
                      <span className="text-xs text-amber-300/70">
                        Campos para preenchimento manual no Excel:
                      </span>
                      <div className="flex gap-2">
                        <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/15">Gerência</span>
                        <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/15">LOCINS</span>
                      </div>
                    </div>

                    {/* Debug raw text */}
                    {debugMode && result.rawText && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1.5">
                          <Bug className="h-3 w-3" /> Texto Bruto
                        </p>
                        <pre className="text-[10px] leading-tight text-white/50 bg-black/30 rounded-lg p-3 overflow-auto max-h-72 font-mono whitespace-pre-wrap break-all border border-white/[0.06]">
                          {result.rawText}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Export bar */}
            {results.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span><strong className="text-white/60">{results.length}</strong> fatura{results.length !== 1 ? 's' : ''} pronta{results.length !== 1 ? 's' : ''} para exportação</span>
                </div>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar Excel
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t border-white/[0.04] mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-[10px] text-white/20">ENERGISA Extractor</span>
          <span className="text-[10px] text-white/20">Colunas em amarelo no Excel devem ser preenchidas manualmente</span>
        </div>
      </footer>
    </div>
  );
}
