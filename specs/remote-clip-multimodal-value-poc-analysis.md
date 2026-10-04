# Análise — POC 3 Remote Clip + Multimodal Value

Documento autocontido para revisão externa.  
Specs: `specs/remote-clip-multimodal-value-poc.md` + `specs/remote-clip-multimodal-value-poc-execution.md`.  
Data: 2026-10-04.

**Esta execução NÃO repetiu full-video multimodal.** Somente Top 3 clips.

---

## Perguntas obrigatórias

| # | Pergunta | Resposta nesta execução |
|---|----------|-------------------------|
| 1 | Conseguimos extrair Top 3 do OneDrive via remote seek sem baixar o arquivo inteiro? | **YES** — CDN OneDrive real (`my.microsoftpersonalcontent.com`), Range 206, **14.59%** dos bytes do arquivo (~231 MB de ~1.58 GB). |
| 2 | Top 3 multimodais produzem info visual nova vs transcript? | **Ainda pendente** — Gemini free tier 429. Clips remotos já extraídos; Phase 2 pode rerodar sem re-baixar. |

---

## A. Remote access (OneDrive REAL — run com token temporário)

```text
Source: 2913adff-2332-40fb-9303-6c23eda1f463
Video: video1240787473.mp4 (mesmo link OneDrive da POC anterior)
REMOTE SEEK RESULT: OK
Full download avoided: YES

Original video size: 1,585,633,066 bytes (~1.48 GiB)
Transferred bytes (proxy, sum of 3 extracts): 231,292,928 (~220.6 MiB)
Transfer ratio: 14.59%
Clip output bytes: 44,316,161 (~2.80% of original)
Extraction time: 51,712 ms (~52s)
```

### Por clip (remoto)

| Rank | Window | Duration | Output bytes | Transferred bytes | Extract ms | Codec |
|------|--------|----------|--------------|-------------------|------------|-------|
| 1 | 36:39→37:33 | 54s | 19,069,611 | 49,299,456 | 11,021 | copy |
| 2 | 31:57→32:19 | 22s | 12,965,204 | 67,837,952 | 14,909 | copy |
| 3 | 32:35→32:57 | 22s | 12,281,346 | 114,155,520 | 25,782 | copy |

### HTTP Range evidence (OneDrive CDN)

```text
host: my.microsoftpersonalcontent.com
Accept-Ranges: bytes
HEAD: 200
Range GET: 206 Partial Content
Content-Range: bytes 0-1023/1585633066
supportsPartialContent: true
redirects: followed to personal content CDN
```

### Comparação com simulação local anterior (Talisson file)

| | Local Range sim (441 MB file) | OneDrive real (1.58 GB file) |
|--|--|--|
| Transfer ratio | **142%** (pior que ler tudo) | **14.59%** |
| Full download avoided | NO | **YES** |
| REMOTE SEEK | SIMULATED | **OK** |

### Evidência crítica

- Remote seek no CDN OneDrive **funciona** e evita ~85% dos bytes vs download completo.
- Clip output (~2.8%) ≠ transferred (~14.6%) — ainda há overhead de seek/moov, mas muito abaixo de 100%.
- Token Graph temporário foi usado só para o teste e **limpo** das integrações depois.

Artifact Phase 1 (remote OK):

```text
/app/tmp/poc-remote-clips/2913adff-…/1791083496437/phase1.json
```

---

## B. Multimodal

```text
Status: BLOCKED — Gemini 429 free tier (20 req/day, gemini-3.8-flash)
Retry delay reported: ~20h51m
```

Clips remotos estão no disco; Phase 2 pode rerodar sem re-extrair / sem token:

```bash
docker compose exec -T node pnpm poc:multimodal-clips 2913adff-2332-40fb-9303-6c23eda1f463
```

### Transcripts capturados (para revisão / próximo run)

**Clip 1 (36:39–37:33)** — score 7  
> “…olha só está vendo… parte de baixo… alternativas de acordes… C7… dessa forma… esse formato… mesmo desenho… corda lá… tirar essa terça… nona”

**Clip 2 (31:57–32:19)** — score 5  
> “…ficar só nessa região… soar o mesmo acorde em todo o braço… oitava… nesse dó…”

**Clip 3 (32:35–32:57)** — score 5  
> “…lance de penta… dó 7 nesse formato… tônica… sétima… sexta…”

Já no transcript há linguagem espacial (região, braço, formato, desenho). A pergunta 2 exige o multimodal para saber se a **imagem** adiciona casas/shapes/digitação concretas — ainda pendente.

| Clip | Multimodal findings | New visual info | Tokens | Duration |
|------|---------------------|-----------------|--------|----------|
| 1 | FAILED 429 | n/a | n/a | n/a |
| 2 | FAILED 429 | n/a | n/a | n/a |
| 3 | FAILED 429 | n/a | n/a | n/a |

---

## C. Comparação global

```text
Full video duration: ~69m52s (mesmo ranking Top 3; fonte OneDrive 1.58 GB)
Top 3 duration: ~1m38s (98s)

Full-video baseline tokens: ~410k (video1240787473 full multimodal anterior)
Top-3 tokens: NOT MEASURED (quota)
Token ratio: n/a
Token reduction: n/a

Original file bytes: 1,585,633,066
Transferred bytes for Top3 extraction (OneDrive CDN): 231,292,928
Transfer ratio: 14.59%  ← ~85% menos que download completo
Clip output ratio: 2.80%
```

---

## D. Avaliação qualitativa (parcial)

1. **Clips com info visual nova?** — Indeterminado (sem multimodal).
2. **O que Whisper perde?** — Indeterminado; transcript já cita região/formato/desenho.
3. **Invenção multimodal?** — n/a
4. **Resolução suficiente?** — Clips remotos ~44 MB total (`-c copy`); Gemini não viu ainda.
5. **Timestamps absolutos?** — Conversão implementada; não exercitada sem findings.
6. **Ranker escolheu bons trechos?** — Transcripts dos Top 3 são fortemente espaciais → ranking parece correto a priori.
7. **#1 score 7 justificou o topo?** — Transcript mais rico (formato/desenho/C7/direções) → sim como hipótese.
8. **Remote seek evitou download completo?** — **YES** no OneDrive real (14.59% transferidos). Simulação local anterior era enganosa (142%).
9. **Maior gargalo agora?** — Cota Gemini (Phase 2). Auth OneDrive só precisa de token temporário por run.
10. **Avançar Top 5 / HIGH?** — **Não** até Phase 2 responder valor visual.

---

## E. Decisão

```text
ITERATE
```

### Justificativa

1. **Parte A (transferência):** **GO parcial** — remote seek OneDrive comprovado: Range 206 no CDN, **14.59%** dos bytes, full download avoided YES. Simulação local (142%) não representa o CDN.
2. **Parte B (valor multimodal):** ainda **bloqueada por 429**. Sem isso a POC 3 não fecha.
3. Ranking + clips remotos prontos; falta só medir tokens/findings visuais nos Top 3.

### Próximos passos concretos (sem expandir escopo)

1. Após reset de cota: `pnpm poc:multimodal-clips 2913adff-…` nos clips já extraídos (sem full-video, sem novo download).
2. Opcional: reduzir overhead de seek (clip 3 transferiu ~114 MB para 22s) — só se Phase 2 justificar investir.

---

## Como executar

```bash
# Phase 1 — NO Gemini (OneDrive: POC_ONEDRIVE_SHARE_URL + POC_ONEDRIVE_ACCESS_TOKEN [+ ITEM_ID])
docker compose exec -T node pnpm poc:remote-clips 2913adff-2332-40fb-9303-6c23eda1f463

# Phase 2 — Top 3 only (uses GEMINI_API_KEY; no full video; no OneDrive token needed)
docker compose exec -T node pnpm poc:multimodal-clips 2913adff-2332-40fb-9303-6c23eda1f463
```

### Código

```text
src/poc/remote-multimodal/*
scripts/poc-remote-clips.mts
scripts/poc-multimodal-clips.mts
package.json → poc:remote-clips, poc:multimodal-clips
```

Testes determinísticos: Top 3 windows, timestamps absolutos, métricas, classificação de findings (sem rede).

---

## Princípio

Não basta “processar no Gemini”.  
Esta POC só fecha com evidência de: (1) transferência remota real e (2) conhecimento visual que a transcrição perde.  
**(1) está comprovado no OneDrive (14.59%). (2) ainda bloqueado por cota Gemini.**
