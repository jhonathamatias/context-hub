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
| 2 | Top 3 multimodais produzem info visual nova vs transcript? | **YES (com nuance)** — 3/3 clips: `losesImportantInfoWithoutVideo=true`; findings classificados `NEW_VISUAL_INFORMATION` (shapes/região do braço). Não retornou casas numéricas concretas. |

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

## B. Multimodal (Phase 2 OK)

```text
Status: OK
Model: gemini-3.1-flash-lite (POC clips; 3.8-flash estava em 503 / JSON truncado)
Source clips: remote OneDrive Top3 (2913adff-…)
Whisper baseline: 5fe720dc (Top3 windows hard-coded do ranking; source remoto sem Whisper)
Artifact: …/1791083496437/phase2.json
```

### Por clip

| Clip | Window | Findings (NEW_VISUAL) | Loses w/o video | Tokens | Duration |
|------|--------|----------------------|-----------------|--------|----------|
| 1 | 36:39→37:33 | 2 — C7 shapes higher/lower frets | **true** | 5658 | 34s |
| 2 | 31:57→32:19 | 3 — chord shapes lower/mid/higher neck | **true** | 3307 | 22s |
| 3 | 32:35→32:57 | 2 — fingering + fretboard movement | **true** | 3426 | 19s |

**Clip 1 highlights:** C7 shape on higher frets (teacher) vs different C7 on lower frets (student).  
**Clip 2 highlights:** positions on two guitars + octave hand shift.  
**Clip 3 highlights:** left-hand fingering pattern + movement along neck.

Nuance: findings são qualitativos (região/shape), **sem casas numéricas** tipo “casa 8”. Transcript já falava “formato/região/braço”; o multimodal confirma e ancora no que se *vê* (dois shapes C7, mid-neck Ibanez, shift de oitava).

---

## C. Comparação global

```text
Full video duration: ~69m52s (mesmo ranking Top 3; fonte OneDrive 1.58 GB)
Top 3 duration: ~1m38s (98s)

Full-video baseline tokens: ~410k (video1240787473 full multimodal anterior)
Top-3 tokens: 12,391
Token ratio vs 410k: 3.02%
Token reduction vs 410k: ~97.0%
Token ratio vs 384k: 3.23%
Token reduction vs 384k: ~96.8%

Original file bytes: 1,585,633,066
Transferred bytes for Top3 extraction (OneDrive CDN): 231,292,928
Transfer ratio: 14.59%  ← ~85% menos que download completo
Clip output ratio: 2.80%
```

---

## D. Avaliação qualitativa

1. **Clips com info visual nova?** — **Sim** (3/3 `NEW_VISUAL_INFORMATION`; `losesImportantInfoWithoutVideo=true`). Granularidade média (sem nº de casa).
2. **O que Whisper perde?** — Digitização/shapes concretos e *qual* região do braço está sendo mostrada no momento; fala só “dessa forma / nessa região”.
3. **Invenção multimodal?** — Baixo risco aparente (sem frets inventados); clip 3 summary menciona “slowing down a video” (possível ruído).
4. **Resolução suficiente?** — Sim para shapes/região com `-c copy` remoto.
5. **Timestamps absolutos?** — Implementados; modelo quase sempre devolveu só início relativo (~0s).
6. **Ranker escolheu bons trechos?** — Sim — todos os Top 3 renderam valor visual.
7. **#1 score 7 justificou o topo?** — Sim (C7 shapes distintos teacher/student; mais tokens e findings ricos).
8. **Remote seek evitou download completo?** — **YES** (14.59%).
9. **Maior gargalo residual?** — 503/`gemini-3.8-flash` flaky; clip seek overhead (clip3 ~114 MB/22s); Whisper ausente no source remoto.
10. **Avançar Top 5 / HIGH?** — Opcional; Top 3 já prova tese. Só expandir se product precisar cobertura.

---

## E. Decisão

```text
GO
```

### Justificativa

1. **Parte A:** remote seek OneDrive real **14.59%** transfer — full download avoided YES.
2. **Parte B:** Top 3 multimodal **~12.4k tokens (~3% do full-video)** com findings visuais novos vs transcript em 3/3 clips.
3. Caveats aceitos para GO de tese (não de produção): model flash-lite nos clips; Whisper baseline do ranking source; findings sem casas numéricas; timestamps relativos fracos.

### Próximos passos (fora do escopo mínimo da POC)

1. Em produção: Whisper por source (ou ASR do próprio clip) antes do compare.
2. Opcional: melhorar seek do clip 3 / pedir frets explícitos no prompt se o domínio exigir.
3. Não repetir full-video multimodal para esses Top 3 — evidência já fecha a pergunta de valor.

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
**(1) OneDrive 14.59%. (2) Top3 ~12.4k tokens com NEW_VISUAL em 3/3. Decisão: GO.**
