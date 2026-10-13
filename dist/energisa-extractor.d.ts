export interface TableItem {
    label: string;
    unidade: string;
    quantidade: string;
    precoUnit: string;
    valor: string;
    pisCofins: string;
    baseCalcICMS: string;
    aliquotaICMS: string;
    icms: string;
    tarifa: string;
}
export interface TableExtraction {
    items: TableItem[];
    pisTotal: string;
    cofinsTotal: string;
    icmsTotal: string;
}
export interface EnergisaInvoiceData {
    UC: string;
    Cidade: string;
    Tipo: string;
    Mercado: string;
    Concessionaria: string;
    MesReferencia: string;
    AnoLeitura: string;
    Vencimento: string;
    NotaFiscal: string;
    ModalidadeTarifaria: string;
    Subgrupo: string;
    ConsumoPonta: string;
    ConsumoForaPonta: string;
    ConsumoTotal: string;
    ConsumoGrupoB_kWh: string;
    ConsumoGrupoB_Valor: string;
    DemandaContratadaPonta: string;
    DemandaContratadaForaPonta: string;
    DemandaMedidaPonta: string;
    DemandaMedidaForaPonta: string;
    DemandaFaturadaPonta: string;
    DemandaFaturadaForaPonta: string;
    UltrapassagemPonta: string;
    UltrapassagemForaPonta: string;
    DemandaNaoConsumidaPonta: string;
    DemandaNaoConsumidaForaPonta: string;
    ValorNaoConsumidaPonta: string;
    ValorNaoConsumidaForaPonta: string;
    ReativaExcedentePonta: string;
    ReativaExcedenteForaPonta: string;
    ValorConsumoPonta: string;
    ValorConsumoForaPonta: string;
    ValorDemandaPonta: string;
    ValorDemandaForaPonta: string;
    ValorUltrapassagemPonta: string;
    ValorUltrapassagemForaPonta: string;
    ValorReativaExcedentePonta: string;
    ValorReativaExcedenteForaPonta: string;
    PIS: string;
    COFINS: string;
    ICMS: string;
    GDI: string;
    CIP: string;
    EnergiaReativaTotal: string;
    EnergiaAtvInjetadaGDIoUC_Qtd: string;
    EnergiaAtvInjetadaGDIoUC_Valor: string;
    EnergiaAtvInjetadaGDImUC_Qtd: string;
    EnergiaAtvInjetadaGDImUC_Valor: string;
    SaldoAcumuladoGD: string;
    ValorTotal: string;
}
export declare function extractEnergisaData(rawText: string, tableExtraction?: TableExtraction): EnergisaInvoiceData;
export declare const FIELD_LABELS: Record<keyof EnergisaInvoiceData, string>;
export declare const FIELD_CATEGORIES: {
    category: string;
    fields: (keyof EnergisaInvoiceData)[];
}[];
