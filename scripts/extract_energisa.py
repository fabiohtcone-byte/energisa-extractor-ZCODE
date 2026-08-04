#!/usr/bin/env python3
"""
Extrai dados de faturas ENERGISA (PDF) e gera planilha Excel.
Suporta 4 modelos: MTA (Azul), MTV (Verde), MTC (Convencional B3), MTB (Branca).
"""

import re
import json
import sys
import os

# === Config ===
PDF_SKILL_DIR = os.path.expanduser("~/my-project/skills/pdf")
UPLOAD_DIR = os.path.expanduser("~/my-project/upload")
OUTPUT_FILE = os.path.expanduser("~/my-project/download/Extracao_Faturas_ENERGISA.xlsx")

PDF_FILES = [
    "144378605167.PDF",
    "8092005187.PDF",
    "7948705165.PDF",
    "7929105158.PDF",
    "4456305122.PDF",
    "4167605165.PDF",
    "2305505194.PDF",
    "2214205140.PDF",
    "724705186.PDF",
    "565605136.PDF",
]


def extract_text_from_pdf(pdf_path):
    """Extract full text from PDF using pdfplumber."""
    import pdfplumber
    all_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            all_text += text + "\n"
    return all_text


def parse_numero(s):
    """Parse Brazilian number format (1.234,56) to float."""
    if s is None:
        return None
    s = str(s).strip()
    if not s or s == '-':
        return None
    # Remove R$ prefix
    s = re.sub(r'^R\$\s*', '', s)
    # Handle negative with parentheses or minus
    s = s.replace('(', '-').replace(')', '')
    # Remove thousand separators (dots) and replace comma
    s = s.replace('.', '').replace(',', '.')
    try:
        val = float(s)
        return val if val != 0 else 0.0
    except ValueError:
        return None


def parse_quant(s):
    """Parse quantity (1.234,56 or 1234,56) to float."""
    if s is None:
        return None
    s = str(s).strip()
    if not s or s == '*':
        return None
    s = s.replace('.', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


def findall(pattern, text):
    """Find all matches and return first group."""
    m = re.search(pattern, text)
    if m:
        return m.group(1).strip()
    return None


def findall_float(pattern, text):
    """Find match and parse as float."""
    m = re.search(pattern, text)
    if m:
        return parse_numero(m.group(1))
    return None


def extract_fatura_data(text, filename):
    """Extract all fields from fatura text."""
    data = {}
    data["Arquivo"] = filename

    # === UC ===
    # UC appears right before "NOTA FISCAL" on the same line
    uc_match = re.search(r'(\d[\d.]*\.\d{3}-\d{2})\s+NOTA FISCAL', text)
    if uc_match:
        data["UC"] = uc_match.group(1)
    else:
        # Fallback: find any pattern like NNN.NNN.NNN-NN
        uc_match2 = re.search(r'(\d{1,3}\.\d{3}\.\d{3}-\d{2})', text)
        data["UC"] = uc_match2.group(1) if uc_match2 else None

    # === Cidade ===
    # City appears in format like "DOURADOS (AG: 10)" or "ARAL MOREIRA (AG: 70)"
    # First occurrence is DOMICÍLIO DE ENTREGA (billing), second is the actual UC city
    all_cidades = re.findall(r'([A-ZÇÃÁÀÉÊÍÓÔÕÚÂ][A-ZÇÃÁÀÉÊÍÓÔÕÚÂ ]*?)\s*\(AG:\s*\d+\)', text)
    if len(all_cidades) >= 2:
        data["Cidade"] = all_cidades[1].strip().title()
    elif len(all_cidades) == 1:
        data["Cidade"] = all_cidades[0].strip().title()
    else:
        data["Cidade"] = None

    # === Tipo & Mercado (from Classificação) ===
    class_match = re.search(r'Classificação:\s*(.*?)\s+LIGAÇÃO:', text, re.DOTALL)
    if class_match:
        class_text = class_match.group(1).strip()
        class_text = re.sub(r'\s+', ' ', class_text)
        data["Tipo"] = class_text
        # Extract mercado
        if 'SERVIÇO PÚBLICO' in class_text.upper() or 'SERVICO PUBLICO' in class_text.upper():
            data["Mercado"] = "Serviço Público"
        elif 'COMERCIAL' in class_text.upper():
            data["Mercado"] = "Comercial"
        elif 'RESIDENCIAL' in class_text.upper():
            data["Mercado"] = "Residencial"
        elif 'INDUSTRIAL' in class_text.upper():
            data["Mercado"] = "Industrial"
        elif 'RURAL' in class_text.upper():
            data["Mercado"] = "Rural"
        else:
            data["Mercado"] = class_text
    else:
        data["Tipo"] = None
        data["Mercado"] = None

    # === Concessionária ===
    conc_match = re.search(r'ENERGISA\s+(.*?)(?:\n|\s*-\s*DISTR)', text)
    if conc_match:
        data["Concessionária"] = "ENERGISA " + conc_match.group(1).strip()
    else:
        data["Concessionária"] = "ENERGISA MATO GROSSO DO SUL"

    # === Mês Referência ===
    # Find "Referência: MM/AAAA" or from date range
    ref_match = re.search(r'Referência:\s*(\d{2}/\d{4})', text)
    if ref_match:
        data["Mês Referência"] = ref_match.group(1)
    else:
        data["Mês Referência"] = None

    # === Ano Leitura ===
    if data["Mês Referência"]:
        data["Ano Leitura"] = data["Mês Referência"].split("/")[1]
    else:
        data["Ano Leitura"] = None

    # === Vencimento ===
    # Format: DD/MM/AAAA next to "Junho / 2026"
    # Pattern: "Junho / 2026 DD/MM/AAAA R$ valor"
    venc_match = re.search(r'(?:Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s*/\s*\d{4}\s+(\d{2}/\d{2}/\d{4})', text)
    if venc_match:
        data["Vencimento"] = venc_match.group(1)
    else:
        # Try another pattern
        venc_match2 = re.search(r'VENCIMENTO\s+(\d{2}/\d{2}/\d{4})', text)
        if venc_match2:
            data["Vencimento"] = venc_match2.group(1)
        else:
            data["Vencimento"] = None

    # === Nota Fiscal ===
    nf_match = re.search(r'NOTA FISCAL Nº:\s*([\d.]+)', text)
    if nf_match:
        data["Nota Fiscal"] = nf_match.group(1)
    else:
        data["Nota Fiscal"] = None

    # === Modalidade Tarifária ===
    class_full = data.get("Tipo", "") or ""
    if 'AZUL' in class_full.upper():
        data["Modalidade Tarifária"] = "Azul"
    elif 'VERDE' in class_full.upper():
        data["Modalidade Tarifária"] = "Verde"
    elif 'BRANCA' in class_full.upper():
        data["Modalidade Tarifária"] = "Branca"
    elif 'CONVENCIONAL' in class_full.upper():
        data["Modalidade Tarifária"] = "Convencional"
    else:
        data["Modalidade Tarifária"] = None

    # === Subgrupo ===
    sub_match = re.search(r'/\s*([AB]\d)\s', class_full)
    if sub_match:
        data["Subgrupo"] = sub_match.group(1)
    else:
        data["Subgrupo"] = None

    # === Determine tariff model ===
    is_azul = data["Modalidade Tarifária"] == "Azul"
    is_verde = data["Modalidade Tarifária"] == "Verde"
    is_branca = data["Modalidade Tarifária"] == "Branca"
    is_convencional = data["Modalidade Tarifária"] == "Convencional"
    is_grupo_b = data["Subgrupo"] and data["Subgrupo"].startswith("B")

    # === Valor Total ===
    # Pattern 1: "Mês/Ano DD/MM/AAAA R$ X.XXX,XX" (before the items table)
    total_match = re.search(r'(?:Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s*/\s*\d{4}\s+\d{2}/\d{2}/\d{4}\s+R\$\s*([\d.,]+)', text)
    if total_match:
        data["Valor Total (R$)"] = parse_numero(total_match.group(1))
    else:
        # Pattern 2: "TOTAL: X.XXX,XX" (in the items table)
        total_match2 = re.search(r'TOTAL:\s*([\d.,]+)', text)
        if total_match2:
            data["Valor Total (R$)"] = parse_numero(total_match2.group(1))
        else:
            data["Valor Total (R$)"] = None

    # === Consumo Grupo B ===
    if is_grupo_b:
        # For B3, there's a single "Consumo em kWh" line (no Ponta/FP suffix)
        pat = r'Consumo em kWh\b\s+KWH\s+([\d.,]+)\s+[\d.,]+\s+([\d.,]+)'
        m = re.search(pat, text)
        if m:
            data["Consumo Grupo B (kWh)"] = parse_quant(m.group(1))
        else:
            data["Consumo Grupo B (kWh)"] = None
    else:
        data["Consumo Grupo B (kWh)"] = None

    # === Demanda Contratada ===
    # "Demanda ponta - kW XXXX" and "Demanda fora ponta - kW XXXX"
    dem_ponta_c = re.search(r'Demanda ponta\s*-\s*kW\s*([\d,*]+)', text)
    data["Demanda Contratada Ponta (kW)"] = parse_quant(dem_ponta_c.group(1)) if dem_ponta_c else None

    dem_fp_c = re.search(r'Demanda fora ponta\s*-\s*kW\s*([\d,*]+)', text)
    data["Demanda Contratada Fora Ponta (kW)"] = parse_quant(dem_fp_c.group(1)) if dem_fp_c else None

    # === Parse the items table ===
    # We need to extract individual line items from the fatura
    # The table has lines like:
    # "Consumo em kWh - Ponta KWH 75009,90 0,766180 57.471,85"
    # "Demanda de Potência Medida - Ponta KW 1.276,80 84,707650 108.154,73"

    lines = text.split('\n')
    items_text = []
    in_items = False
    for line in lines:
        if 'Itens da Fatura' in line:
            in_items = True
            continue
        if in_items and ('TOTAL:' in line or 'LANÇAMENTOS' in line):
            in_items = False
            break
        if in_items:
            items_text.append(line)

    items_full = ' '.join(items_text)

    # Helper to extract item quantity and value from items section
    # Format: Item_Name KWH/KW Quantity Unit_Price Value ...
    def extract_item(pattern, items_text):
        m = re.search(pattern, items_text)
        if m:
            return parse_quant(m.group(1)), parse_numero(m.group(2))
        return None, None

    # Helper: qty and value (skipping unit price) - 3-number pattern
    def extract_item_qv(item_name, unit, items_text):
        """Extract quantity and value, skipping unit price.
        Pattern: ItemName UNIT QTY UNIT_PRICE VALUE"""
        pat = item_name + r'\s+' + unit + r'\s+([\d.,]+)\s+[\d.,]+\s+([\d.,]+)'
        m = re.search(pat, items_text)
        if m:
            return parse_quant(m.group(1)), parse_numero(m.group(2))
        return None, None

    # === Demanda Medida Ponta ===
    q, v = extract_item_qv(r'Demanda de Potência Medida - Ponta', r'KW', items_full)
    data["Demanda Medida Ponta (kW)"] = q
    data["Valor Demanda Medida Ponta (R$)"] = v

    # === Demanda Medida Fora Ponta ===
    q, v = extract_item_qv(r'Demanda de Potência Medida - Fora Ponta', r'KW', items_full)
    data["Demanda Medida Fora Ponta (kW)"] = q
    data["Valor Demanda Medida Fora Ponta (R$)"] = v

    # === Consumo Ponta/Fora Ponta ===
    if is_azul or is_verde:
        q, v = extract_item_qv(r'Consumo em kWh - Ponta', r'KWH', items_full)
        data["Consumo Ponta (kWh)"] = q
        data["Valor Consumo Ponta (R$)"] = v

        q, v = extract_item_qv(r'Consumo em kWh - Fora Ponta', r'KWH', items_full)
        data["Consumo Fora Ponta (kWh)"] = q
        data["Valor Consumo Fora Ponta (R$)"] = v
    elif is_convencional and not is_grupo_b:
        # MTC (A group) - single consumption line
        q, v = extract_item_qv(r'Consumo em kWh\b', r'KWH', items_full)
        data["Consumo Ponta (kWh)"] = q
        data["Valor Consumo Ponta (R$)"] = v
        data["Consumo Fora Ponta (kWh)"] = None
        data["Valor Consumo Fora Ponta (R$)"] = None
    elif is_branca:
        # Tarifa Branca - different format: no KWH unit on same line
        # Extract quantities from meter reading section: "KWH Ponta ... 89,00 89,00"
        branc_q_ponta = re.search(r'KWH Ponta\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)', text)
        branc_q_fp = re.search(r'KWH FPonta\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)', text)
        data["Consumo Ponta (kWh)"] = parse_quant(branc_q_ponta.group(1)) if branc_q_ponta else None
        data["Consumo Fora Ponta (kWh)"] = parse_quant(branc_q_fp.group(1)) if branc_q_fp else None

        # Values from items section: "Consumo em kWh - Ponta PRICE VALUE"
        branc_val_ponta = re.search(r'Consumo em kWh - Ponta\s+([\d.,]+)\s+([\d.,]+)', items_full)
        if branc_val_ponta:
            # First number is unit price, second is value
            data["Valor Consumo Ponta (R$)"] = parse_numero(branc_val_ponta.group(2))

        branc_val_fp = re.search(r'Consumo em kWh - Fora Ponta\s+([\d.,]+)\s+([\d.,]+)', items_full)
        if branc_val_fp:
            data["Valor Consumo Fora Ponta (R$)"] = parse_numero(branc_val_fp.group(2))
    else:
        data["Consumo Ponta (kWh)"] = None
        data["Valor Consumo Ponta (R$)"] = None
        data["Consumo Fora Ponta (kWh)"] = None
        data["Valor Consumo Fora Ponta (R$)"] = None

    # === Demanda Todos os Períodos (kW) ===
    # For Verde tariff, there's a single demand measured in "Fora Ponta"
    # For Branca, no demand
    if is_verde:
        # In Verde, the single demand appears as "Demanda de Potência Medida - Fora Ponta"
        data["Demanda Todos os Períodos (kW)"] = data.get("Demanda Medida Fora Ponta (kW)")
    else:
        data["Demanda Todos os Períodos (kW)"] = None

    # === Demanda Não Consumida Ponta ===
    q, v = extract_item_qv(r'Demanda Potência Não Consumida - Ponta', r'KW', items_full)
    data["Demanda Não Consumida Ponta (kW)"] = q
    data["Valor Demanda Não Consumida Ponta (R$)"] = v

    # === Demanda Não Consumida Fora Ponta ===
    q, v = extract_item_qv(r'Demanda Potência Não Consumida - F Ponta', r'KW', items_full)
    data["Demanda Não Consumida Fora Ponta (kW)"] = q
    data["Valor Demanda Não Consumida Fora Ponta (R$)"] = v

    # === Ultrapassagem Ponta ===
    q, v = extract_item_qv(r'Demanda Potência Ativa - Ultrap - Ponta', r'KW', items_full)
    data["Ultrapassagem Ponta (kW)"] = q
    data["Valor Ultrapassagem Ponta (R$)"] = v

    # === Ultrapassagem Fora Ponta ===
    q, v = extract_item_qv(r'Demanda Potência Ativa - Ultrap - F Ponta', r'KW', items_full)
    data["Ultrapassagem Fora Ponta (kW)"] = q
    data["Valor Ultrapassagem Fora Ponta (R$)"] = v

    # === Reativa Excedente Ponta ===
    q, v = extract_item_qv(r'Energia Reativa Exced em KWh - Ponta', r'UN', items_full)
    data["Reativa Excedente Ponta (kVArh)"] = q
    data["Valor Reativa Excedente Ponta (R$)"] = v

    # === Reativa Excedente Fora Ponta ===
    q, v = extract_item_qv(r'Energia Reativa Exced em KWh - Fponta', r'UN', items_full)
    data["Reativa Excedente Fora Ponta (kVArh)"] = q
    data["Valor Reativa Excedente Fora Ponta (R$)"] = v

    # Also try alternate pattern for reativa in convencional (no Ponta/FP suffix)
    if data["Reativa Excedente Ponta (kVArh)"] is None and data["Reativa Excedente Fora Ponta (kVArh)"] is None:
        q, v = extract_item_qv(r'Energia Reativa Exced em KWh\b', r'UN', items_full)
        if q is not None:
            data["Reativa Excedente Fora Ponta (kVArh)"] = q
            data["Valor Reativa Excedente Fora Ponta (R$)"] = v

    # === GDI oUC ===
    gdi_ouc_match = re.findall(r'Energia Atv Injetada GDI oUC\s+\d+/\d+\s+mPT\s+KWH\s+([\d.,]+)\s+([\d.,]+)\s+(-?[\d.,]+)', items_full)
    total_q_ouc = 0
    total_v_ouc = 0
    for m in gdi_ouc_match:
        total_q_ouc += parse_quant(m[0]) or 0
        total_v_ouc += parse_numero(m[2]) or 0  # Value is negative (credit)
    data["GDI oUC (kWh)"] = total_q_ouc if total_q_ouc > 0 else None
    data["Valor GDI oUC (R$)"] = total_v_ouc if total_v_ouc != 0 else None

    # === GDI mUC ===
    gdi_muc_match = re.findall(r'Energia Atv Injetada GDI mUC\s+\d+/\d+\s+mPT\s+KWH\s+([\d.,]+)\s+([\d.,]+)\s+(-?[\d.,]+)', items_full)
    total_q_muc = 0
    total_v_muc = 0
    for m in gdi_muc_match:
        total_q_muc += parse_quant(m[0]) or 0
        total_v_muc += parse_numero(m[2]) or 0
    data["GDI mUC (kWh)"] = total_q_muc if total_q_muc > 0 else None
    data["Valor GDI mUC (R$)"] = total_v_muc if total_v_muc != 0 else None

    # === CIP ===
    cip_match = re.search(r'CONT\.IL\.PUB-CIP MUNICIPAL\s+([\d.,]+)', text)
    if cip_match:
        data["CIP (R$)"] = parse_numero(cip_match.group(1))
    else:
        data["CIP (R$)"] = None

    # === Outros Encargos ===
    outros_lines = []
    in_outros = False
    skip_keywords = ['CONT.IL.PUB-CIP', 'Demanda', 'kW', 'KW', 'TUSDG', 'KWTG',
                       'Nº DIAS', 'CONSUMO', 'Energia', 'NOTA FISCAL', 'FATURAMENTO',
                       'chave de acesso', 'Protocolo', 'GDI', 'COMPENSACAO']
    for line in text.split('\n'):
        if 'LANÇAMENTOS E SERVIÇOS' in line:
            in_outros = True
            remainder = line.split('LANÇAMENTOS E SERVIÇOS')[-1].strip()
            if remainder and not any(k in remainder for k in skip_keywords) and not re.search(r'[A-ZÇÃÁÀÉÊÍÓÔÕÚÂ]{3}/', remainder):
                outros_lines.append(remainder)
            continue
        if in_outros:
            if not line.strip() or 'TOTAL:' in line:
                break
            if re.search(r'[A-ZÇÃÁÀÉÊÍÓÔÕÚÂ]{3}/\d{2,4}', line):
                break
            if any(k in line for k in skip_keywords):
                break
            outros_lines.append(line.strip())

    outros_total = 0
    has_outros = False
    for line in outros_lines:
        if not line:
            continue
        val_match = re.search(r'([\d.,]+)\s*$', line)
        if val_match:
            v = parse_numero(val_match.group(1))
            if v is not None and v != 0:
                outros_total += v
                has_outros = True
    data["Outros Encargos (R$)"] = outros_total if has_outros else None

    # === PIS, COFINS, ICMS ===
    # Strategy: extract from TOTAL line (4 values: total, PIS/COFINS, base ICMS, ICMS)
    # For Branca model, PIS and COFINS appear separately

    # First try Branca model: PIS and COFINS as separate lines
    pis_separate = re.search(r'\bPIS\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)', text)
    cofins_separate = re.search(r'\bCOFINS\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)', text)

    if pis_separate and cofins_separate and is_branca:
        data["PIS (R$)"] = parse_numero(pis_separate.group(1))
        data["COFINS (R$)"] = parse_numero(cofins_separate.group(1))
        # ICMS from separate line
        icms_sep = re.search(r'\bICMS\s+[\d.,]+\s+([\d.,]+)\s*%?\s*([\d.,]+)', text)
        data["ICMS (R$)"] = parse_numero(icms_sep.group(2)) if icms_sep else None
    else:
        # For other models: extract from TOTAL line
        total_line_match = re.search(r'TOTAL:\s*[\d.,]+\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)', text)
        if total_line_match:
            pis_cofins_total = parse_numero(total_line_match.group(1))
            icms_val = parse_numero(total_line_match.group(3))
            data["ICMS (R$)"] = icms_val

            # Try to find PIS rate to split PIS/COFINS
            pis_rate_match = re.search(r'PIS\s+([\d.,]+)', text)
            pis_rate = parse_numero(pis_rate_match.group(1)) if pis_rate_match else None

            if pis_rate and pis_cofins_total:
                # COFINS rate is typically ~4.174x PIS rate (for A group) or use known ratio
                # PIS: 0.9660% or 1.6019%, COFINS: ~4.174% or 7.3786%
                if pis_rate > 1.0:
                    # B group rates
                    cofins_rate = 7.3786
                else:
                    # A group rates
                    cofins_rate = 4.174
                ratio_pis = pis_rate / (pis_rate + cofins_rate)
                data["PIS (R$)"] = round(pis_cofins_total * ratio_pis, 2)
                data["COFINS (R$)"] = round(pis_cofins_total * (1 - ratio_pis), 2)
            else:
                data["PIS (R$)"] = None
                data["COFINS (R$)"] = pis_cofins_total
        else:
            data["PIS (R$)"] = None
            data["COFINS (R$)"] = None
            data["ICMS (R$)"] = None

    return data


def create_excel(all_data):
    """Create Excel file with extracted data."""
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Extracao Faturas"

    # === Column definitions ===
    columns = [
        ("Arquivo", 20),
        ("UC", 20),
        ("Gerência", 15),
        ("LOCINS", 15),
        ("Cidade", 18),
        ("Tipo", 50),
        ("Mercado", 18),
        ("Concessionária", 40),
        ("Mês Referência", 15),
        ("Ano Leitura", 12),
        ("Vencimento", 15),
        ("Nota Fiscal", 20),
        ("Modalidade Tarifária", 20),
        ("Subgrupo", 12),
        ("Valor Total (R$)", 18),
        ("Consumo Grupo B (kWh)", 22),
        ("Demanda Contratada Ponta (kW)", 28),
        ("Demanda Contratada Fora Ponta (kW)", 32),
        ("Demanda Medida Ponta (kW)", 25),
        ("Valor Demanda Medida Ponta (R$)", 30),
        ("Demanda Medida Fora Ponta (kW)", 28),
        ("Valor Demanda Medida Fora Ponta (R$)", 33),
        ("Consumo Ponta (kWh)", 20),
        ("Valor Consumo Ponta (R$)", 23),
        ("Consumo Fora Ponta (kWh)", 24),
        ("Valor Consumo Fora Ponta (R$)", 27),
        ("Demanda Todos os Períodos (kW)", 30),
        ("Demanda Não Consumida Ponta (kW)", 30),
        ("Valor Demanda Não Consumida Ponta (R$)", 35),
        ("Demanda Não Consumida Fora Ponta (kW)", 32),
        ("Valor Demanda Não Consumida Fora Ponta (R$)", 37),
        ("Ultrapassagem Ponta (kW)", 24),
        ("Valor Ultrapassagem Ponta (R$)", 28),
        ("Ultrapassagem Fora Ponta (kW)", 26),
        ("Valor Ultrapassagem Fora Ponta (R$)", 30),
        ("Reativa Excedente Ponta (kVArh)", 30),
        ("Valor Reativa Excedente Ponta (R$)", 33),
        ("Reativa Excedente Fora Ponta (kVArh)", 32),
        ("Valor Reativa Excedente Fora Ponta (R$)", 36),
        ("GDI oUC (kWh)", 16),
        ("Valor GDI oUC (R$)", 20),
        ("GDI mUC (kWh)", 16),
        ("Valor GDI mUC (R$)", 20),
        ("CIP (R$)", 12),
        ("Outros Encargos (R$)", 20),
        ("PIS (R$)", 12),
        ("COFINS (R$)", 14),
        ("ICMS (R$)", 12),
    ]

    # === Styles ===
    header_font = Font(name='Calibri', bold=True, color='FFFFFF', size=10)
    header_fill = PatternFill(start_color='2F5496', end_color='2F5496', fill_type='solid')
    header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    data_font = Font(name='Calibri', size=10)
    data_align = Alignment(horizontal='left', vertical='center')
    num_align = Alignment(horizontal='right', vertical='center')
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    highlight_fill = PatternFill(start_color='E2EFDA', end_color='E2EFDA', fill_type='solid')
    manual_fill = PatternFill(start_color='FFF2CC', end_color='FFF2CC', fill_type='solid')

    # === Write headers ===
    for col_idx, (col_name, col_width) in enumerate(columns, 1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border
        ws.column_dimensions[get_column_letter(col_idx)].width = col_width

    # === Write data ===
    money_fields = [
        "Valor Total (R$)", "Valor Demanda Medida Ponta (R$)", "Valor Demanda Medida Fora Ponta (R$)",
        "Valor Consumo Ponta (R$)", "Valor Consumo Fora Ponta (R$)",
        "Valor Demanda Não Consumida Ponta (R$)", "Valor Demanda Não Consumida Fora Ponta (R$)",
        "Valor Ultrapassagem Ponta (R$)", "Valor Ultrapassagem Fora Ponta (R$)",
        "Valor Reativa Excedente Ponta (R$)", "Valor Reativa Excedente Fora Ponta (R$)",
        "Valor GDI oUC (R$)", "Valor GDI mUC (R$)",
        "CIP (R$)", "Outros Encargos (R$)", "PIS (R$)", "COFINS (R$)", "ICMS (R$)",
    ]

    qty_fields = [
        "Consumo Grupo B (kWh)", "Demanda Contratada Ponta (kW)", "Demanda Contratada Fora Ponta (kW)",
        "Demanda Medida Ponta (kW)", "Demanda Medida Fora Ponta (kW)",
        "Consumo Ponta (kWh)", "Consumo Fora Ponta (kWh)",
        "Demanda Todos os Períodos (kW)",
        "Demanda Não Consumida Ponta (kW)", "Demanda Não Consumida Fora Ponta (kW)",
        "Ultrapassagem Ponta (kW)", "Ultrapassagem Fora Ponta (kW)",
        "Reativa Excedente Ponta (kVArh)", "Reativa Excedente Fora Ponta (kVArh)",
        "GDI oUC (kWh)", "GDI mUC (kWh)",
    ]

    for row_idx, fatura in enumerate(all_data, 2):
        for col_idx, (col_name, _) in enumerate(columns, 1):
            val = fatura.get(col_name)
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = data_font
            cell.border = thin_border

            if col_name in ("Gerência", "LOCINS"):
                # Manual fill columns - leave blank with yellow
                cell.fill = manual_fill
                cell.alignment = data_align
            elif col_name in money_fields:
                if val is not None:
                    cell.value = val
                    cell.number_format = '#,##0.00'
                cell.alignment = num_align
            elif col_name in qty_fields:
                if val is not None:
                    cell.value = val
                    cell.number_format = '#,##0.00'
                cell.alignment = num_align
            else:
                cell.value = val
                cell.alignment = data_align

    # === Freeze panes ===
    ws.freeze_panes = 'C2'

    # === Auto-filter ===
    ws.auto_filter.ref = f"A1:{get_column_letter(len(columns))}{len(all_data)+1}"

    # === Row height for header ===
    ws.row_dimensions[1].height = 40

    wb.save(OUTPUT_FILE)
    print(f"Excel saved: {OUTPUT_FILE}")
    return OUTPUT_FILE


def main():
    all_data = []
    for pdf_file in PDF_FILES:
        pdf_path = os.path.join(UPLOAD_DIR, pdf_file)
        if not os.path.exists(pdf_path):
            print(f"WARNING: {pdf_path} not found, skipping.")
            continue

        print(f"Processing: {pdf_file}")
        text = extract_text_from_pdf(pdf_path)
        data = extract_fatura_data(text, pdf_file)
        all_data.append(data)

        # Print summary
        print(f"  UC: {data.get('UC')}")
        print(f"  Cidade: {data.get('Cidade')}")
        print(f"  Modalidade: {data.get('Modalidade Tarifária')}")
        print(f"  Subgrupo: {data.get('Subgrupo')}")
        print(f"  Vencimento: {data.get('Vencimento')}")
        print(f"  Valor Total: {data.get('Valor Total (R$)')}")
        print(f"  Nota Fiscal: {data.get('Nota Fiscal')}")
        print()

    output = create_excel(all_data)
    print(f"\nDone! {len(all_data)} faturas processadas.")
    print(f"Arquivo: {output}")


if __name__ == "__main__":
    main()
