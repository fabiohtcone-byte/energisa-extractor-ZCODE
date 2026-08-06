const { extractEnergisaData } = require('/home/z/my-project/dist/energisa-extractor.cjs');
const fs = require('fs');

// Test 1: UC 43.210.051-68 (1 oUC + 1 mUC)
const text1 = fs.readFileSync('/home/z/my-project/scripts/test-gdi-text.txt', 'utf8');
const r1 = extractEnergisaData(text1);
console.log('=== Test 1: UC 43.210.051-68 (1oUC+1mUC) ===');
console.log('UC:', r1.UC);
console.log('oUC Qtd:', r1.EnergiaAtvInjetadaGDIoUC_Qtd, '(esperado: 1.135,00)');
console.log('oUC Valor:', r1.EnergiaAtvInjetadaGDIoUC_Valor, '(embutido: 1.230,27)');
console.log('mUC Qtd:', r1.EnergiaAtvInjetadaGDImUC_Qtd, '(esperado: 453,00)');
console.log('mUC Valor:', r1.EnergiaAtvInjetadaGDImUC_Valor, '(embutido: 491,02)');
console.log();

// Test 2: UC 41.203.051-23 (0 oUC + 2 mUC) - NEW
const text2 = `DANF3E - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA
Av. Gury Marques, 8000
Campo Grande/MS - CEP 79072-900
CNPJ 15.413.826/0001-50    Insc. Est. 28.105.553-0
ENERGISA MATO GROSSO DO SUL - DISTR. DE ENERGIA S.A.
07/07/202607/05/20263208/06/2026
Insc. Est.: 281XXXXXX
RURAL
EMPRESA DE SANEAMENTO DE MATO GROSSO
DO SUL S.A. - SANESUL
SIDROLANDIA (AG: 53)
ASS CAPAO BONITO, S/N - 24.453.11.388000 CPB 001-2160 - 79170000
CNPJ/CPF/RANI: 0X.XXX.XXX/XXX1-20
SANESUL
ANASTACIO MS (AG: 53)
9993000001DOM.  ENT.:
DOMICÍLIO DE ENTREGA
DOM.  BANC.:
Itens da Fatura
Quant.
com tributos
Preço unit (R$)
Valor (R$)Unit (R$)
Tarifa
Base de 
Cálc.(R$)
Valor
(R$)
LIGAÇÃO: TRIFASICO
Classificação: MTC-CONVENCIONAL BAIXA TENSÃO / B3  SERVIÇO 
PÚBLICO / ÁGUA, ESGOTO E SANEAMENTO 
TENSÃO NOMINAL EM VOLTS     DISP:Lim. Min.:202 Lim. Max.:  23
Unid.
Alíquota
(%)
PIS/COFINS (R$)
2,68
12,39
75,90
1,6019
7,3786
17,00
TOTAL:75,90
(R$)
ICMS
ICMS
% Alíq.
446,51
Base Calc.
ICMS (R$)
15,07243,82
Energia Atv Injetada GDI mUC 4/2026 mPT
Adic. B. Amarela
Energia Atv Injetada GDI mUC 5/2026 mPT
Consumo em kWh
1,083930-17,34
3,80
1,083930-185,35
442,711,3059400,986600
0,986600
0,986600
0,00
0,65
0,00
75,25
0,00
3,80
0,00
442,71
-1,56
0,29
-16,65
32,99
chave de acesso:
16,00
171,00
Importante: seu número de identificação será atualizado.
00000Z45972Ponta
Energia ativa em kWh
13393766537326
Art. 41, Inciso III, alínea c, item 3 do RICMS/MS - 1998
21/07/2026R$ 243,82Junho / 2026
41.203.051-23
NOTA FISCAL Nº: 016.629.994 - Série: 002 
DATA DE EMISSÃO:09/06/2026
5026 0615 4138 2600 0150 6600 2016 6299 9410 6840 
7546
Consulte pela Chave de Acesso em:
https://www.dfe.ms.gov.br/nf3e/consulta
KWH
KWH
KWH339,00
Protocolo de Autorização:
1502600007099045 - 09/06/2026 14:30:33
0
17
0
17
SANESUL
R. DR. ZERBINI 421 - CEP:79040040 -   CHÁCARA CACHOEIRA
Tributo
ICMS
COFINS
PIS
32
JUN/26  
31
MAI/26  
32
ABR/26  
30
MAR/26  
29
FEV/26  
33
JAN/26  
30
DEZ/25  
30
NOV/25  
33
OUT/25  
31
SET/25  
32
AGO/25  
31
JUL/25  
29
JUN/25  
CONSUMO FATURADO
Nº DIAS 
FAT
Consumo kWh
167,92
446,51
167,92
NOTA FISCAL/CONTA DE ENERGIA ELÉTRICA
TOTAL A PAGAR
R$ 243,82
Nº FATURA
16629994
21/07/2026
VENCIMENTOMATRÍCULA
1361474-2026-6-8
FATURAMENTO AGRUPADO
CADASTRE SUA FATURA EM DÉBITO AUTOMÁTICO UTILIZANDO O CÓDIGO: 0001361474-8
Esta NOTA FISCAL/CONTA DE ENERGIA fica disponível para pagamento a partir de 02/07/2026
Data de Apresentação:02/07/2026
6,001,00
5,96
FIC
DMIC
DICRI
Referência:
04/2026
Conjunto:
Tensão Contratada:
Limite Adequado:
12901
202 a  23
24,005,96DIC
KWHPonta339,0037.665,00339,001,0037.326,00
0,000,00
0,000,00
*FATURAMENTO PELA MÉDIA/MÍNIMO
ICMS Sobre Desconto Tarifa Decreto 7.891/2013
UC de compensação de energia classificada como GD_I, conforme Lei 14.300/22
Saldo Acumulado: 0 A expirar no próximo ciclo: 0
24,39
0,00
4,02
13,25
37,31
100,00
21,03
59,47
0,00
9,81
32,31
90,97
243,82
Encargo de Uso do Sistema de Distribuição 
(Ref 04/2026): R$ 34,86
Outros serviços
Compra de energia
Serviço de transmissão
Encargos setoriais
Impostos diretos e encargos
Total
51,26Serviço de distribuição 
08/06/2026
Leitura Atual:
07/05/2026
Leitura Anterior:Dias:
32
18,00
26,00
Roteiro: 053 - 0053 - 520 - 0555
Medidor: 00000Z45972`;

const r2 = extractEnergisaData(text2);
console.log('=== Test 2: UC 41.203.051-23 (0oUC+2mUC) ===');
console.log('UC:', r2.UC);
console.log('oUC Qtd:', r2.EnergiaAtvInjetadaGDIoUC_Qtd, '(esperado: vazio)');
console.log('oUC Valor:', r2.EnergiaAtvInjetadaGDIoUC_Valor, '(esperado: vazio)');
console.log('mUC Qtd:', r2.EnergiaAtvInjetadaGDImUC_Qtd, '(esperado: 187,00)');
console.log('mUC Valor:', r2.EnergiaAtvInjetadaGDImUC_Valor, '(esperado: 202,69 = 17,34+185,35)');
console.log();

// Test 3: UC 23.055.051-94 (1 oUC + 5 mUC) - from user text
const text3 = `DANF3E - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA
Av. Gury Marques, 8000
Campo Grande/MS - CEP 79072-900
CNPJ 15.413.826/0001-50    Insc. Est. 28.105.553-0
ENERGISA MATO GROSSO DO SUL - DISTR. DE ENERGIA S.A.
13/07/202613/05/20263012/06/2026
Insc. Est.: 281XXXXXX
CENTRO
EMPRESA DE SANEAMENTO DE MATO GROSSO
DO SUL S.A. - SANESUL
ARAL MOREIRA (AG: 70)
RUA DOM PEDRO II, 474 - 06.070.09.558400 ARM RE 947 - 79930000
CNPJ/CPF/RANI: 0X.XXX.XXX/XXX1-20
SANESUL
ANASTACIO MS (AG: 70)
9993000001DOM.  ENT.:
DOMICÍLIO DE ENTREGA
DOM.  BANC.:
Itens da Fatura
Quant.
com tributos
Preço unit (R$)
Valor (R$)Unit (R$)
Tarifa
Base de 
Cálc.(R$)
Valor
(R$)
LIGAÇÃO: TRIFASICO
Classificação: MTC-CONVENCIONAL BAIXA TENSÃO / B3  SERVIÇO 
PÚBLICO / ÁGUA, ESGOTO E SANEAMENTO 
TENSÃO NOMINAL EM VOLTS     DISP:Lim. Min.:202 Lim. Max.:  23
Unid.
Alíquota
(%)
PIS/COFINS (R$)
1,79
8,17
553,90
1,6019
7,3786
17,00
TOTAL:553,90
(R$)
ICMS
ICMS
% Alíq.
3.258,26
Base Calc.
ICMS (R$)
9,961.207,04
Energia Atv Injetada GDI oUC 6/2026 mPT
CONT.IL.PUB-CIP MUNICIPAL
 LANÇAMENTOS E SERVIÇOS
Adic. B. Amarela
Energia Atv Injetada GDI mUC 1/2026 mPT
Energia Atv Injetada GDI mUC 12/2025 mPT
Energia Atv Injetada GDI mUC 11/2025 mPT
Energia Atv Injetada GDI mUC 10/2025 mPT
Energia Atv Injetada GDI mUC 9/2025 mPT
Consumo em kWh
1,083930-573,40
542,63
2,52
1,083930-99,72
1,083930-320,84
1,083930-764,18
1,083930-640,61
1,083930-195,10
3.255,741,3059400,986600
0,986600
0,986600
0,986600
0,986600
0,986600
0,986600
0,00
0,44
0,00
0,00
0,00
0,00
0,00
553,46
0,00
0,00
0,00
2,52
0,00
0,00
0,00
0,00
0,00
3.255,74
-51,49
0,00
0,20
-8,96
-28,81
-68,62
-57,53
-17,51
242,68
chave de acesso:
529,00
180,00
591,00
705,00
296,00
92,00
Importante: seu número de identificação será atualizado.
00000F08171Ponta
Energia ativa em kWh
124938320780714
Art. 41, Inciso III, alínea c, item 3 do RICMS/MS - 1998
21/07/2026R$ 1.207,04Junho / 2026
23.055.051-94
NOTA FISCAL Nº: 016.811.867 - Série: 002 
DATA DE EMISSÃO:15/06/2026
5026 0615 4138 2600 0150 6600 2016 8118 6710 0723 
3974
Consulte pela Chave de Acesso em:
https://www.dfe.ms.gov.br/nf3e/consulta
KWH
KWH
KWH
KWH
KWH
KWH
KWH2.493,00
Protocolo de Autorização:
1502600007444308 - 16/06/2026 07:12:47
0
0
17
0
0
0
0
0
17
SANESUL
R. DR. ZERBINI 421 - CEP:79040040 -   CHÁCARA CACHOEIRA
Tributo
ICMS
COFINS
PIS
30
JUN/26  
30
MAI/26  
32
ABR/26  
31
MAR/26  
28
FEV/26  
32
JAN/26  
30
DEZ/25  
32
NOV/25  
29
OUT/25  
31
SET/25  
32
AGO/25  
30
JUL/25  
29
JUN/25  
CONSUMO FATURADO
Nº DIAS 
FAT
Consumo kWh
110,53
3.258,26
110,53
NOTA FISCAL/CONTA DE ENERGIA ELÉTRICA
TOTAL A PAGAR
R$ 1.207,04
Nº FATURA
16811867
21/07/2026
VENCIMENTOMATRÍCULA
252248-2026-6-0
FATURAMENTO AGRUPADO
Esta NOTA FISCAL/CONTA DE ENERGIA fica disponível para pagamento a partir de 02/07/2026
*FATURAMENTO PELA MÉDIA/MÍNIMO
UC de compensação de energia classificada como GD_I, conforme Lei 14.300/22
Saldo Acumulado: 835 A expirar no próximo ciclo: 0
3,24
0,00
0,54
1,76
91,67
100,00
2,79
39,12
0,00
6,46
21,26
1.106,49
1.207,04
Encargo de Uso do Sistema de Distribuição 
(Ref 04/2026): R$ 34,89
Roteiro: 007 - 0070 - 060 - 0940
Medidor: 00000F08171`;

const r3 = extractEnergisaData(text3);
console.log('=== Test 3: UC 23.055.051-94 (1oUC+5mUC) ===');
console.log('UC:', r3.UC);
console.log('oUC Qtd:', r3.EnergiaAtvInjetadaGDIoUC_Qtd, '(esperado: 529,00)');
console.log('oUC Valor:', r3.EnergiaAtvInjetadaGDIoUC_Valor, '(embutido: 573,40)');
console.log('mUC Qtd:', r3.EnergiaAtvInjetadaGDImUC_Qtd, '(esperado: 1.864,00)');
console.log('mUC Valor:', r3.EnergiaAtvInjetadaGDImUC_Valor, '(embutido: 99,72+320,84+764,18+640,61+195,10 = 2.020,45)');
console.log('Total:', r3.ValorTotal);
