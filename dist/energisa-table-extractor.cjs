"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/energisa-table-extractor.ts
var energisa_table_extractor_exports = {};
__export(energisa_table_extractor_exports, {
  extractTableFromPDF: () => extractTableFromPDF
});
module.exports = __toCommonJS(energisa_table_extractor_exports);
var pdfjsLib = __toESM(require("pdfjs-dist"));
var import_path = __toESM(require("path"));
pdfjsLib.GlobalWorkerOptions.workerSrc = import_path.default.join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.mjs");
async function extractTableFromPDF(pdfBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer), disableWorker: true }).promise;
  const result = { items: [], pisTotal: "", cofinsTotal: "", icmsTotal: "" };
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const allItems = [];
    for (const item of textContent.items) {
      if (!item.str || !item.str.trim()) continue;
      allItems.push({
        str: item.str.trim(),
        x: item.transform[4],
        y: Math.round(item.transform[5])
      });
    }
    const headerItem = allItems.find((i) => /^Itens da Fatura$/i.test(i.str));
    if (!headerItem) continue;
    const tableTopY = headerItem.y;
    allItems.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    let currentRow = [];
    let currentRowY = -999;
    for (const item of allItems) {
      if (Math.abs(item.y - currentRowY) <= 1) {
        currentRow.push(item);
      } else {
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [item];
        currentRowY = item.y;
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const avgY = row.reduce((s, r) => s + r.y, 0) / row.length;
      if (avgY > tableTopY + 10) continue;
      if (avgY < tableTopY - 50) break;
      const texts = row.map((r) => r.str);
      const hasQuant = texts.some((t) => /^Quant/i.test(t));
      const hasUnid = texts.some((t) => /^Unid/i.test(t));
      if (hasQuant && hasUnid) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex < 0) continue;
    const nearbyStart = Math.max(0, headerRowIndex - 5);
    const nearbyEnd = Math.min(rows.length, headerRowIndex + 5);
    const nearbyItems = rows.slice(nearbyStart, nearbyEnd).flat();
    const headerRow = rows[headerRowIndex];
    const quantH = headerRow.find((r) => /^Quant/i.test(r.str));
    const unidH = headerRow.find((r) => /^Unid/i.test(r.str));
    const precoH = headerRow.find((r) => /Pre[cç]o/i.test(r.str)) || nearbyItems.find((r) => /Pre[cç]o/i.test(r.str));
    const valorH_full = nearbyItems.find((r) => /^Valor\s*\(R\$\)/i.test(r.str));
    const valorH_bare = headerRow.find((r) => /^Valor\s*\(R\$\)/i.test(r.str));
    const valorH_bare_safe = !valorH_full ? nearbyItems.find((r) => /^Valor$/i.test(r.str) && r.x < 420) : null;
    const valorH = valorH_full || valorH_bare || valorH_bare_safe;
    const pisH = nearbyItems.find((r) => /PIS\s*\/\s*COFINS/i.test(r.str)) || nearbyItems.find((r) => /^COFINS\s*\(R\$\)/i.test(r.str));
    const icmsBaseH = nearbyItems.find((r) => /^ICMS\s*\(R\$\)/i.test(r.str) && r.x < 420);
    const icmsCandidates = nearbyItems.filter((r) => /^ICMS$/i.test(r.str) && r.x > (icmsBaseH?.x ?? 300) && r.x < 420);
    const icmsPctH = icmsCandidates.length > 0 ? icmsCandidates.reduce((a, b) => a.x < b.x ? a : b) : null;
    const tarifaH = nearbyItems.find((r) => /(?:^Tarifa|unit\s*R\$)/i.test(r.str) && r.x < 420);
    const icmsValorH = nearbyItems.find((r) => /^\(R\$\)$/i.test(r.str) && r.x > (icmsPctH?.x ?? icmsBaseH?.x ?? 340) && r.x < (tarifaH?.x ?? 420));
    const aliqH = nearbyItems.find((r) => /^\(%\)$/i.test(r.str) && r.x < 420) || nearbyItems.find((r) => /Al[ií]q/i.test(r.str) && r.x < 420);
    const colXs = [
      quantH?.x ?? 180,
      precoH?.x ?? 205,
      valorH?.x ?? 250,
      pisH?.x ?? 280,
      icmsBaseH?.x ?? 315,
      icmsPctH?.x ?? 340,
      icmsValorH?.x ?? 365,
      tarifaH?.x ?? 400
    ].sort((a, b) => a - b);
    const midpoints = [0];
    for (let i = 0; i < colXs.length - 1; i++) {
      midpoints.push((colXs[i] + colXs[i + 1]) / 2);
    }
    midpoints.push(999);
    const getRange = (headerX, fallbackIdx) => {
      if (!headerX) return { min: 0, max: 999 };
      const idx = colXs.indexOf(headerX);
      return { min: midpoints[idx], max: midpoints[idx + 1] };
    };
    const colRanges = {
      label: { min: 0, max: (unidH || quantH).x - 10 },
      unidade: { min: (unidH?.x ?? 140) - 10, max: (unidH?.x ?? 140) + 25 },
      quantidade: { min: (quantH?.x ?? 180) - 10, max: getRange(precoH?.x, 1).max },
      precoUnit: { min: getRange(precoH?.x, 1).min, max: getRange(valorH?.x, 2).max },
      valor: { min: getRange(valorH?.x, 2).min, max: getRange(pisH?.x, 3).max },
      pisCofins: { min: getRange(pisH?.x, 3).min, max: getRange(icmsBaseH?.x, 4).max },
      baseCalc: { min: getRange(icmsBaseH?.x, 4).min, max: getRange(icmsPctH?.x, 5).max },
      aliquota: { min: getRange(icmsPctH?.x, 5).min, max: getRange(icmsValorH?.x, 6).max },
      icms: { min: getRange(icmsValorH?.x, 6).min, max: getRange(tarifaH?.x, 7).max },
      tarifa: { min: getRange(tarifaH?.x, 7).min, max: 999 }
    };
    let totalRowIndex = rows.length;
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      if (rows[i].some((r) => /^TOTAL:\s*$/i.test(r.str))) {
        totalRowIndex = i;
        break;
      }
    }
    for (let i = headerRowIndex + 1; i < totalRowIndex; i++) {
      const row = rows[i].sort((a, b) => a.x - b.x);
      const joinedText = row.map((r) => r.str).join(" ");
      if (/^(PIS|COFINS|ICMS)$/.test(joinedText.trim())) continue;
      if (/^(LIGA[ÇC]|Classifica[çc][aã]o|TENSÃO|ÁGUA|SERVI[ÇC]O P[ÚU]B|EMPRESA DE|SANESUL|CENTRO|ITAQUIRAI|CNPJ|Insc|DOM\.?|SEGUNDA|Rua |AV |GRUPO|CONJ|NOM|END|BAIRRO|CEP|Refer[eê]ncia|Conjunto|Tensão|Limite)/i.test(joinedText.trim())) continue;
      const labelItem = row.find((r) => r.x < colRanges.label.max && r.str.length > 4 && /[a-zA-Z]/.test(r.str));
      const label = labelItem ? labelItem.str : "";
      if (!label) continue;
      const getValue = (col, requireDigit = true) => {
        const match = row.find((r) => r.x >= col.min && r.x < col.max && (requireDigit ? /\d/.test(r.str) : true));
        return match ? match.str : "";
      };
      const tableRow = {
        label,
        unidade: getValue(colRanges.unidade, false),
        quantidade: getValue(colRanges.quantidade),
        precoUnit: getValue(colRanges.precoUnit),
        valor: getValue(colRanges.valor),
        pisCofins: getValue(colRanges.pisCofins),
        baseCalcICMS: getValue(colRanges.baseCalc),
        aliquotaICMS: getValue(colRanges.aliquota),
        icms: getValue(colRanges.icms),
        tarifa: getValue(colRanges.tarifa)
      };
      if (tableRow.quantidade || tableRow.valor) {
        result.items.push(tableRow);
      }
    }
    for (let i = headerRowIndex + 1; i < totalRowIndex; i++) {
      const row = rows[i];
      for (const item of row) {
        if (/^PIS$/i.test(item.str)) {
          const rowItems = [...row].sort((a, b) => a.x - b.x);
          const vals = rowItems.filter((r) => r.x > 400 && /^\d[\d.]*,\d{2}$/.test(r.str)).map((r) => r.str);
          if (vals.length >= 1) {
            result.pisTotal = vals[vals.length - 1];
          }
        }
        if (/^COFINS$/i.test(item.str)) {
          const nextRow = i + 1 < totalRowIndex ? rows[i + 1] : [];
          const combined = [...row, ...nextRow].sort((a, b) => a.x - b.x);
          const vals = combined.filter((r) => r.x > 400 && /^\d[\d.]*,\d{2}$/.test(r.str)).map((r) => r.str);
          if (vals.length >= 1) {
            result.cofinsTotal = vals[vals.length - 1];
          }
        }
        if (/^ICMS$/i.test(item.str) && item.x > 400) {
          const rowItems = [...row].sort((a, b) => a.x - b.x);
          const vals = rowItems.filter((r) => r.x > 400 && /^\d[\d.]*,\d{2}$/.test(r.str)).map((r) => r.str);
          if (vals.length >= 1) {
            result.icmsTotal = vals[vals.length - 1];
          }
        }
      }
    }
    if (result.items.length > 0) break;
  }
  pdf.destroy();
  return result.items.length > 0 ? result : null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  extractTableFromPDF
});
