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
function formatBR(n) {
  if (n === 0) return "0,00";
  const neg = n < 0;
  const abs = Math.abs(n);
  const rounded = Math.round(abs * 100) / 100;
  const parts = rounded.toFixed(2).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const result = intPart + "," + parts[1];
  return neg ? "-" + result : result;
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
function findIntNearLine(lines, startIdx, direction, maxDist) {
  for (let i = startIdx + direction; i >= 0 && i < lines.length; i += direction) {
    if (Math.abs(i - startIdx) > maxDist) break;
    const line = lines[i];
    const m = line.match(/^(\d{1,2}(?:\.\d{3})+|\d{3,6})$/);
    if (m) return m[1];
  }
  return EMPTY;
}
function extractEnergisaData(rawText, tableExtraction) {
  const tableData = tableExtraction?.items;
  const tributosFromTable = tableExtraction ? { pis: tableExtraction.pisTotal, cofins: tableExtraction.cofinsTotal, icms: tableExtraction.icmsTotal } : null;
  const lines = rawText.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l.length > 0);
  const flat = lines.join(" ");
  const Concessionaria = (() => {
    const u = flat.toUpperCase();
    const isEnergyInvoice = /DANF3E|ENERGIA\s*EL[eÉ]TRICA|DISTR\.\s*DE\s*ENERGIA/i.test(u);
    if (isEnergyInvoice) {
      if (/ELEKTRO/i.test(u)) return "ELEKTRO";
      if (/NEOENERGIA/i.test(u)) return "NEOENERGIA";
      if (/ENERGISA/i.test(u)) return "ENERGISA";
    }
    if (/SANESUL/i.test(u)) return "SANESUL";
    if (/ELEKTRO/i.test(u)) return "ELEKTRO";
    if (/NEOENERGIA/i.test(u)) return "NEOENERGIA";
    if (/ENERGISA/i.test(u)) return "ENERGISA";
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
    const isCnpjCpf = (s) => {
      const raw = s.replace(/[.\-\/]/g, "");
      return raw.length === 14 || raw.length === 11;
    };
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
      const m = line.match(/^(\d{1,2}\.\d{3}\.\d{3}\.\d{3}-\d{1,2})$/);
      if (m && !isCnpjCpf(m[1])) return m[1];
    }
    for (const line of lines) {
      const m = line.match(/^(\d{1,3}\.\d{3}\.\d{3}-\d{2})$/);
      if (m) return m[1];
    }
    for (const line of lines) {
      const m = line.match(/(\d{1,2}\.\d{3}\.\d{3}\.\d{3}-\d{1,2})/);
      if (m && line.length < 50 && !/CNPJ|CPF|CEP/i.test(line) && !isCnpjCpf(m[1])) return m[1];
    }
    for (const line of lines) {
      const m = line.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
      if (m && line.length < 40 && !/CNPJ|CPF|CEP/i.test(line)) return m[1];
    }
    const ucMat = flat.match(/MATR[IÍ]CULA\s*:\s*0*(\d{4,13})(?:-\d{4}-\d{2}-\d)?/i);
    if (ucMat) return ucMat[1];
    const ucAddr = flat.match(/(?:RUA|AV|ESTRADA)[^\d]*(\d{10,13})\b/);
    if (ucAddr) return ucAddr[1];
    const ucInst = flat.match(/Instalação\s*:?\s*(\d{7,13})/i);
    if (ucInst) return ucInst[1];
    const ucLabel = flat.match(/(?:UC\s*:?|Unid\.?\s*Cons\.?)[^\d]*(\d{4,13})/i);
    if (ucLabel) return ucLabel[1].replace(/^0+/, "") || ucLabel[1];
    const broad4 = flat.match(/(\d{1,2}\.\d{3}\.\d{3}\.\d{3}-\d{1,2})/);
    if (broad4 && !isCnpjCpf(broad4[1])) return broad4[1];
    const broad3 = flat.match(/(\d{1,3}\.\d{3}\.\d{3}-\d{2})/);
    if (broad3) return broad3[1];
    const bareLong = flat.match(/\b(\d{10,13})\b/);
    if (bareLong && !isCnpjCpf(bareLong[1])) return bareLong[1];
    return EMPTY;
  })();
  const cleanUC = UC.replace(/[.\-]/g, "");
  const Endereco = (() => {
    const STREET_RE = /^(RUA|AV[. ]|AVE |AVENIDA|ESTRADA|LOT |RODOVIA|TRAVESSA|ALAMEDA|PCA[. ]|PRACA)/i;
    const extractCleanAddress = (line) => {
      const beforeCodes = line.split(/\s*-\s*\d{2}\.\d{3}/)[0];
      let addr = (beforeCodes || line).trim();
      addr = addr.replace(/\s*-\s*$/, "").trim();
      const cepMatch = line.match(/(\d{5}-?\d{3})\s*$/);
      if (cepMatch) addr += " - CEP " + cepMatch[1];
      return addr;
    };
    for (let i = 0; i < Math.min(60, lines.length); i++) {
      if (/\(\s*AG\s*:\s*\d+\s*\)/.test(lines[i])) {
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          if (STREET_RE.test(lines[j])) {
            return extractCleanAddress(lines[j]);
          }
        }
      }
    }
    for (let i = 0; i < lines.length; i++) {
      if (/CNPJ\/CPF/i.test(lines[i]) && i > 0) {
        if (STREET_RE.test(lines[i - 1])) {
          return extractCleanAddress(lines[i - 1]);
        }
      }
    }
    for (let i = 0; i < lines.length; i++) {
      if (/^ENDERE[ÇC]O$/i.test(lines[i].trim()) && i + 1 < lines.length) {
        const next = lines[i + 1];
        const cleanAddr = next.replace(/\s*-\s*(SA[IÍ]DA|ENTRADA)\s+PARA\s+[^-]+/i, "").replace(/\s*-\s*[A-ZÀ-Ú]+\s*\/\s*[A-Z]{2}\s*-\s*CEP\s+\d{5}-\d{3}/i, "").trim();
        if (cleanAddr.length > 5) return cleanAddr;
      }
    }
    return EMPTY;
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
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const venMoneyMatch = flat.match(/(\d{2})\/(\d{2})\/(\d{4})\s*R\$/);
    const venMonth = venMoneyMatch ? parseInt(venMoneyMatch[2], 10) : 0;
    const venYear = venMoneyMatch ? parseInt(venMoneyMatch[3], 10) : 0;
    const isConsistentWithVencimento = (month, year) => {
      if (!venMonth || !venYear) return true;
      const venTotal = venYear * 12 + venMonth;
      const refTotal = year * 12 + month;
      const diff = venTotal - refTotal;
      return diff >= 1 && diff <= 3;
    };
    for (const line of lines) {
      const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})\\s*\\d{2}/\\d{2}/\\d{4}\\s*R\\$`, "i"));
      if (m) return `${capitalize(m[1])} / ${m[2]}`;
    }
    for (const line of lines) {
      const m = line.match(new RegExp(`\\d{2}/\\d{2}/\\d{4}\\s*R\\$\\s*[\\d.,]+\\s*(${meses})\\s*/\\s*(\\d{4})`, "i"));
      if (m) return `${capitalize(m[1])} / ${m[2]}`;
    }
    for (const line of lines) {
      if (/VENCIMENTO|NOTA FISCAL|Nº FATURA/i.test(line)) {
        const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, "i"));
        if (m) return `${capitalize(m[1])} / ${m[2]}`;
      }
    }
    for (const line of lines) {
      const m = line.match(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, "i"));
      if (m && /\d{2}\/\d{2}\/\d{4}/.test(line)) {
        const monthIdx = Object.values(numToMonth).indexOf(capitalize(m[1]));
        const monthNum = monthIdx + 1;
        if (isConsistentWithVencimento(monthNum, parseInt(m[2], 10))) {
          return `${capitalize(m[1])} / ${m[2]}`;
        }
      }
    }
    const allNameMatches = [...flat.matchAll(new RegExp(`(${meses})\\s*/\\s*(\\d{4})`, "gi"))];
    for (const m of allNameMatches) {
      const start = Math.max(0, m.index - 20);
      const context = flat.slice(start, m.index + m[0].length).toLowerCase();
      if (/desde|até|a partir|inform|dispon|referência|ref\b/.test(context)) continue;
      const monthIdx = Object.values(numToMonth).indexOf(capitalize(m[1]));
      const monthNum = monthIdx + 1;
      if (!isConsistentWithVencimento(monthNum, parseInt(m[2], 10))) continue;
      return `${capitalize(m[1])} / ${m[2]}`;
    }
    const leituraPatterns = [
      /Leitura\s+Atual\s*:\s*\d{2}\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i,
      /Leitura\s+Atual\s*:?\s*\d{2,4}\/?\s*(\d{2})\s*\/\s*(\d{4})/i
    ];
    for (const pat of leituraPatterns) {
      const lm = flat.match(pat);
      if (lm && numToMonth[lm[1]]) {
        const monthNum = parseInt(lm[1], 10);
        const year = parseInt(lm[2], 10);
        if (isConsistentWithVencimento(monthNum, year)) {
          return `${numToMonth[lm[1]]} / ${lm[2]}`;
        }
      }
    }
    if (venMoneyMatch) {
      const venIdx = flat.indexOf(venMoneyMatch[0]);
      const region = flat.slice(Math.max(0, venIdx - 150), venIdx + 50);
      const numMatches = [...region.matchAll(/(\d{2})\s*\/\s*(\d{4})/g)];
      for (const nm of numMatches) {
        if (numToMonth[nm[1]]) {
          const monthNum = parseInt(nm[1], 10);
          const year = parseInt(nm[2], 10);
          if (isConsistentWithVencimento(monthNum, year)) {
            return `${numToMonth[nm[1]]} / ${nm[2]}`;
          }
        }
      }
    }
    const allNumMatches = [...flat.matchAll(/(\d{2})\s*[\/]\s*(\d{4})/g)];
    for (const nm of allNumMatches) {
      if (numToMonth[nm[1]]) {
        const monthNum = parseInt(nm[1], 10);
        const year = parseInt(nm[2], 10);
        if (isConsistentWithVencimento(monthNum, year)) {
          return `${numToMonth[nm[1]]} / ${nm[2]}`;
        }
      }
    }
    return EMPTY;
  })();
  const AnoLeitura = (() => {
    const leituraYearPatterns = [
      /Leitura\s+Atual\s*:\s*\d{2}\s*\/\s*\d{2}\s*\/\s*(\d{4})/i,
      /Leitura\s+Atual\s*:?\s*\d{2,4}\/?\s*\d{2}\s*\/\s*(\d{4})/i
    ];
    for (const pat of leituraYearPatterns) {
      const m = flat.match(pat);
      if (m) return m[1];
    }
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
  const isSplitTariff = /AZUL|VERDE/i.test(flat) && !/CONVENCIONAL/i.test(flat) || /Consumo\s+em\s+kWh\s*-\s*Intermedi/i.test(flat);
  let ConsumoPonta = EMPTY;
  let ConsumoIntermediaria = EMPTY;
  let ConsumoForaPonta = EMPTY;
  let ConsumoTotal = EMPTY;
  let ConsumoGrupoB_kWh = EMPTY;
  let ConsumoGrupoB_Valor = EMPTY;
  let ValorConsumoPonta = EMPTY;
  let ValorConsumoIntermediaria = EMPTY;
  let ValorConsumoForaPonta = EMPTY;
  let grupoB_consumoKWh_total = 0;
  let grupoB_consumoValor_total = 0;
  if (isSplitTariff) {
    for (const line of lines) {
      const km = line.match(/^KWH(\d{1,2}(?:\.\d{3})*,\d{2})$/i);
      if (km) {
        ConsumoPonta = km[1];
        break;
      }
    }
    if (!ConsumoPonta || !ConsumoForaPonta) {
      const periodSections = [];
      for (let i = 0; i < lines.length - 2; i++) {
        if (/Ponta$/i.test(lines[i]) && !/Fora/i.test(lines[i]) && /^Energia\s+ativa\s+em\s+kWh$/i.test(lines[i + 1])) {
          periodSections.push({ period: "Ponta", data: lines[i + 2] });
        }
        if (/Fora\s*Ponta$/i.test(lines[i]) && /^Energia\s+ativa\s+em\s+kWh$/i.test(lines[i + 1])) {
          periodSections.push({ period: "ForaPonta", data: lines[i + 2] });
        }
      }
      const pontaSection = periodSections.find((s) => s.period === "Ponta");
      const foraSection = periodSections.find((s) => s.period === "ForaPonta");
      if (pontaSection && ConsumoPonta) {
        const pontaNoDot = ConsumoPonta.replace(/\./g, "");
        const prefixIdx = pontaSection.data.indexOf(pontaNoDot);
        if (prefixIdx >= 0) {
          const prefixLen = prefixIdx;
          if (foraSection && prefixLen < foraSection.data.length) {
            const foraRest = foraSection.data.substring(prefixLen);
            const commaPos = foraRest.indexOf(",");
            if (commaPos >= 2 && commaPos <= 7) {
              const foraNum = foraRest.substring(0, commaPos + 3);
              const parts = foraNum.split(",");
              const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
              if (!ConsumoForaPonta) ConsumoForaPonta = intPart + "," + parts[1];
            }
          }
        }
      }
      if (!ConsumoPonta && periodSections.length >= 1) {
        const tryExtract = (data, prefix) => {
          if (prefix >= data.length) return null;
          const rest = data.substring(prefix);
          const commaPos = rest.indexOf(",");
          if (commaPos < 1 || commaPos > 6) return null;
          const numStr = rest.substring(0, commaPos + 3);
          const parts = numStr.split(",");
          if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d{2}$/.test(parts[1])) return null;
          const numeric = parseInt(parts[0]);
          if (numeric < 10 || numeric > 999999) return null;
          const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          return { value: intPart + "," + parts[1], numeric };
        };
        let found = false;
        const prefixCandidates = [];
        for (let prefix = 0; prefix <= 3; prefix++) {
          const results = /* @__PURE__ */ new Map();
          let allValid = true;
          for (const sec of periodSections) {
            const result = tryExtract(sec.data, prefix);
            if (!result) {
              allValid = false;
              break;
            }
            if (result.numeric < 100) {
              allValid = false;
              break;
            }
            if (result.value.startsWith("0") && result.value.length > 3) {
              allValid = false;
              break;
            }
            results.set(sec.period, result);
          }
          if (allValid && results.size > 0) {
            const pontaR = results.get("Ponta");
            const foraR = results.get("ForaPonta");
            if (pontaR && foraR) {
              const ratio = foraR.numeric / pontaR.numeric;
              if (ratio < 0.1 || ratio > 20) continue;
              const inRangePonta = pontaR.numeric >= 100 && pontaR.numeric <= 5e4 ? 2e3 : 0;
              const inRangeFora = foraR.numeric >= 100 && foraR.numeric <= 5e4 ? 2e3 : 0;
              const ratioScore = ratio >= 1 && ratio <= 15 ? 1e3 : 0;
              const rangeScore = inRangePonta + inRangeFora + ratioScore;
              prefixCandidates.push({ prefix, results, score: rangeScore });
            } else {
              let rangeScore = 0;
              for (const r of results.values()) {
                if (r.numeric >= 100 && r.numeric <= 5e4) rangeScore += 2e3;
              }
              prefixCandidates.push({ prefix, results, score: rangeScore });
            }
          }
        }
        prefixCandidates.sort((a, b) => b.score - a.score);
        if (prefixCandidates.length > 0) {
          const best = prefixCandidates[0];
          if (!ConsumoPonta && best.results.has("Ponta")) ConsumoPonta = best.results.get("Ponta").value;
          if (!ConsumoForaPonta && best.results.has("ForaPonta")) ConsumoForaPonta = best.results.get("ForaPonta").value;
          found = true;
        }
        if (!found) {
          for (const sec of periodSections) {
            for (let prefix = 0; prefix <= 3; prefix++) {
              const result = tryExtract(sec.data, prefix);
              if (result && result.numeric >= 100) {
                if (sec.period === "Ponta" && !ConsumoPonta) ConsumoPonta = result.value;
                if (sec.period === "ForaPonta" && !ConsumoForaPonta) ConsumoForaPonta = result.value;
                break;
              }
            }
          }
        }
      }
    }
    if (!ConsumoPonta) {
      const pontaIdx = findLine(lines, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)/i);
      if (pontaIdx >= 0) {
        const val = findNumNearLine(lines, pontaIdx, 1, 8, false);
        if (val && parseBR(val) >= 10) ConsumoPonta = val;
      }
    }
    if (!ConsumoForaPonta) {
      const fpIdx = findLine(lines, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
      if (fpIdx >= 0) {
        const val = findNumNearLine(lines, fpIdx, 1, 8, false);
        if (val && parseBR(val) >= 10) ConsumoForaPonta = val;
      }
    }
    if (!ConsumoPonta) {
      const pontaIdx = findLine(lines, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)/i);
      if (pontaIdx >= 0) {
        const val = findIntNearLine(lines, pontaIdx, 1, 8);
        if (val && parseBR(val) >= 10) ConsumoPonta = val;
      }
    }
    if (!ConsumoForaPonta) {
      const fpIdx = findLine(lines, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
      if (fpIdx >= 0) {
        const val = findIntNearLine(lines, fpIdx, 1, 8);
        if (val && parseBR(val) >= 10) ConsumoForaPonta = val;
      }
    }
    if (!ConsumoPonta || !ConsumoForaPonta) {
      for (const line of lines) {
        const garbledPonta = line.match(/^(\d{1,2}(?:\.\d{3})+)KWH/i);
        if (garbledPonta && parseBR(garbledPonta[1]) >= 10) {
          if (!ConsumoPonta) ConsumoPonta = garbledPonta[1];
          continue;
        }
        const garbledFora = line.match(/^(\d{1,2}(?:\.\d{3})+)KWH/i);
        if (garbledFora && parseBR(garbledFora[1]) >= 10) {
          if (ConsumoPonta && !ConsumoForaPonta) ConsumoForaPonta = garbledFora[1];
        }
      }
    }
    if ((!ConsumoPonta || !ConsumoForaPonta) && isSplitTariff) {
      const itensIdx = lines.findIndex((l) => /Itens\s+da\s+Fatura/i.test(l));
      if (itensIdx >= 0) {
        const consumptionCandidates = [];
        for (let i = itensIdx + 1; i < Math.min(itensIdx + 30, lines.length); i++) {
          const m = lines[i].match(/^(\d{1,2}(?:\.\d{3})+|\d{3,6})KWH/i);
          if (m && parseBR(m[1]) >= 10) {
            consumptionCandidates.push(m[1]);
          }
        }
        if (consumptionCandidates.length >= 2) {
          if (!ConsumoPonta) ConsumoPonta = consumptionCandidates[0];
          if (!ConsumoForaPonta) ConsumoForaPonta = consumptionCandidates[1];
        } else if (consumptionCandidates.length === 1) {
          if (ConsumoPonta && !ConsumoForaPonta) ConsumoForaPonta = consumptionCandidates[0];
          else if (!ConsumoPonta) ConsumoPonta = consumptionCandidates[0];
        }
      }
    }
    const interIdx = findLine(lines, /Consumo\s+em\s+kWh.*Intermedi[áa]ria/i);
    if (interIdx >= 0) ConsumoIntermediaria = findNumNearLine(lines, interIdx, 1, 8, false);
    ValorConsumoPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Ponta(?!.*Fora)(?!.*Intermedi)/i);
    ValorConsumoIntermediaria = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Intermedi[áa]ria/i);
    ValorConsumoForaPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh.*Fora\s*Ponta/i);
  } else {
    for (const line of lines) {
      const km = line.match(/^KWH\s+([\d.,]+)$/i);
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
    if (!ConsumoTotal) {
      for (let i = 0; i < lines.length - 3; i++) {
        if (/^CONSUMO\s+(TE|TUSD)$/i.test(lines[i])) {
          const afterLabels = lines.slice(i + 1, Math.min(i + 15, lines.length));
          for (const al of afterLabels) {
            if (/^(kWh|kW)$/i.test(al)) continue;
            const m = al.match(/^(\d{1,2}\.\d{3}|\d{3,6})$/);
            if (m) {
              ConsumoTotal = m[1];
              break;
            }
          }
          if (ConsumoTotal) break;
        }
      }
    }
    if (!ConsumoTotal && isSplitTariff) {
      const consumoKwhIdx = findLine(lines, /^Consumo\s+kWh$/i);
      if (consumoKwhIdx >= 0) {
        const calcIdx = lines.slice(consumoKwhIdx).findIndex((l) => /C[aá]lc\.\(R\$\)/i.test(l));
        if (calcIdx >= 0) {
          const afterCalc = lines.slice(consumoKwhIdx + calcIdx + 1, Math.min(consumoKwhIdx + calcIdx + 15, lines.length));
          const consumptionValues = [];
          for (const line of afterCalc) {
            const m = line.match(/^(\d{1,3}(?:\.\d{3})*,\d{2})$/);
            if (m) {
              const num = parseBR(m[1]);
              if (num >= 1 && num <= 2e5) {
                consumptionValues.push(m[1]);
                if (consumptionValues.length >= 3) break;
              }
            }
          }
          if (consumptionValues.length >= 2) {
            if (!ConsumoPonta) ConsumoPonta = consumptionValues[0];
            if (consumptionValues.length >= 3) {
              if (!ConsumoIntermediaria) ConsumoIntermediaria = consumptionValues[1];
              if (!ConsumoForaPonta) ConsumoForaPonta = consumptionValues[2];
            } else {
              if (!ConsumoForaPonta) ConsumoForaPonta = consumptionValues[1];
            }
          }
        }
      }
    }
    if (!ConsumoTotal) {
      for (const line of lines) {
        const pontaMatch = line.match(/^(?:KWH)?Ponta([\d.,]+)/);
        if (pontaMatch) {
          const nums = [];
          const pontaIdx = line.indexOf("Ponta");
          const rest = line.substring(pontaIdx + 5);
          const numRegex = /(\d{1,2}(?:\.\d{3})*,\d{2})/g;
          let nm;
          while ((nm = numRegex.exec(rest)) !== null) {
            nums.push(nm[1]);
          }
          if (nums.length >= 2) {
            if (line.startsWith("KWH")) {
              ConsumoTotal = nums[0];
            } else {
              ConsumoTotal = nums[nums.length - 2];
            }
          } else if (nums.length === 1) {
            ConsumoTotal = nums[0];
          }
          break;
        }
      }
    }
    if (!ConsumoTotal) {
      const kwhValues = [];
      let pontaKwhFromLabel = "";
      for (const line of lines) {
        const km = line.match(/^KWH(\d{1,2}(?:\.\d{3})*,\d{2})$/i);
        if (km) {
          kwhValues.push(km[1]);
          pontaKwhFromLabel = km[1];
        }
      }
      const periodSections = [];
      for (let i = 0; i < lines.length - 2; i++) {
        if (/Ponta$/i.test(lines[i]) && !/Fora/i.test(lines[i]) && /^Energia\s+ativa\s+em\s+kWh$/i.test(lines[i + 1])) {
          periodSections.push({ period: "Ponta", data: lines[i + 2] });
        }
        if (/Fora\s*Ponta$/i.test(lines[i]) && /^Energia\s+ativa\s+em\s+kWh$/i.test(lines[i + 1])) {
          periodSections.push({ period: "ForaPonta", data: lines[i + 2] });
        }
      }
      if (pontaKwhFromLabel && periodSections.length >= 1) {
        const pontaSection = periodSections.find((s) => s.period === "Ponta");
        const foraSection = periodSections.find((s) => s.period === "ForaPonta");
        if (pontaSection) {
          const pontaNoDot = pontaKwhFromLabel.replace(/\./g, "");
          const prefixIdx = pontaSection.data.indexOf(pontaNoDot);
          if (prefixIdx >= 0) {
            const prefixLen = prefixIdx;
            if (foraSection && prefixLen < foraSection.data.length) {
              const foraRest = foraSection.data.substring(prefixLen);
              const commaPos = foraRest.indexOf(",");
              if (commaPos >= 2 && commaPos <= 7) {
                const foraNum = foraRest.substring(0, commaPos + 3);
                const parts = foraNum.split(",");
                const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                const foraBR = intPart + "," + parts[1];
                if (!kwhValues.includes(foraBR)) kwhValues.push(foraBR);
              }
            }
          }
        }
      }
      if (kwhValues.length === 0) {
        for (let i = 0; i < lines.length - 1; i++) {
          if (/^Energia\s+ativa\s+em\s+kWh$/i.test(lines[i])) {
            const nextLine = lines[i + 1];
            for (let prefix = 0; prefix < Math.min(4, nextLine.length); prefix++) {
              const rest = nextLine.substring(prefix);
              const commaPos = rest.indexOf(",");
              if (commaPos >= 1 && commaPos <= 6) {
                const numStr = rest.substring(0, commaPos + 3);
                const parts = numStr.split(",");
                if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d{2}$/.test(parts[1])) {
                  const val = parseInt(parts[0]);
                  if (val >= 10 && val <= 999999) {
                    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                    const brNum = intPart + "," + parts[1];
                    if (!kwhValues.includes(brNum)) kwhValues.push(brNum);
                    break;
                  }
                }
              }
            }
          }
        }
      }
      if (kwhValues.length > 0) {
        let totalKwh = 0;
        for (const v of kwhValues) {
          totalKwh += parseBR(v);
        }
        if (totalKwh > 0) ConsumoTotal = formatBR(totalKwh);
      }
    }
    ValorConsumoForaPonta = findRValueNearLine(lines, flat, /Consumo\s+em\s+kWh(?!.*Ponta)/i);
  }
  if (!ConsumoTotal && (ConsumoPonta || ConsumoForaPonta || ConsumoIntermediaria)) {
    const p = ConsumoPonta ? parseBR(ConsumoPonta) : 0;
    const f = ConsumoForaPonta ? parseBR(ConsumoForaPonta) : 0;
    const it = ConsumoIntermediaria ? parseBR(ConsumoIntermediaria) : 0;
    const total = p + f + it;
    if (total > 0) ConsumoTotal = formatBR(total);
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
    const dpSameLine = flat.match(/Demanda\s+ponta\s*-\s*kW\s+(\d+(?:[.,]\d+)?)/i);
    const dfpSameLine = flat.match(/Demanda\s+fora\s+ponta\s*-\s*kW\s+(\d+(?:[.,]\d+)?)/i);
    if (dpSameLine && dfpSameLine) {
      DemandaContratadaPonta = dpSameLine[1].replace(".", ",");
      DemandaContratadaForaPonta = dfpSameLine[1].replace(".", ",");
    }
    if (!DemandaContratadaPonta || !DemandaContratadaForaPonta) {
      const foraIdx = flat.search(/Fora\s+Ponta\s*:/i);
      const kwIdx = flat.search(/KW\s+Ponta\s*:/i);
      if (foraIdx >= 0 && kwIdx >= 0 && foraIdx < kwIdx) {
        const between = flat.slice(foraIdx, kwIdx);
        const betweenMatch = between.match(/:\s*(\d+(?:[.,]\d+)?)/);
        if (betweenMatch && !DemandaContratadaPonta) {
          DemandaContratadaPonta = betweenMatch[1].replace(".", ",");
        }
        const before = flat.slice(Math.max(0, foraIdx - 25), foraIdx);
        const beforeMatch = before.match(/(\d+(?:[.,]\d+)?)\s*$/);
        if (beforeMatch && !DemandaContratadaForaPonta) {
          DemandaContratadaForaPonta = beforeMatch[1].replace(".", ",");
        }
      } else if (kwIdx >= 0 && foraIdx >= 0 && kwIdx < foraIdx) {
        const kwAfter = flat.slice(kwIdx).match(/KW\s+Ponta\s*:\s*(\d+(?:[.,]\d+)?)/i);
        const fpAfter = flat.slice(foraIdx).match(/Fora\s+Ponta\s*:\s*(\d+(?:[.,]\d+)?)/i);
        if (kwAfter && !DemandaContratadaPonta) DemandaContratadaPonta = kwAfter[1].replace(".", ",");
        if (fpAfter && !DemandaContratadaForaPonta) DemandaContratadaForaPonta = fpAfter[1].replace(".", ",");
      }
    }
    if (!DemandaContratadaPonta || !DemandaContratadaForaPonta) {
      const dpLineIdx = lines.findIndex((l) => /Demanda\s+ponta\s*-\s*kW/i.test(l));
      const dfpLineIdx = lines.findIndex((l) => /Demanda\s+fora\s+ponta\s*-\s*kW/i.test(l));
      if (dpLineIdx >= 0 && dfpLineIdx >= 0) {
        const startLine = Math.max(dpLineIdx, dfpLineIdx) + 1;
        const numVal = /^(\d+(?:[.,]\d+)?)$/;
        const values = [];
        for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
          const m = lines[i].match(numVal);
          if (m) values.push(m[1].replace(".", ","));
          if (values.length >= 2) break;
        }
        if (values.length === 2) {
          if (DemandaContratadaForaPonta && !DemandaContratadaPonta) {
            if (values[0] === DemandaContratadaForaPonta) DemandaContratadaPonta = values[1];
            else if (values[1] === DemandaContratadaForaPonta) DemandaContratadaPonta = values[0];
          } else if (DemandaContratadaPonta && !DemandaContratadaForaPonta) {
            if (values[0] === DemandaContratadaPonta) DemandaContratadaForaPonta = values[1];
            else if (values[1] === DemandaContratadaPonta) DemandaContratadaForaPonta = values[0];
          } else {
            if (!DemandaContratadaForaPonta) DemandaContratadaForaPonta = values[0];
            if (!DemandaContratadaPonta) DemandaContratadaPonta = values[1];
          }
        }
      }
    }
    if (!DemandaContratadaPonta || !DemandaContratadaForaPonta) {
      const todosMatch = flat.match(/Demanda\s+Todos\s+(?:os\s+)?Per[ií]odo\s*-\s*kW\s+(\d+(?:[.,]\d+)?)/i);
      if (todosMatch) {
        const val = todosMatch[1].replace(".", ",");
        if (!DemandaContratadaPonta) DemandaContratadaPonta = val;
        if (!DemandaContratadaForaPonta) DemandaContratadaForaPonta = val;
      }
    }
    const isVerde = /VERDE/i.test(ModalidadeTarifaria);
    if (isVerde) {
      if (DemandaContratadaForaPonta && !DemandaContratadaPonta) {
        DemandaContratadaPonta = DemandaContratadaForaPonta;
      } else if (DemandaContratadaPonta && !DemandaContratadaForaPonta) {
        DemandaContratadaForaPonta = DemandaContratadaPonta;
      }
    }
    if (!DemandaContratadaPonta && !DemandaContratadaForaPonta) {
      const dpLineIdx = lines.findIndex((l) => /Demanda\s+ponta\s*-\s*kW/i.test(l));
      const dfpLineIdx = lines.findIndex((l) => /Demanda\s+fora\s+ponta\s*-\s*kW/i.test(l));
      if (dpLineIdx >= 0 && dfpLineIdx >= 0) {
        const start = Math.min(dpLineIdx, dfpLineIdx) + 1;
        const end = Math.max(dpLineIdx, dfpLineIdx);
        for (let i = start; i < end; i++) {
          const m = lines[i].match(/^(\d+(?:[.,]\d+)?)$/);
          if (m) {
            const val = m[1].replace(".", ",");
            DemandaContratadaPonta = val;
            DemandaContratadaForaPonta = val;
            break;
          }
        }
      }
    }
    if (!DemandaContratadaPonta && !DemandaContratadaForaPonta) {
      const todosLineIdx = lines.findIndex((l) => /Demanda\s+Todos/i.test(l) && /Per[ií]odo/i.test(l));
      if (todosLineIdx >= 0) {
        const sameLine = lines[todosLineIdx].match(/(\d+(?:[.,]\d+)?)\s*$/);
        if (sameLine) {
          const val = sameLine[1].replace(".", ",");
          DemandaContratadaPonta = val;
          DemandaContratadaForaPonta = val;
        } else {
          for (let i = todosLineIdx + 1; i < Math.min(todosLineIdx + 4, lines.length); i++) {
            const m = lines[i].match(/^(\d+(?:[.,]\d+)?)$/);
            if (m) {
              const val = m[1].replace(".", ",");
              DemandaContratadaPonta = val;
              DemandaContratadaForaPonta = val;
              break;
            }
          }
        }
      }
    }
    if (!DemandaContratadaPonta && !DemandaContratadaForaPonta) {
      const preValMatch = flat.match(/(\d+(?:[.,]\d+)?)\s*Demanda\s+Todos\s+(?:os\s+)?Per[ií]odo/i);
      if (preValMatch) {
        const val = preValMatch[1].replace(".", ",");
        DemandaContratadaPonta = val;
        DemandaContratadaForaPonta = val;
      }
    }
    if (!DemandaContratadaPonta && !DemandaContratadaForaPonta) {
      const grandIdx = lines.findIndex((l) => /Grandezas\s+Contratadas/i.test(l));
      if (grandIdx >= 0) {
        for (let i = grandIdx + 1; i < Math.min(grandIdx + 8, lines.length); i++) {
          const m = lines[i].match(/Demanda\s+Todos\s+(?:os\s+)?Per[ií]odo\s*-\s*kW\s+(\d+(?:[.,]\d+)?)/i);
          if (m) {
            const val = m[1].replace(".", ",");
            DemandaContratadaPonta = val;
            DemandaContratadaForaPonta = val;
            break;
          }
          if (/Demanda\s+Todos/i.test(lines[i]) && /Per[ií]odo/i.test(lines[i])) {
            const numM = lines[i].match(/(\d+(?:[.,]\d+)?)\s*$/);
            if (numM) {
              const val = numM[1].replace(".", ",");
              DemandaContratadaPonta = val;
              DemandaContratadaForaPonta = val;
              break;
            }
          }
        }
      }
    }
    DemandaMedidaPonta = findQtyNearLine(lines, /Demanda\s+Medida.*Ponta(?!.*Fora)/i);
    DemandaMedidaForaPonta = findQtyNearLine(lines, /Demanda\s+Medida.*Fora\s*Ponta/i);
    DemandaFaturadaPonta = findQtyNearLine(lines, /Demanda\s+Fatur[ae]da.*Ponta(?!.*Fora)/i) || DemandaMedidaPonta;
    DemandaFaturadaForaPonta = findQtyNearLine(lines, /Demanda\s+Fatur[ae]da.*Fora\s*Ponta/i) || DemandaMedidaForaPonta;
    ValorDemandaPonta = findRValueNearLine(lines, flat, /Demanda\s+(?:Medida|Fatur[ae]da).*Ponta(?!.*Fora)/i);
    ValorDemandaForaPonta = findRValueNearLine(lines, flat, /Demanda\s+(?:Medida|Fatur[ae]da).*Fora\s*Ponta/i);
    if (isVerde) {
      if (DemandaMedidaForaPonta && !DemandaMedidaPonta) DemandaMedidaPonta = DemandaMedidaForaPonta;
      else if (DemandaMedidaPonta && !DemandaMedidaForaPonta) DemandaMedidaForaPonta = DemandaMedidaPonta;
      if (DemandaFaturadaForaPonta && !DemandaFaturadaPonta) DemandaFaturadaPonta = DemandaFaturadaForaPonta;
      else if (DemandaFaturadaPonta && !DemandaFaturadaForaPonta) DemandaFaturadaForaPonta = DemandaFaturadaPonta;
      if (ValorDemandaForaPonta && !ValorDemandaPonta) ValorDemandaPonta = ValorDemandaForaPonta;
      else if (ValorDemandaPonta && !ValorDemandaForaPonta) ValorDemandaForaPonta = ValorDemandaPonta;
    }
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
    DemandaNaoConsumidaPonta = findQtyNearLine(lines, /Não\s*Consumida.*Ponta(?!.*(?:Fora|F\s*Ponta))/i);
    DemandaNaoConsumidaForaPonta = findQtyNearLine(lines, /Não\s*Consumida.*(?:Fora|F)\s*Ponta/i);
    ValorNaoConsumidaPonta = findRValueNearLine(lines, flat, /Não\s*Consumida.*Ponta(?!.*(?:Fora|F\s*Ponta))/i);
    ValorNaoConsumidaForaPonta = findRValueNearLine(lines, flat, /Não\s*Consumida.*(?:Fora|F)\s*Ponta/i);
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
    for (let i = 0; i < lines.length - 2; i++) {
      if (/^ICMS$/i.test(lines[i]) && /^COFINS$/i.test(lines[i + 1]) && /^PIS$/i.test(lines[i + 2])) {
        const afterLabels = lines.slice(i + 3, Math.min(i + 20, lines.length));
        const moneyValues = [];
        for (const line of afterLabels) {
          const m = line.match(/^(\d[\d.]*,\d{2})$/);
          if (m) moneyValues.push(m[1]);
          if (moneyValues.length >= 6) break;
        }
        if (moneyValues.length >= 6) {
          if (!ICMS) ICMS = moneyValues[3];
          if (!COFINS) COFINS = moneyValues[4];
          if (!PIS) PIS = moneyValues[5];
        } else if (moneyValues.length >= 3) {
          const afterBases = afterLabels.slice(3);
          const actualValues = [];
          for (const line of afterBases) {
            if (/^\d+([.,]\d+)?%$/.test(line)) continue;
            const m = line.match(/^(\d[\d.]*,\d{2})$/);
            if (m) actualValues.push(m[1]);
            if (actualValues.length >= 3) break;
          }
          if (actualValues.length >= 3) {
            if (!ICMS) ICMS = actualValues[0];
            if (!COFINS) COFINS = actualValues[1];
            if (!PIS) PIS = actualValues[2];
          }
        }
        break;
      }
    }
  }
  if (!PIS || !COFINS || !ICMS) {
    for (let i = 0; i < lines.length - 2; i++) {
      if (/^PIS$/i.test(lines[i]) && /^ICMS$/i.test(lines[i + 1]) && /^COFINS$/i.test(lines[i + 2])) {
        let firstAliquotIdx = -1;
        for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
          if (/^\d+,\d{2,4}$/.test(lines[j]) && !/^\d+,\d{2}$/.test(lines[j])) {
            firstAliquotIdx = j;
            break;
          }
        }
        if (firstAliquotIdx >= 0) {
          const pisCofinsValues = [];
          for (let j = firstAliquotIdx - 1; j >= Math.max(0, firstAliquotIdx - 5); j--) {
            const m = lines[j].match(/^(\d[\d.]*,\d{2})$/);
            if (m) {
              pisCofinsValues.unshift(m[1]);
              if (pisCofinsValues.length >= 2) break;
            }
          }
          if (pisCofinsValues.length >= 2) {
            if (!PIS) PIS = pisCofinsValues[0];
            if (!COFINS) COFINS = pisCofinsValues[1];
          }
        }
        if (!ICMS) {
          for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
            const catMatch = lines[j].match(/(\d[\d.]*,\d{2})(\d[\d.]*,\d{2})$/);
            if (catMatch) {
              ICMS = catMatch[2];
              break;
            }
          }
        }
        break;
      }
    }
  }
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
  const SaldoAcumuladoGD = (() => {
    const m = flat.match(/Saldo\s*Acumulado\s*:\s*([\d.]+,\d{2})/i);
    if (m) return m[1];
    const m2 = flat.match(/Saldo\s*Acumulado\s*:\s*(\d[\d.]*)/i);
    if (m2) return m2[1];
    return EMPTY;
  })();
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
    let tbl_oUC_Qtd = "";
    let tbl_oUC_Valor = "";
    let tbl_mUC_Qtd = "";
    let tbl_mUC_Valor = "";
    let inGDISection = false;
    let gdiSectionType = "";
    let lastGDILabel = "";
    for (const item of tableData) {
      const lbl = item.label;
      const isFora = /Fora/i.test(lbl) || /F[\s.]*Ponta/i.test(lbl);
      const isPonta = /Ponta/i.test(lbl) && !isFora;
      if (/Consumo\s+em\s+kWh/i.test(lbl) && !/Reativ/i.test(lbl) && !/Injetada/i.test(lbl)) {
        if (item.quantidade) {
          const qtd = parseBR(item.quantidade);
          if (qtd > 0) grupoB_consumoKWh_total += qtd;
        }
        if (item.valor) {
          const val = parseBR(item.valor);
          if (val > 0) grupoB_consumoValor_total += val;
        }
        if (!/Ponta/i.test(lbl) && !/Fora/i.test(lbl) && !/Intermedi/i.test(lbl)) {
          if (item.quantidade) ConsumoTotal = item.quantidade;
          if (item.valor) ValorConsumoForaPonta = item.valor;
        } else if (/Intermedi[áa]ria/i.test(lbl)) {
          if (item.quantidade) ConsumoIntermediaria = item.quantidade;
          if (item.valor) ValorConsumoIntermediaria = item.valor;
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
      } else if (/Demanda\s+Todos/i.test(lbl) && /Per[ií]odo/i.test(lbl)) {
        if (item.quantidade) {
          if (!DemandaContratadaPonta) DemandaContratadaPonta = item.quantidade;
          if (!DemandaContratadaForaPonta) DemandaContratadaForaPonta = item.quantidade;
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
        if (item.quantidade && !tbl_oUC_Qtd) tbl_oUC_Qtd = item.quantidade;
        if (item.valor && !tbl_oUC_Valor) tbl_oUC_Valor = item.valor;
        inGDISection = true;
        gdiSectionType = "oUC";
        lastGDILabel = lbl;
      } else if (/Energia\s*Atv\s*Injetada\s*GDI\s*mUC/i.test(lbl)) {
        if (item.quantidade) {
          tbl_mUC_Qtd = tbl_mUC_Qtd ? fmtSumBR(tbl_mUC_Qtd, item.quantidade) : item.quantidade;
        }
        if (item.valor) {
          tbl_mUC_Valor = tbl_mUC_Valor ? fmtSumBR(tbl_mUC_Valor, item.valor) : item.valor;
        }
        inGDISection = true;
        gdiSectionType = "mUC";
        lastGDILabel = lbl;
      } else if (inGDISection && (/^K?WH$/i.test(lbl.trim()) || lbl.trim() === "") && item.quantidade) {
        if (gdiSectionType === "mUC") {
          tbl_mUC_Qtd = tbl_mUC_Qtd ? fmtSumBR(tbl_mUC_Qtd, item.quantidade) : item.quantidade;
          if (item.valor) {
            tbl_mUC_Valor = tbl_mUC_Valor ? fmtSumBR(tbl_mUC_Valor, item.valor) : item.valor;
          }
        } else if (gdiSectionType === "oUC") {
          tbl_oUC_Qtd = tbl_oUC_Qtd ? fmtSumBR(tbl_oUC_Qtd, item.quantidade) : item.quantidade;
          if (item.valor) {
            tbl_oUC_Valor = tbl_oUC_Valor ? fmtSumBR(tbl_oUC_Valor, item.valor) : item.valor;
          }
        }
      } else if (lbl.trim() !== "" && !/^K?WH$/i.test(lbl.trim())) {
        inGDISection = false;
      }
    }
    if (cipFromTable) CIP = cipFromTable;
    if (tbl_oUC_Qtd) EnergiaAtvInjetadaGDIoUC_Qtd = tbl_oUC_Qtd;
    if (tbl_oUC_Valor) EnergiaAtvInjetadaGDIoUC_Valor = tbl_oUC_Valor;
    if (tbl_mUC_Qtd) EnergiaAtvInjetadaGDImUC_Qtd = tbl_mUC_Qtd;
    if (tbl_mUC_Valor) EnergiaAtvInjetadaGDImUC_Valor = tbl_mUC_Valor;
  }
  if (ConsumoPonta || ConsumoForaPonta || ConsumoIntermediaria) {
    const p = ConsumoPonta ? parseBR(ConsumoPonta) : 0;
    const f = ConsumoForaPonta ? parseBR(ConsumoForaPonta) : 0;
    const it = ConsumoIntermediaria ? parseBR(ConsumoIntermediaria) : 0;
    const total = p + f + it;
    if (total > 0) {
      const currentTotal = ConsumoTotal ? parseBR(ConsumoTotal) : 0;
      if (!ConsumoTotal || total > currentTotal) {
        ConsumoTotal = formatBR(total);
      }
    }
  }
  const isGrupoB = /^B/i.test(Subgrupo);
  if (isGrupoB) {
    if (grupoB_consumoKWh_total > 0) {
      ConsumoGrupoB_kWh = formatBR(grupoB_consumoKWh_total);
    } else if (ConsumoTotal) {
      ConsumoGrupoB_kWh = ConsumoTotal;
    } else {
      const p = ConsumoPonta ? parseBR(ConsumoPonta) : 0;
      const f = ConsumoForaPonta ? parseBR(ConsumoForaPonta) : 0;
      if (p + f > 0) ConsumoGrupoB_kWh = formatBR(p + f);
    }
    if (grupoB_consumoValor_total > 0) {
      ConsumoGrupoB_Valor = formatBR(grupoB_consumoValor_total);
    } else {
      const vp = ValorConsumoPonta ? parseBR(ValorConsumoPonta) : 0;
      const vf = ValorConsumoForaPonta ? parseBR(ValorConsumoForaPonta) : 0;
      if (vp + vf > 0) ConsumoGrupoB_Valor = formatBR(vp + vf);
    }
  }
  return {
    UC: cleanUC,
    Cidade,
    Endereco,
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
    ConsumoIntermediaria,
    ConsumoForaPonta,
    ConsumoTotal,
    ConsumoGrupoB_kWh,
    ConsumoGrupoB_Valor,
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
    ValorConsumoIntermediaria,
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
    SaldoAcumuladoGD,
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
  Endereco: "ENDERE\xC7O",
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
  ConsumoIntermediaria: "Consumo Intermedi\xE1ria (kWh)",
  ConsumoForaPonta: "Consumo Fora Ponta (kWh)",
  ConsumoTotal: "Consumo Total (kWh)",
  ConsumoGrupoB_kWh: "Consumo em kWh (Grupo B)",
  ConsumoGrupoB_Valor: "Consumo (R$) (Grupo B)",
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
  ValorConsumoIntermediaria: "Valor Consumo Intermedi\xE1ria (R$)",
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
  SaldoAcumuladoGD: "Saldo Acumulado GD (kWh)",
  ValorTotal: "Valor Total (R$)"
};
var FIELD_CATEGORIES = [
  { category: "Identifica\xE7\xE3o", fields: ["UC", "Cidade", "Endereco", "Tipo", "Mercado", "Concessionaria"] },
  { category: "Datas e Documentos", fields: ["MesReferencia", "AnoLeitura", "Vencimento", "NotaFiscal"] },
  { category: "Tarifa", fields: ["ModalidadeTarifaria", "Subgrupo"] },
  { category: "Consumo (kWh)", fields: ["ConsumoPonta", "ConsumoIntermediaria", "ConsumoForaPonta", "ConsumoTotal", "ConsumoGrupoB_kWh"] },
  { category: "Demanda Contratada (kW)", fields: ["DemandaContratadaPonta", "DemandaContratadaForaPonta"] },
  { category: "Demanda Medida (kW)", fields: ["DemandaMedidaPonta", "DemandaMedidaForaPonta"] },
  { category: "Demanda Faturada (kW)", fields: ["DemandaFaturadaPonta", "DemandaFaturadaForaPonta"] },
  { category: "Ultrapassagem (kW)", fields: ["UltrapassagemPonta", "UltrapassagemForaPonta"] },
  { category: "Demanda N\xE3o Consumida (kW)", fields: ["DemandaNaoConsumidaPonta", "DemandaNaoConsumidaForaPonta"] },
  { category: "Reativa Excedente (kWh)", fields: ["ReativaExcedentePonta", "ReativaExcedenteForaPonta", "EnergiaReativaTotal"] },
  { category: "Valores - Consumo (R$)", fields: ["ValorConsumoPonta", "ValorConsumoIntermediaria", "ValorConsumoForaPonta", "ConsumoGrupoB_Valor"] },
  { category: "Valores - Demanda (R$)", fields: ["ValorDemandaPonta", "ValorDemandaForaPonta"] },
  { category: "Valores - Ultrapassagem (R$)", fields: ["ValorUltrapassagemPonta", "ValorUltrapassagemForaPonta"] },
  { category: "Valores - Demanda N\xE3o Consumida (R$)", fields: ["ValorNaoConsumidaPonta", "ValorNaoConsumidaForaPonta"] },
  { category: "Valores - Reativa Excedente (R$)", fields: ["ValorReativaExcedentePonta", "ValorReativaExcedenteForaPonta"] },
  { category: "Tributos e Encargos (R$)", fields: ["PIS", "COFINS", "ICMS", "GDI", "CIP"] },
  { category: "Energia Injetada GDI oUC", fields: ["EnergiaAtvInjetadaGDIoUC_Qtd", "EnergiaAtvInjetadaGDIoUC_Valor"] },
  { category: "Energia Injetada GDI mUC", fields: ["EnergiaAtvInjetadaGDImUC_Qtd", "EnergiaAtvInjetadaGDImUC_Valor"] },
  { category: "Gera\xE7\xE3o Distribu\xEDda", fields: ["SaldoAcumuladoGD"] },
  { category: "Total", fields: ["ValorTotal"] }
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FIELD_CATEGORIES,
  FIELD_LABELS,
  extractEnergisaData
});
