"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/energisa-extractor.ts
var energisa_extractor_exports = {};
__export(energisa_extractor_exports, {
  FIELD_CATEGORIES: () => FIELD_CATEGORIES,
  FIELD_LABELS: () => FIELD_LABELS,
  extractEnergisaData: () => extractEnergisaData
});
module.exports = __toCommonJS(energisa_extractor_exports);
var EMPTY = "";
function parseBR(s) {
  const neg = s.startsWith("-");
  const clean = neg ? s.slice(1) : s;
  return parseFloat(clean.replace(".", "").replace(",", ".")) * (neg ? -1 : 1);
}
function findLine(lines, pattern) {
  return lines.findIndex((l) => pattern.test(l));
}
function findAllMoney(text) {
  const matches = text.match(/R\$\s*([\d.]+,\d{2})/g);
  if (!matches) return [];
  return matches.map((m) => m.match(/([\d.]+,\d{2})/)?.[1] || "").filter(Boolean);
}
function findNumNearLine(lines, startIdx, direction, maxDist, mustBeOnlyNum) {
  for (let i = startIdx + direction; i >= 0 && i < lines.length; i += direction) {
    if (Math.abs(i - startIdx) > maxDist) break;
    const line = lines[i];
    if (mustBeOnlyNum) {
      const m = line.match(/^(\d[\d.]+,\d{2})$/);
      if (m) return m[1];
    } else {
      const m = line.match(/([\d.]+,\d{2})/);
      if (m && !/^[A-Za-z]/.test(line)) return m[1];
    }
  }
  return EMPTY;
}
function extractEnergisaData(rawText, tableExtraction) {
  const tableData = tableExtraction?.items;
  const tributosFromTable = tableExtraction ? { pis: tableExtraction.pisTotal, cofins: tableExtraction.cofinsTotal, icms: tableExtraction.icmsTotal } : null;
  const lines = rawText.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l.length > 0);
  const flat = lines.join(" ");
  const Concessionaria = (() => {
    for (const line of lines.slice(0, 20)) {
      if (/^ENERGISA/i.test(line) && line.length > 15 && !/\d{2}\s*\/\s*\d{2}/.test(line)) {
        return line.replace(/\s+/g, " ");
      }
    }
    return EMPTY;
  })();
  const Tipo = (() => {
    const u = flat.toUpperCase();
    if (/SERVI[ÇC]O\s+P[ÚU]BLICO/.test(u)) return "SERVI\xC7O P\xDABLICO";
    if (/PODER\s+P[ÚU]BLICO/.test(u)) return "PODER P\xDABLICO";
    if (/RESIDENCIAL/.test(u)) return "RESIDENCIAL";
    if (/COMERCIAL/.test(u)) return "COMERCIAL";
    if (/INDUSTRIAL/.test(u)) return "INDUSTRIAL";
    if (/RURAL/.test(u)) return "RURAL";
    return EMPTY;
  })();
  const Mercado = (() => {
    const m = flat.match(/SERVI[ÇC]O\s+P[ÚU]BLICO\s*\/\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú,\s]{3,40}?)(?:\s*TENSÃO|\s*\d|\s*$)/i);
    if (m) {
      const val = m[1].trim().replace(/\s+/g, " ");
      if (val.length < 50) return val.toUpperCase();
    }
    return EMPTY;
  })();
  const Cidade = (() => {
    for (const line of lines.slice(0, 60)) {
      const m = line.match(/([A-ZÀ-Ú][A-ZÀ-Ú\s]{3,30}?)\s+(?:MS|SP|PR|MT|GO|MG|RS)?\s*\(\s*AG\s*:\s*\d+\s*\)/i);
      if (m) {
        const name = m[1].trim().toUpperCase();
        const skip = [
          "SANESUL",
          "ENERGISA",
          "DISTRIBUIDORA",
          "SA",
          "EMPRESA DE SANEAMENTO",
          "RUA ",
          "AV ",
          "DOM.",
          "ENDERE\xC7O",
          "PAGADOR"
        ];
        if (name.length >= 4 && name.length <= 30 && !skip.some((s) => name.startsWith(s))) return name;
      }
    }
    return EMPTY;
  })();
  const UC = (() => {
    for (const line of lines) {
      const m = line.match(/^(?:\d{1,3}\/)?(\d{4,8})-\d$/);
      if (m) {
        const num = m[1].replace(/^0+/, "") || "0";
        if (num.length >= 3) return num;
      }
    }
    const slashCtx = flat.match(/Código\s*:\s*(\d{1,3})\/(\d{4,8})-\d/i);
    if (slashCtx) {
      const num = slashCtx[2].replace(/^0+/, "") || "0";
      if (num.length >= 3) return num;
    }
    for (const line of lines) {
      const m = line.match(/^(\d{1,3}\.\d{3}\.\d{3}-\d{2})$/);
      if (m) return m[1];
    }
    for (const line of lines) {
      const m = line.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
      if (m && line.length < 40 && !/CNPJ|CPF|CEP/i.test(line)) return m[1];
    }
    const ucMat = flat.match(/MATR[IÍ]CULA\s*:\s*0*(\d{4,10})(?:-\d{4}-\d{2}-\d)?/i);
    if (ucMat) return ucMat[1];
    const uc13 = flat.match(/(?:RUA|AV|ESTRADA)[^\d]*(\d{13})\s/);
    if (uc13) return uc13[1];
    const uc13b = flat.match(/Instalação\s*:?\s*(\d{7,13})/i);
    if (uc13b) return uc13b[1];
    const ucLabel = flat.match(/(?:UC\s*:?|Unid\.?\s*Cons\.?)[^\d]*(\d{4,13})/i);
    if (ucLabel) return ucLabel[1].replace(/^0+/, "") || ucLabel[1];
    const broad = flat.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
    return broad ? broad[1] : EMPTY;
  })();
  const MesReferencia = (() => {
    const meses = "Janeiro|Fevereiro|Mar[\xE7c]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro";
    const numToMonth = {
      "01": "Janeiro",
      "02": "Fevereiro",
      "03": "Mar\xE7o",
      "04": "Abril",
      "05": "Maio",
      "06": "Junho",
      "07": "Julho",
      "08": "Agosto",
      "09": "Setembro",
      "10": "Outubro",
      "11": "Novembro",
      "12": "Dezembro"
    };
    const nameMatch = flat.match(new RegExp(`(${meses})\\s*[\\/\\-]\\s*(\\d{4})`, "i"));
    if (nameMatch) {
      const month = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      return `${month} / ${nameMatch[2]}`;
    }
    const numMatch = flat.match(/(\d{2})\s*[\\/]\s*(\d{4})/);
    if (numMatch && numToMonth[numMatch[1]]) {
      return `${numToMonth[numMatch[1]]} / ${numMatch[2]}`;
    }
    return EMPTY;
  })();
  const AnoLeitura = (() => {
    const m = flat.match(/Leitura\s+Atual\s*:\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i);
    if (m) return m[1];
    if (MesReferencia) {
      const ym = MesReferencia.match(/(\d{4})/);
      if (ym) return ym[1];
    }
    return EMPTY;
  })();
  const Vencimento = (() => {
    const venMoney = flat.match(/(\d{2}\/\d{2}\/\d{4})\s*R\$\s*[\d.]+,\d{2}/);
    if (venMoney) return venMoney[1];
    const moneyVen = flat.match(/R\$\s*[\d.]+,\d{2}\s*(\d{2}\/\d{2}\/\d{4})/);
    if (moneyVen) return moneyVen[1];
    const venIdx = findLine(lines, /VENCIMENTO/i);
    if (venIdx >= 0) {
      for (let i = venIdx - 1; i >= Math.max(0, venIdx - 5); i--) {
        const m = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
        if (m) return m[1];
      }
      for (let i = venIdx + 1; i < Math.min(venIdx + 3, lines.length); i++) {
        const m = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
        if (m) return m[1];
      }
    }
    const apresMatch = flat.match(/Data de Apresentação:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (apresMatch) return apresMatch[1];
    return EMPTY;
  })();
  const NotaFiscal = (() => {
    const m = flat.match(/NOTA\s+FISCAL\s*N[º°]?\s*[:\-]?\s*(\d[\d.]*)/i);
    return m ? m[1] : EMPTY;
  })();
  const ModalidadeTarifaria = (() => {
    if (/CONVENCIONAL/i.test(flat)) return "CONVENCIONAL";
    if (/AZUL/i.test(flat) && /HOR[ÁA]RIO/i.test(flat)) return "HOR\xC1RIO AZUL";
    if (/AZUL/i.test(flat)) return "AZUL";
    if (/VERDE/i.test(flat) && /HOR[ÁA]RIO/i.test(flat)) return "HOR\xC1RIO VERDE";
    if (/VERDE/i.test(flat)) return "VERDE";
    return EMPTY;
  })();
  const Subgrupo = (() => {
    const m = flat.match(/\/\s*([AB]\d)\s/);
    if (m) return m[1].toUpperCase();
    const classIdx = findLine(lines, /Classifica[çc][aã]o/i);
    if (classIdx >= 0) {
      const region = lines.slice(classIdx, Math.min(classIdx + 3, lines.length)).join(" ");
      const m2 = region.match(/\b([AB][1-4]|AS|BS)\b/);
      if (m2) return m2[1].toUpperCase();
    }
    return EMPTY;
  })();
  const isSplitTariff = /AZUL|VERDE/i.test(flat) && !/CONVENCIONAL/i.test(flat);
  let ConsumoPonta = EMPTY;
  let ConsumoForaPonta = EMPTY;
  let ConsumoTotal = EMPTY;
  let ValorConsumoPonta = EMPTY;
  let ValorConsumoForaPonta = EMPTY;
  if (isSplitTariff) {
    const pontaIdx = findLine(lines, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)/i);
    const fpIdx = findLine(lines, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
    if (pontaIdx >= 0) ConsumoPonta = findNumNearLine(lines, pontaIdx, 1, 8, false);
    if (fpIdx >= 0) ConsumoForaPonta = findNumNearLine(lines, fpIdx, 1, 8, false);
    ValorConsumoPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)/i);
    ValorConsumoForaPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
  } else {
    for (const line of lines) {
      const km = line.match(/^KWH\s*([\d.,]+)$/i);
      if (km) {
        ConsumoTotal = km[1];
        break;
      }
    }
    if (!ConsumoTotal) {
      const consIdx = findLine(lines, /CONSUMO\s+FATURADO/i);
      if (consIdx >= 0) {
        for (let i = consIdx + 1; i < Math.min(consIdx + 15, lines.length); i++) {
          const line = lines[i];
          if (/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/i.test(line)) continue;
          if (/[A-Za-z]{4,}/.test(line)) continue;
          const m = line.match(/^(\d[\d.]+,\d{2})$/);
          if (m) {
            ConsumoTotal = m[1];
            break;
          }
        }
      }
    }
    ValorConsumoForaPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh(?!.*Ponta)/i);
  }
  let DemandaContratadaPonta = EMPTY;
  let DemandaContratadaForaPonta = EMPTY;
  let DemandaMedidaPonta = EMPTY;
  let DemandaMedidaForaPonta = EMPTY;
  let DemandaFaturadaPonta = EMPTY;
  let DemandaFaturadaForaPonta = EMPTY;
  let ValorDemandaPonta = EMPTY;
  let ValorDemandaForaPonta = EMPTY;
  if (isSplitTariff) {
    const dcMatch = flat.match(/KW\s+Ponta\s*:\s*(\d+(?:[.,]\d+)?)/i);
    if (dcMatch) DemandaContratadaPonta = dcMatch[1].replace(".", ",");
    const dcFpMatch = flat.match(/Fora\s+Ponta\s*:\s*(\d+(?:[.,]\d+)?)/i);
    if (dcFpMatch) DemandaContratadaForaPonta = dcFpMatch[1].replace(".", ",");
    DemandaMedidaPonta = findQtyNearLine(lines, /Demanda\s+Medida.*Ponta(?!.*Fora)/i);
    DemandaMedidaForaPonta = findQtyNearLine(lines, /Demanda\s+Medida.*Fora\s*Ponta/i);
    DemandaFaturadaPonta = findQtyNearLine(lines, /Demanda\s+Fatur[ae]da.*Ponta(?!.*Fora)/i) || DemandaMedidaPonta;
    DemandaFaturadaForaPonta = findQtyNearLine(lines, /Demanda\s+Fatur[ae]da.*Fora\s*Ponta/i) || DemandaMedidaForaPonta;
    ValorDemandaPonta = findRValueNearLine(lines, flat, /Demanda\s+(?:Medida|Fatur[ae]da).*Ponta(?!.*Fora)/i);
    ValorDemandaForaPonta = findRValueNearLine(lines, flat, /Demanda\s+(?:Medida|Fatur[ae]da).*Fora\s*Ponta/i);
  }
  let UltrapassagemPonta = EMPTY;
  let UltrapassagemForaPonta = EMPTY;
  let ValorUltrapassagemPonta = EMPTY;
  let ValorUltrapassagemForaPonta = EMPTY;
  let DemandaNaoConsumidaPonta = EMPTY;
  let DemandaNaoConsumidaForaPonta = EMPTY;
  let ValorNaoConsumidaPonta = EMPTY;
  let ValorNaoConsumidaForaPonta = EMPTY;
  if (isSplitTariff) {
    UltrapassagemPonta = findQtyNearLine(lines, /Ultrapassagem.*Ponta(?!.*Fora)/i);
    UltrapassagemForaPonta = findQtyNearLine(lines, /Ultrapassagem.*Fora\s*Ponta/i);
    ValorUltrapassagemPonta = findRValueNearLine(lines, flat, /Ultrapassagem.*Ponta(?!.*Fora)/i);
    ValorUltrapassagemForaPonta = findRValueNearLine(lines, flat, /Ultrapassagem.*Fora\s*Ponta/i);
    DemandaNaoConsumidaPonta = findQtyNearLine(lines, /Não\s*Consumida.*Ponta(?!.*Fora)/i);
    DemandaNaoConsumidaForaPonta = findQtyNearLine(lines, /Não\s*Consumida.*Fora\s*Ponta/i);
    ValorNaoConsumidaPonta = findRValueNearLine(lines, flat, /Não\s*Consumida.*Ponta(?!.*Fora)/i);
    ValorNaoConsumidaForaPonta = findRValueNearLine(lines, flat, /Não\s*Consumida.*Fora\s*Ponta/i);
  }
  let ReativaExcedentePonta = EMPTY;
  let ReativaExcedenteForaPonta = EMPTY;
  let EnergiaReativaTotal = EMPTY;
  let ValorReativaExcedentePonta = EMPTY;
  let ValorReativaExcedenteForaPonta = EMPTY;
  if (isSplitTariff) {
    ReativaExcedentePonta = findQtyNearLine(lines, /Reactiv?a\s+Excedente.*Ponta(?!.*Fora)/i);
    ReativaExcedenteForaPonta = findQtyNearLine(lines, /Reactiv?a\s+Excedente.*Fora\s*Ponta/i);
    ValorReativaExcedentePonta = findRValueNearLine(lines, flat, /Reactiv?a\s+Excedente.*Ponta(?!.*Fora)/i);
    ValorReativaExcedenteForaPonta = findRValueNearLine(lines, flat, /Reactiv?a\s+Excedente.*Fora\s*Ponta/i);
  } else {
    EnergiaReativaTotal = findQtyNearLine(lines, /Reactiv?a\s+Excedente/i);
  }
  let PIS = EMPTY;
  let COFINS = EMPTY;
  let ICMS = EMPTY;
  if (tributosFromTable?.pis) PIS = tributosFromTable.pis;
  if (tributosFromTable?.cofins) COFINS = tributosFromTable.cofins;
  if (tributosFromTable?.icms) ICMS = tributosFromTable.icms;
  if (!PIS || !COFINS || !ICMS) {
    const pisIdx = findLine(lines, /^PIS\s*\/\s*$/i);
    if (pisIdx >= 0) {
      const nums = [];
      for (let i = pisIdx + 1; i < Math.min(pisIdx + 10, lines.length) && nums.length < 3; i++) {
        const lineNums = lines[i].match(/(\d[\d.]*,\d{2})/g);
        if (lineNums) {
          for (const n of lineNums) {
            nums.push(n);
            if (nums.length >= 3) break;
          }
        }
      }
      if (nums.length >= 3) {
        if (!PIS) PIS = nums[0];
        if (!COFINS) COFINS = nums[1];
        if (!ICMS) ICMS = nums[2];
      }
    }
    if (!PIS && !COFINS) {
      const combinedIdx = findLine(lines, /PIS\/\s*COFINS/i);
      if (combinedIdx >= 0) {
        const nums = [];
        for (let i = combinedIdx + 1; i < Math.min(combinedIdx + 6, lines.length) && nums.length < 3; i++) {
          const m = lines[i].match(/^(\d[\d.]*,\d{2})$/);
          if (m) nums.push(m[1]);
        }
        if (nums.length >= 3) {
          if (!PIS) PIS = nums[0];
          if (!COFINS) COFINS = nums[1];
          if (!ICMS) ICMS = nums[2];
        }
      }
    }
    if (!PIS || !COFINS) {
      const flatMatch = flat.match(/PIS\s*\/\s*COFINS[^\d]*?(\d[\d.]*,\d{2})[^\d]*?(\d[\d.]*,\d{2})/i);
      if (flatMatch) {
        if (!PIS) PIS = flatMatch[1];
        if (!COFINS) COFINS = flatMatch[2];
      }
    }
    if (!PIS) PIS = findTributoValue(lines, flat, /\bPIS\b(?!\/)/i);
    if (!COFINS) COFINS = findTributoValue(lines, flat, /\bCOFINS\b/i);
    if (!ICMS) ICMS = findTributoValue(lines, flat, /\bICMS\b(?!\s*%|\s*\()/i);
  }
  const GDI = findTributoValue(lines, flat, /\bGDI\b/i);
  const CIP_text = (() => {
    const cipIdx = findLine(lines, /CIP\s*MUNICIPAL/i);
    if (cipIdx >= 0) {
      const region = lines.slice(Math.max(0, cipIdx - 1), Math.min(cipIdx + 5, lines.length)).join(" ");
      const money = findAllMoney(region);
      if (money.length > 0) return money[money.length - 1];
    }
    return findTributoValue(lines, flat, /\bCIP\b/i);
  })();
  let {
    oUC_Qtd: EnergiaAtvInjetadaGDIoUC_Qtd,
    oUC_Valor: EnergiaAtvInjetadaGDIoUC_Valor,
    mUC_Qtd: EnergiaAtvInjetadaGDImUC_Qtd,
    mUC_Valor: EnergiaAtvInjetadaGDImUC_Valor
  } = extractGDI(lines, flat);
  const ValorTotal = (() => {
    const venTotal = flat.match(/\d{2}\/\d{2}\/\d{4}\s*R\$\s*([\d.]+,\d{2})/);
    if (venTotal) return venTotal[1];
    const totalMes = flat.match(/R\$\s*([\d.]+,\d{2})\s*(?:Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)/i);
    if (totalMes) return totalMes[1];
    const totalIdx = findLine(lines, /TOTAL\s+A\s+PAGAR/i);
    if (totalIdx >= 0) {
      const m1 = lines[totalIdx].match(/R\$\s*([\d.]+,\d{2})/);
      if (m1) return m1[1];
      for (let i = totalIdx + 1; i < Math.min(totalIdx + 3, lines.length); i++) {
        const m2 = lines[i].match(/R\$\s*([\d.]+,\d{2})/);
        if (m2) return m2[1];
        const m3 = lines[i].match(/^(\d[\d.]+,\d{2})$/);
        if (m3) return m3[1];
      }
    }
    const lastMoney = findAllMoney(flat);
    if (lastMoney.length > 0) {
      lastMoney.sort((a, b) => parseFloat(b.replace(".", "").replace(",", ".")) - parseFloat(a.replace(".", "").replace(",", ".")));
      return lastMoney[0];
    }
    return EMPTY;
  })();
  let CIP = CIP_text;
  if (tableData && tableData.length > 0) {
    let cipFromTable = EMPTY;
    for (const item of tableData) {
      const lbl = item.label;
      const isFora = /Fora/i.test(lbl) || /F[\s.]*Ponta/i.test(lbl);
      const isPonta = /Ponta/i.test(lbl) && !isFora;
      if (/Consumo\s+em\s+kWh/i.test(lbl) && !/Reativ/i.test(lbl) && !/Injetada/i.test(lbl)) {
        if (!/Ponta/i.test(lbl) && !/Fora/i.test(lbl) && !/Intermedi/i.test(lbl)) {
          if (item.quantidade) ConsumoTotal = item.quantidade;
          if (item.valor) ValorConsumoForaPonta = item.valor;
        } else if (/Intermedi[áa]ria/i.test(lbl)) {
          if (item.quantidade && !ConsumoForaPonta) ConsumoForaPonta = item.quantidade;
        } else if (isPonta) {
          if (item.quantidade) ConsumoPonta = item.quantidade;
          if (item.valor) ValorConsumoPonta = item.valor;
        } else if (isFora) {
          if (item.quantidade) ConsumoForaPonta = item.quantidade;
          if (item.valor) ValorConsumoForaPonta = item.valor;
        }
      } else if (/Demanda.*Medida/i.test(lbl) && !/Ultrapassagem/i.test(lbl) && !/Não.*Consumida/i.test(lbl)) {
        if (!isFora) {
          if (item.quantidade) DemandaMedidaPonta = item.quantidade;
          if (item.valor) ValorDemandaPonta = item.valor;
        } else {
          if (item.quantidade) DemandaMedidaForaPonta = item.quantidade;
          if (item.valor) ValorDemandaForaPonta = item.valor;
        }
      } else if (/(?:Ultrapassagem|Ultrap)/i.test(lbl) && /Demanda/i.test(lbl) && !/Não\s*Consumida/i.test(lbl)) {
        if (!isFora) {
          if (item.quantidade) UltrapassagemPonta = item.quantidade;
          if (item.valor) ValorUltrapassagemPonta = item.valor;
        } else {
          if (item.quantidade) UltrapassagemForaPonta = item.quantidade;
          if (item.valor) ValorUltrapassagemForaPonta = item.valor;
        }
      } else if (/Não\s*Consumida/i.test(lbl) && /Demanda/i.test(lbl)) {
        if (!isFora) {
          if (item.quantidade) DemandaNaoConsumidaPonta = item.quantidade;
          if (item.valor) ValorNaoConsumidaPonta = item.valor;
        } else {
          if (item.quantidade) DemandaNaoConsumidaForaPonta = item.quantidade;
          if (item.valor) ValorNaoConsumidaForaPonta = item.valor;
        }
      } else if (/Reactiv?a\s*Excedente/i.test(lbl) || /Energia\s*Reativa\s*Exced/i.test(lbl)) {
        if (!isFora && /Ponta/i.test(lbl)) {
          if (item.quantidade) ReativaExcedentePonta = item.quantidade;
          if (item.valor) ValorReativaExcedentePonta = item.valor;
        } else if (isFora || /F[\s.]*Ponta/i.test(lbl)) {
          if (item.quantidade) ReativaExcedenteForaPonta = item.quantidade;
          if (item.valor) ValorReativaExcedenteForaPonta = item.valor;
        } else if (!isFora && !/Ponta/i.test(lbl)) {
          if (item.quantidade) EnergiaReativaTotal = item.quantidade;
          if (item.valor) ValorReativaExcedentePonta = item.valor;
        }
      } else if (/CIP\s*MUNICIPAL/i.test(lbl) || /^CONT\.IL\.PUB/i.test(lbl)) {
        if (item.valor) cipFromTable = item.valor;
      } else if (/Energia\s*Atv\s*Injetada\s*GDI\s*oUC/i.test(lbl)) {
        if (item.quantidade && !EnergiaAtvInjetadaGDIoUC_Qtd) EnergiaAtvInjetadaGDIoUC_Qtd = item.quantidade;
        if (item.valor && !EnergiaAtvInjetadaGDIoUC_Valor) EnergiaAtvInjetadaGDIoUC_Valor = item.valor;
      } else if (/Energia\s*Atv\s*Injetada\s*GDI\s*mUC/i.test(lbl)) {
        if (item.quantidade) {
          EnergiaAtvInjetadaGDImUC_Qtd = EnergiaAtvInjetadaGDImUC_Qtd ? fmtSumBR(EnergiaAtvInjetadaGDImUC_Qtd, item.quantidade) : item.quantidade;
        }
        if (item.valor) {
          EnergiaAtvInjetadaGDImUC_Valor = EnergiaAtvInjetadaGDImUC_Valor ? fmtSumBR(EnergiaAtvInjetadaGDImUC_Valor, item.valor) : item.valor;
        }
      }
    }
    if (cipFromTable) CIP = cipFromTable;
  }
  return {
    UC,
    Cidade,
    Tipo,
    Mercado,
    Concessionaria,
    MesReferencia,
    AnoLeitura,
    Vencimento,
    NotaFiscal,
    ModalidadeTarifaria,
    Subgrupo,
    ConsumoPonta,
    ConsumoForaPonta,
    ConsumoTotal,
    DemandaContratadaPonta,
    DemandaContratadaForaPonta,
    DemandaMedidaPonta,
    DemandaMedidaForaPonta,
    DemandaFaturadaPonta,
    DemandaFaturadaForaPonta,
    UltrapassagemPonta,
    UltrapassagemForaPonta,
    DemandaNaoConsumidaPonta,
    DemandaNaoConsumidaForaPonta,
    ValorNaoConsumidaPonta,
    ValorNaoConsumidaForaPonta,
    ReativaExcedentePonta,
    ReativaExcedenteForaPonta,
    ValorConsumoPonta,
    ValorConsumoForaPonta,
    ValorDemandaPonta,
    ValorDemandaForaPonta,
    ValorUltrapassagemPonta,
    ValorUltrapassagemForaPonta,
    ValorReativaExcedentePonta,
    ValorReativaExcedenteForaPonta,
    PIS,
    COFINS,
    ICMS,
    GDI,
    CIP,
    EnergiaReativaTotal,
    EnergiaAtvInjetadaGDIoUC_Qtd,
    EnergiaAtvInjetadaGDIoUC_Valor,
    EnergiaAtvInjetadaGDImUC_Qtd,
    EnergiaAtvInjetadaGDImUC_Valor,
    ValorTotal
  };
}
function extractGDI(lines, flat) {
  const EMPTY2 = "";
  let nOUC = 0;
  let nMUC = 0;
  let firstGDI = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/Energia\s*Atv\s*Injetada\s*GDI\s*oUC/i.test(lines[i])) {
      nOUC++;
      if (firstGDI < 0) firstGDI = i;
    } else if (/Energia\s*Atv\s*Injetada\s*GDI\s*mUC/i.test(lines[i])) {
      nMUC++;
      if (firstGDI < 0) firstGDI = i;
    }
  }
  if (nOUC === 0 && nMUC === 0) {
    return { oUC_Qtd: EMPTY2, oUC_Valor: EMPTY2, mUC_Qtd: EMPTY2, mUC_Valor: EMPTY2 };
  }
  const chaveIdx = (() => {
    for (let i = firstGDI; i < Math.min(firstGDI + 100, lines.length); i++) {
      if (/^chave de acesso:\s*$/i.test(lines[i])) return i;
    }
    return -1;
  })();
  let sectionEnd = Math.min(firstGDI + 100, lines.length);
  for (let i = firstGDI; i < Math.min(firstGDI + 120, lines.length); i++) {
    if (/^(Declara[cç]|EMITIDO EM|NOTA FISCAL N|Importante:)/i.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }
  if (chaveIdx >= 0) {
    sectionEnd = Math.min(Math.max(sectionEnd, chaveIdx + 20), lines.length);
  }
  const allQtds = [];
  if (chaveIdx >= 0) {
    for (let i = chaveIdx + 1; i < Math.min(chaveIdx + 20, sectionEnd); i++) {
      const m = lines[i].match(/^(\d[\d.]*,\d{2})$/);
      if (m) allQtds.push(parseBR(m[1]));
    }
  }
  if (allQtds.length === 0) {
    for (let i = firstGDI; i < sectionEnd; i++) {
      const m = lines[i].match(/^(\d[\d.]+,\d{2})$/);
      if (m && parseBR(m[1]) >= 100) allQtds.push(parseBR(m[1]));
      if (allQtds.length >= nOUC + nMUC) break;
    }
  }
  const allRVals = [];
  const rSearchEnd = chaveIdx >= 0 ? chaveIdx : sectionEnd;
  const totalNeeded = nOUC + nMUC;
  for (let i = firstGDI; i < rSearchEnd; i++) {
    const m = lines[i].match(/^(.+?)-((?:\d{1,3}\.)*\d+,\d{2})$/);
    if (m && allRVals.length < totalNeeded) {
      allRVals.push(parseBR("-" + m[2]));
    }
  }
  if (allRVals.length < totalNeeded) {
    for (let i = firstGDI; i < rSearchEnd; i++) {
      const m = lines[i].match(/^(-\d[\d.]*,\d{2})$/);
      if (m && allRVals.length < totalNeeded) {
        allRVals.push(parseBR(m[1]));
      }
    }
  }
  const oUCQtds = allQtds.splice(0, nOUC);
  const oUCRVals = allRVals.splice(0, nOUC);
  const sumQtd = (arr) => arr.length > 0 ? fmtBRNumber(arr.reduce((a, b) => a + b, 0)) : EMPTY2;
  const sumR = (arr) => arr.length > 0 ? fmtBRNumber(Math.abs(arr.reduce((a, b) => a + b, 0))) : EMPTY2;
  return {
    oUC_Qtd: sumQtd(oUCQtds),
    oUC_Valor: sumR(oUCRVals),
    mUC_Qtd: sumQtd(allQtds),
    mUC_Valor: sumR(allRVals)
  };
}
function fmtBRNumber(n) {
  const abs = Math.abs(n);
  const intPart = Math.floor(abs).toString();
  const decPart = Math.round((abs - Math.floor(abs)) * 100).toString().padStart(2, "0");
  let formatted = "";
  for (let i = intPart.length - 1, c = 0; i >= 0; i--, c++) {
    if (c > 0 && c % 3 === 0) formatted = "." + formatted;
    formatted = intPart[i] + formatted;
  }
  return (n < 0 ? "-" : "") + formatted + "," + decPart;
}
function fmtSumBR(a, b) {
  return fmtBRNumber(parseBR(a) + parseBR(b));
}
function findQtyNearLine(lines, labelPattern) {
  const idx = findLine(lines, labelPattern);
  if (idx < 0) return EMPTY;
  for (let i = idx + 1; i < Math.min(idx + 10, lines.length); i++) {
    const line = lines[i];
    if (/[A-Za-z]{4,}/.test(line) && !/kWh|kW|R\$|tarifa/i.test(line)) continue;
    const m = line.match(/([\d.]+,\d{2})/);
    if (m) return m[1];
  }
  return EMPTY;
}
function findRValueNearLine(lines, flat, labelPattern) {
  const idx = findLine(lines, labelPattern);
  if (idx < 0) return EMPTY;
  const region = lines.slice(idx, Math.min(idx + 12, lines.length)).join(" ");
  const moneyVals = findAllMoney(region);
  if (moneyVals.length > 0) return moneyVals[moneyVals.length - 1];
  return EMPTY;
}
function findTributoValue(lines, flat, labelPattern) {
  const idx = findLine(lines, labelPattern);
  if (idx >= 0) {
    for (let i = idx + 1; i < Math.min(idx + 6, lines.length); i++) {
      const m = lines[i].match(/^(\d[\d.]+,\d{2})$/);
      if (m) return m[1];
    }
  }
  const flatMatch = flat.match(new RegExp(labelPattern.source + "[^\\d]*?([\\d.]+,\\d{2})", "i"));
  return flatMatch ? flatMatch[1] : EMPTY;
}
var FIELD_LABELS = {
  UC: "UC (Unidade Consumidora)",
  Cidade: "Cidade",
  Tipo: "Tipo",
  Mercado: "Mercado",
  Concessionaria: "Concession\xE1ria",
  MesReferencia: "M\xEAs Refer\xEAncia",
  AnoLeitura: "Ano Leitura",
  Vencimento: "Vencimento",
  NotaFiscal: "Nota Fiscal",
  ModalidadeTarifaria: "Modalidade Tarif\xE1ria",
  Subgrupo: "Subgrupo",
  ConsumoPonta: "Consumo Ponta (kWh)",
  ConsumoForaPonta: "Consumo Fora Ponta (kWh)",
  ConsumoTotal: "Consumo Total (kWh)",
  DemandaContratadaPonta: "Demanda Contratada Ponta (kW)",
  DemandaContratadaForaPonta: "Demanda Contratada Fora Ponta (kW)",
  DemandaMedidaPonta: "Demanda Medida Ponta (kW)",
  DemandaMedidaForaPonta: "Demanda Medida Fora Ponta (kW)",
  DemandaFaturadaPonta: "Demanda Faturada Ponta (kW)",
  DemandaFaturadaForaPonta: "Demanda Faturada Fora Ponta (kW)",
  UltrapassagemPonta: "Ultrapassagem Ponta (kW)",
  UltrapassagemForaPonta: "Ultrapassagem Fora Ponta (kW)",
  DemandaNaoConsumidaPonta: "Demanda Pot\xEAncia N\xE3o Consumida - Ponta (kW)",
  DemandaNaoConsumidaForaPonta: "Demanda Pot\xEAncia N\xE3o Consumida - Fora Ponta (kW)",
  ValorNaoConsumidaPonta: "Valor N\xE3o Consumida Ponta (R$)",
  ValorNaoConsumidaForaPonta: "Valor N\xE3o Consumida Fora Ponta (R$)",
  ReativaExcedentePonta: "Reativa Excedente Ponta (kWh)",
  ReativaExcedenteForaPonta: "Reativa Excedente Fora Ponta (kWh)",
  ValorConsumoPonta: "Valor Consumo Ponta (R$)",
  ValorConsumoForaPonta: "Valor Consumo Fora Ponta (R$)",
  ValorDemandaPonta: "Valor Demanda Ponta (R$)",
  ValorDemandaForaPonta: "Valor Demanda Fora Ponta (R$)",
  ValorUltrapassagemPonta: "Valor Ultrapassagem Ponta (R$)",
  ValorUltrapassagemForaPonta: "Valor Ultrapassagem Fora Ponta (R$)",
  ValorReativaExcedentePonta: "Valor Reativa Excedente Ponta (R$)",
  ValorReativaExcedenteForaPonta: "Valor Reativa Excedente Fora Ponta (R$)",
  PIS: "PIS (R$)",
  COFINS: "COFINS (R$)",
  ICMS: "ICMS (R$)",
  GDI: "GDI (R$)",
  CIP: "CIP (R$)",
  EnergiaReativaTotal: "Energia Reativa Total (kWh)",
  EnergiaAtvInjetadaGDIoUC_Qtd: "Energia Atv Injetada GDI oUC (kWh)",
  EnergiaAtvInjetadaGDIoUC_Valor: "Energia Atv Injetada GDI oUC (R$)",
  EnergiaAtvInjetadaGDImUC_Qtd: "Energia Atv Injetada GDI mUC (kWh)",
  EnergiaAtvInjetadaGDImUC_Valor: "Energia Atv Injetada GDI mUC (R$)",
  ValorTotal: "Valor Total (R$)"
};
var FIELD_CATEGORIES = [
  { category: "Identifica\xE7\xE3o", fields: ["UC", "Cidade", "Tipo", "Mercado", "Concessionaria"] },
  { category: "Datas e Documentos", fields: ["MesReferencia", "AnoLeitura", "Vencimento", "NotaFiscal"] },
  { category: "Tarifa", fields: ["ModalidadeTarifaria", "Subgrupo"] },
  { category: "Consumo (kWh)", fields: ["ConsumoPonta", "ConsumoForaPonta", "ConsumoTotal"] },
  { category: "Demanda Contratada (kW)", fields: ["DemandaContratadaPonta", "DemandaContratadaForaPonta"] },
  { category: "Demanda Medida (kW)", fields: ["DemandaMedidaPonta", "DemandaMedidaForaPonta"] },
  { category: "Demanda Faturada (kW)", fields: ["DemandaFaturadaPonta", "DemandaFaturadaForaPonta"] },
  { category: "Ultrapassagem (kW)", fields: ["UltrapassagemPonta", "UltrapassagemForaPonta"] },
  { category: "Demanda N\xE3o Consumida (kW)", fields: ["DemandaNaoConsumidaPonta", "DemandaNaoConsumidaForaPonta"] },
  { category: "Reativa Excedente (kWh)", fields: ["ReativaExcedentePonta", "ReativaExcedenteForaPonta", "EnergiaReativaTotal"] },
  { category: "Valores - Consumo (R$)", fields: ["ValorConsumoPonta", "ValorConsumoForaPonta"] },
  { category: "Valores - Demanda (R$)", fields: ["ValorDemandaPonta", "ValorDemandaForaPonta"] },
  { category: "Valores - Ultrapassagem (R$)", fields: ["ValorUltrapassagemPonta", "ValorUltrapassagemForaPonta"] },
  { category: "Valores - Demanda N\xE3o Consumida (R$)", fields: ["ValorNaoConsumidaPonta", "ValorNaoConsumidaForaPonta"] },
  { category: "Valores - Reativa Excedente (R$)", fields: ["ValorReativaExcedentePonta", "ValorReativaExcedenteForaPonta"] },
  { category: "Tributos e Encargos (R$)", fields: ["PIS", "COFINS", "ICMS", "GDI", "CIP"] },
  { category: "Energia Injetada GDI oUC", fields: ["EnergiaAtvInjetadaGDIoUC_Qtd", "EnergiaAtvInjetadaGDIoUC_Valor"] },
  { category: "Energia Injetada GDI mUC", fields: ["EnergiaAtvInjetadaGDImUC_Qtd", "EnergiaAtvInjetadaGDImUC_Valor"] },
  { category: "Total", fields: ["ValorTotal"] }
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FIELD_CATEGORIES,
  FIELD_LABELS,
  extractEnergisaData
});
