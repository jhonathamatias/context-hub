# Análise — POC 3 Remote Clip + Multimodal Value

Documento autocontido para revisão externa.  
Specs: `specs/remote-clip-multimodal-value-poc.md` + `specs/remote-clip-multimodal-value-poc-execution.md`.  
Data: 2026-10-04.

**Esta execução NÃO repetiu full-video multimodal.** Somente Top 3 clips.

---

## Perguntas obrigatórias

| # | Pergunta | Resposta nesta execução |
|---|----------|-------------------------|
| 1 | Conseguimos extrair Top 3 do OneDrive via remote seek sem baixar o arquivo inteiro? | **UNPROVEN / FAILED no OneDrive** (sem token Graph válido). Em simulação HTTP Range local, FFmpeg `-c copy` **não** evitou transferência grande. |
| 2 | Top 3 multimodais produzem info visual nova vs transcript? | **Não respondida ainda** — Gemini free tier 429 (~21h). Clips + transcripts prontos para rerun. |

---

## A. Remote access

```text
Source: 5fe720dc-d4a4-42dd-81be-f236a3eea095
REMOTE SEEK RESULT: SIMULATED (OneDrive: not resolved)
Full download avoided: UNPROVEN (OneDrive) / NO (simulated transfer)

Original video size: 461,698,570 bytes (~441 MiB local original.mp4)
Transferred bytes (proxy, sum of 3 extracts): 659,095,552 (~142.75% of original)
Transfer ratio: 142.75%
Clip output bytes: 12,557,279 (~2.72% of original)
Extraction time: 666 ms
```

### Por clip

| Rank | Window | Duration | Output bytes | Transferred bytes | Extract ms | Codec |
|------|--------|----------|--------------|-------------------|------------|-------|
| 1 | 36:39→37:33 | 54s | 6,545,498 | 47,710,208 | 228 | copy |
| 2 | 31:57→32:19 | 22s | 3,019,501 | 207,093,760 | 200 | copy |
| 3 | 32:35→32:57 | 22s | 2,992,280 | 404,291,584 | 238 | copy |

### HTTP Range evidence (local simulation proxy)

```text
Accept-Ranges: bytes
HEAD: 200
Range GET: 206 Partial Content
Content-Range: bytes 0-1023/461698570
supportsPartialContent: true
```

### OneDrive

```text
POC_ONEDRIVE_INTEGRATION_ID not set / integration token 401 when tried earlier
→ playback URL not resolved
→ REMOTE SEEK on real OneDrive CDN: NOT TESTED
```

### Evidência crítica

- **Clip output pequeno ≠ poucos bytes transferidos.**
- Com FFmpeg `-ss` (input seek) + `-c copy` via proxy Range-aware, a soma transferida **ultrapassou** o tamanho do arquivo (leituras repetidas / seek ineficiente / moov).
- Portanto, mesmo com Range HTTP comprovado, **não** podemos afirmar “full download avoided: YES” para este método.

Artifact Phase 1:

```text
/tmp/poc-remote-clips/5fe720dc-…/<run>/phase1.json
(container: /app/tmp/poc-remote-clips/…)
```

---

## B. Multimodal

```text
Status: BLOCKED — Gemini 429 free tier (20 req/day, gemini-3.8-flash)
Retry delay reported: ~20h51m
```

Clips estão no disco; Phase 2 pode rerodar sem re-extrair:

```bash
docker compose exec -T node pnpm poc:multimodal-clips 5fe720dc-d4a4-42dd-81be-f236a3eea095
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
Full video duration: ~69m52s
Top 3 duration: ~1m38s (98s)

Full-video baseline tokens: ~384k (Talisson) / ~410k (segundo vídeo)
Top-3 tokens: NOT MEASURED (quota)
Token ratio: n/a
Token reduction: n/a

Original file bytes: 461,698,570
Transferred bytes for Top3 extraction (simulated): 659,095,552
Transfer ratio: 142.75%  ← worse than full local read once
Clip output ratio: 2.72%
```

---

## D. Avaliação qualitativa (parcial)

1. **Clips com info visual nova?** — Indeterminado (sem multimodal).
2. **O que Whisper perde?** — Indeterminado; transcript já cita região/formato/desenho.
3. **Invenção multimodal?** — n/a
4. **Resolução suficiente?** — Clips gerados com `-c copy` (~12 MB total); avaliação visual humana possível localmente; Gemini não viu.
5. **Timestamps absolutos?** — Conversão implementada; não exercitada sem findings.
6. **Ranker escolheu bons trechos?** — Transcripts dos Top 3 são fortemente espaciais → ranking parece correto a priori.
7. **#1 score 7 justificou o topo?** — Transcript mais rico (formato/desenho/C7/direções) → sim como hipótese.
8. **Remote seek evitou download completo?** — **Não comprovado no OneDrive.** Na simulação, **não** (transfer > 100%).
9. **Maior gargalo?** — (1) auth OneDrive / (2) ineficiência de seek FFmpeg+copy / (3) cota Gemini.
10. **Avançar Top 5 / HIGH?** — **Não** até Phase 2 responder valor visual e seek remoto ser resolvido.

---

## E. Decisão

```text
ITERATE
```

### Justificativa

1. **Parte A (transferência):** evidência útil — Range HTTP funciona, mas o método FFmpeg `-c copy` usado **não** economiza bytes (chegou a transferir mais que o arquivo). OneDrive real não foi testado (token). Não há GO em “remote seek evita download”.
2. **Parte B (valor multimodal):** não executada por **429**. Clips e transcripts estão salvos; não se pode concluir valor visual ainda.
3. Há sinal de que o **ranking** aponta trechos certos (transcript espacial), e clips de saída são só ~2.7% do arquivo — mas isso sozinho não prova economia de rede nem ganho multimodal.

### Próximos passos concretos (sem expandir escopo)

1. Token Graph válido → `POC_ONEDRIVE_INTEGRATION_ID` + item → reexecutar `pnpm poc:remote-clips` e medir CDN real.
2. Experimentar seek que reduza bytes (ex. remux segmentado, `-c copy` com index, ou download só de ranges planejados) — só medindo proxy.
3. Após reset de cota: `pnpm poc:multimodal-clips` nos artifacts existentes (sem full-video).

---

## Como executar

```bash
# Phase 1 — NO Gemini
docker compose exec -T node pnpm poc:remote-clips 5fe720dc-d4a4-42dd-81be-f236a3eea095

# Optional real OneDrive:
# POC_ONEDRIVE_INTEGRATION_ID=... POC_ONEDRIVE_ITEM_ID=... pnpm poc:remote-clips ...

# Phase 2 — Top 3 only (uses GEMINI_API_KEY; no full video)
docker compose exec -T node pnpm poc:multimodal-clips 5fe720dc-d4a4-42dd-81be-f236a3eea095
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
Hoje temos evidência parcial de (1) e bloqueio de (2) por cota.
