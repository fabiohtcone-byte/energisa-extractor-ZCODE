# Worklog - Extração de Faturas ENERGISA

---
Task ID: 1
Agent: Main Agent
Task: Corrigir extração de dados do PDF ENERGISA e ativar o app

Work Log:
- Extraiu texto bruto do PDF 356205159.PDF (UC 3.562.051-59) com pdf-parse
- Analisou o formato exato do PDF: texto concatenado, labels misturados com valores
- Reescreveu energisa-extractor.ts completamente com base no texto real
- Corrigiu UC (regex para formato X.XXX.XXX-XX isolado na linha)
- Corrigiu Cidade (pattern "DOURADOS (AG: 10)")
- Corrigiu Vencimento (data ANTES do label "VENCIMENTOMATRÍCULA")
- Corrigiu Mês Referência ("Junho / 2026" no texto)
- Corrigiu PIS/COFINS/ICMS (3 valores consecutivos após "PIS/ COFINS (R$)")
- Corrigiu Consumo Total ("KWH1.044,00" sem espaço)
- Corrigiu Mercado ("ÁGUA, ESGOTO E SANEAMENTO" com limite antes de "TENSÃO")
- Corrigiu Valor Total ("R$ 1.485,23")
- Corrigiu Nota Fiscal, Tipo, Concessionaria, Modalidade Tarifária, Subgrupo, Ano Leitura
- Removeu config "output: standalone" do next.config.ts
- Descobriu que servidor precisa de --max-old-space-size=1024 para uploads via Caddy
- Criou start-server.cjs com auto-restart

Stage Summary:
- 15/15 campos validados: 100% correto
- 17/39 campos extraídos no total (44% - os restantes são para tarifas Azul/Verde)
- App acessível via preview (Caddy port 81 -> localhost:3000)
- Upload de PDF funcionando via proxy Caddy
---
Task ID: 1
Agent: main
Task: Fix AZUL/VERDE split tariff PDF extraction - Itens da Fatura table data was not being extracted

Work Log:
- Read and analyzed broken energisa-extractor.ts (syntax errors at lines 267-284: mismatched variable names, missing braces, undeclared variables)
- Removed broken table data parsing block, replaced with clean override block before return statement
- Changed function signature to accept optional tableData parameter
- Rewrote energisa-table-extractor.ts: fixed Y-tolerance (±1 instead of ±3), changed from stream-order to position-order processing, added header calibration from actual column positions, proper row grouping
- Fixed Fora/Ponta regex ambiguity (greedy .* was matching both labels)
- Added table extraction call with 10s timeout in server.cjs
- Set pdfjs-dist worker path for Node.js compatibility

Stage Summary:
- AZUL PDF (4167605165): ConsumoPonta=997,00, ConsumoFP=8.356,14, DemandaMedPonta=29,32, UltrapassagemPonta=0,68 - all correct
- CONVENCIONAL PDF (356205159): no regression, extracts correctly
- GDI PDFs (7929105158, 7948705165): no regression, embedded R$ extraction still works
- Extraction rate improved from 40% to 58% for AZUL PDFs
- Server stable through multiple sequential requests
---
Task ID: 1
Agent: main
Task: Corrigir valores extraídos das faturas Energisa

Work Log:
- Analisou a extração atual: apenas 35-47% dos campos eram extraídos (17-20 de 43)
- Identificou que o table extractor (pdfjs-dist) não estava integrado na API route
- Identificou que Vencimento nunca era extraído (padrão DD/MM/YYYYR$ não era detectado)
- Identificou que ValorTotal usava TOTAL: (ICMS) em vez do valor real da fatura
- Identificou bug: bloco duplicado de Ultrapassagem com variáveis erradas
- Reescreveu energisa-extractor.ts com correções em Vencimento, ValorTotal, Cidade, UC, Subgrupo
- Reescreveu route.ts para integrar table extractor via createRequire + Function constructor
- Corrigiu bug do Turbopack que substituía require() por stub
- Corrigiu bloco duplicado de Ultrapassagem que sobrescrevia DemandaMedida
- Corrigiu lógica de Consumo para Convencional vs AZUL/VERDE
- Removeu PIS/COFINS override do table (valores combinados, não individuais)

Stage Summary:
- Extração melhorou de ~37% para ~50% médio (28-70% por fatura)
- Vencimento: agora 100% (era 0%)
- ValorTotal: agora 100% correto
- Consumo/Demanda/Ultrapassagem/Reativa: extraídos via table extractor
- Valores R$: corretos para todas as faturas AZUL

---
Task ID: 2
Agent: Main Agent
Task: Adicionar 4 campos de Demanda Não Consumida e corrigir separação Ultrapassagem

Work Log:
- Adicionou 4 novos campos: DemandaNaoConsumidaPonta, DemandaNaoConsumidaForaPonta, ValorNaoConsumidaPonta, ValorNaoConsumidaForaPonta
- Atualizou energisa-extractor.ts e energisa-fields.ts com novos campos, labels e categorias
- Separou regex de Ultrapassagem (exclui Não Consumida) do novo regex de Demanda Não Consumida
- Corrigiu valores 0,78 e 12,49 que apareciam como Ultrapassagem em vez de Não Consumida
- Adicionou suporte a abreviação "F Ponta" na extração por texto

Stage Summary:
- 4 novos campos extraídos corretamente (Demanda Não Consumida Ponta/Fora Ponta + Valores)
- Ultrapassagem vs Não Consumida separados corretamente

---
Task ID: 3
Agent: Main Agent
Task: Estabilizar servidor no contêiner Kubernetes

Work Log:
- Investigou por que Node.js e Python morriam após 15-120s no contêiner
- Descobriu que processos órfãos eram eliminados pelo contêiner
- Tentou: nohup, setsid, disown, signal ignoring, loops de restart - todos falharam
- Criou daemon-server.py com double-fork para daemonização UNIX completa
- O daemon sobrevive porque é adotado pelo PID 1 (tini) como processo independente
- Corrigiu bug em server.py: os.path.join com caminho absoluto ignorava o base path
- Adicionou allow_reuse_address/allow_reuse_port ao HTTPServer
- Atualizou dev.sh para usar daemon-server.py

Stage Summary:
- Servidor estável com daemon de double-fork (PPID=1, sessão própria)
- Todos os assets estáticos (HTML, CSS, JS, WOFF2) servidos com HTTP 200
- Proxy Caddy (porta 81 → 3000) funcionando corretamente
- API endpoints de extração e exportação prontos

---
Task ID: 4
Agent: Main Agent
Task: Corrigir extração de Energia Atv Injetada GDI mUC (kWh e R$)

Work Log:
- Analisou imagem da fatura com VLM: identificou 3 linhas mUC (4,00 + 1.229,00 + 18,00 kWh) e 1 linha Consumo Faturado (1.351,00 kWh)
- Identificou bug principal: extractGDI (text-based) executava ANTES do loop da tabela, e o loop da tabela ADICIONAVA ao valor text-based errado em vez de recomeçar do zero
- Identificado que a 4ª linha mUC pode ter label truncado ("KWH" ou vazio) na tabela, não sendo reconhecida pelo regex
- Refatorou extração GDI na tabela: criou acumuladores separados (tbl_oUC_Qtd, tbl_mUC_Qtd, etc.) que começam vazios
- Adicionou rastreamento de seção GDI (inGDISection, gdiSectionType) para capturar linhas com label truncado
- Linhas com label "KWH" ou vazio dentro da seção GDI são acumuladas ao último tipo (oUC ou mUC)
- Valores da tabela só sobrescrevem os text-based se forem encontrados (fallback preservado)
- Atribuiu EnergiaAtvInjetadaGDImUC_Valor corretamente com sinal negativo via fmtSumBR

Stage Summary:
- GDI mUC kWh agora soma corretamente todas as linhas: 4,00 + 1.229,00 + 18,00 = 1.251,00
- GDI mUC R$ agora é extraído: -4,34 + -1.336,12 + -19,56 = -1.360,02
- Linhas com label truncado na tabela são capturadas por heuristic de seção GDI
---
Task ID: 1
Agent: main
Task: Fix extraction bugs for Mês Referência, Ano Leitura, and Demanda Contratada in Energisa PDF extractor

Work Log:
- Identified bug: Mês Referência extracted "Dezembro / 2025" instead of "Fevereiro / 2026" due to fallback strategies matching "Referência: 12/2025" from history table
- Identified bug: Demanda Contratada values swapped/missing due to pdf-parse column reordering
- Added Strategy 1b for date+R$+month/year pattern (pdf-parse reordering)
- Added isConsistentWithVencimento() validation to filter wrong month/year matches
- Added Strategy 5 (Leitura Atual date) for MesReferencia fallback
- Improved Strategy 4 to skip "Referência:" and "Ref" contexts
- Added Strategy 6-7 with consistency validation for numeric MM/YYYY patterns
- Fixed AnoLeitura to handle garbled pdf-parse text
- Rewrote Demanda Contratada extraction with 4 strategies: same-line values, reordered bottom-line pattern (Fora Ponta: before KW Ponta:), normal-order pattern, nearby-lines labels
- Added require cache clearing in app.cjs to always load latest compiled extractor
- Recompiled CJS with esbuild

Stage Summary:
- All 20 PDFs now extract correct Mês Referência and Ano Leitura values
- 9888705108.PDF: DemandaContratadaPonta=15,3, DemandaContratadaForaPonta=30 (was empty/15,3)
- Mês Referência for 9888705108.PDF: Junho / 2026 (was "Dezembro / 2025" or "Abril / 2026")
- Updated dist/energisa-extractor.cjs with all fixes
---
Task ID: fix-grupob-ui-visibility
Agent: main
Task: Fix ConsumoGrupoB_kWh and ConsumoGrupoB_Valor fields not appearing in the web UI

Work Log:
- Investigated why new Grupo B fields were not visible in the app
- Confirmed the fields ARE in energisa-fields.ts (FIELD_LABELS and FIELD_CATEGORIES)
- Confirmed the Next.js build includes the new fields in the JavaScript chunk
- Confirmed the API endpoint returns correct values for Grupo B PDFs
- Identified root cause: HTML page was served with Cache-Control: public, max-age=31536000, immutable
- This caused browsers to cache the HTML for 1 year, never picking up the new JS chunk references
- Fixed app.cjs: sendCachedFile now accepts isHtml parameter
- HTML pages now use Cache-Control: no-cache, no-store, must-revalidate + Pragma: no-cache
- JS/CSS/font assets still use immutable caching (content-hashed filenames)
- Rebuilt Next.js app and restarted server
- Verified API returns ConsumoGrupoB_kWh=4.546,00 and ConsumoGrupoB_Valor=5.936,87 for B3 PDFs
- Verified Grupo A PDFs correctly return empty Grupo B fields

Stage Summary:
- Fixed browser caching issue that prevented new fields from appearing
- HTML pages no longer cached immutably — browser will always fetch fresh HTML
- Server restarted with correct cache headers
- Grupo B extraction verified working for all test PDFs

---
Task ID: 5
Agent: Main Agent
Task: Corrigir extração de Consumo e Demanda para faturas Elektro/Energisa Grupo A Horária Verde

Work Log:
- Identificou bug: findNumNearLine pegava preço unitário (0,61) ao invés do consumo em kWh para tarifas Verde/Azul
- Reescreveu lógica de consumo para tarifas split: Strategy 1 (KWH+value) → Strategy 2 (compressed data) → Strategy 3 (findNumNearLine com validação >= 10 kWh)
- Melhorou parsing de dados comprimidos: heurística de prefix tenta do maior (3) ao menor (0), com validação de razão ForaPonta/Ponta (0.1-20)
- Adicionou suporte a "Demanda Todos os Período" para Horária Verde: valor único atribuído a ambas DemandaContratadaPonta e DemandaContratadaForaPonta
- Para tarifa Verde: se só uma demanda encontrada, atribui a ambas (Ponta e Fora Ponta) pois na Horária Verde a demanda é igual para todos os períodos
- Adicionou lógica similar para DemandaMedida, DemandaFaturada e ValorDemanda na tarifa Verde
- Recompilou CJS e testou: Verde PDFs corretos, AZUL sem regressão, Convencional sem regressão
- Reiniciou servidor e testou via API: valores corretos retornados

Stage Summary:
- 8092005187.PDF (VERDE A4): ConsumoPonta=1.198,96, ConsumoForaPonta=10.900,10, DemandaContratadaPonta=61, DemandaContratadaForaPonta=61 (era 0,61 / 0,61 / vazio / 61)
- 33836.PDF (VERDE A4): ConsumoPonta=2.281,28, ConsumoForaPonta=27.674,02, DemandaContratadaPonta=69, DemandaContratadaForaPonta=69 (era 826,44 / 826,44 / vazio / 69)
- "Demanda Todos os Período" agora suportado para Elektro/Energisa Horária Verde
- Zero regressões em PDFs AZUL e Convencional

---
Task ID: 1
Agent: main
Task: Fix Elektro Group A HORÁRIA VERDE extraction - values not being extracted

Work Log:
- Explored project structure and identified extraction pipeline: app.cjs → dist/energisa-extractor.cjs → extractEnergisaData()
- Found root cause #1: ModalidadeTarifaria regex `HOR[ÁA]RIO` didn't match Portuguese feminine form "HORÁRIA" (only matched "HORÁRIO")
- Found root cause #2: Text-based consumption extraction failed when labels and values were on the same line (e.g., "Consumo em kWh - Ponta KWH 1.346")
- Found root cause #3: Demanda Todos os Período extraction could miss value when "- kW" suffix was present on same line
- Fixed regex: `HOR[ÁA]RIO` → `HOR[ÁA]RI[OA]` to match both HORÁRIO and HORÁRIA
- Added Strategy 3a: Extract consumption values from same line when label contains "KWH" followed by number
- Improved Strategy 4d: Better handling of "Demanda Todos os Período - kW 37" pattern
- Fixed corrupted known-ucs.ts file (had stray text appended)
- Rebuilt dist/energisa-extractor.cjs and Next.js app
- Restarted production server
- Verified: ConsumoPonta=1.346, ConsumoForaPonta=12.929, Demanda=37, ModalidadeTarifaria=HORÁRIO VERDE
- All existing Energisa PDFs still work correctly

Stage Summary:
- Fixed 3 extraction bugs for Elektro Group A HORÁRIA VERDE tariff
- ModalidadeTarifaria now correctly detected as "HORÁRIO VERDE" (was "VERDE")
- Consumption values now extracted in text-only mode (was empty without table data)
- Demanda Todos os Período now extracted from more format variations
- Server restarted with updated extraction code
