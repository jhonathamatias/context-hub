# Análise — Usable MVP / Hybrid Knowledge Pipeline

Data: 2026-10-04  
Spec: `specs/usable-mvp-hybrid-knowledge-pipeline.md`  
Plano: `specs/usable-mvp-implementation-plan.md`

## Decisão

```text
USABLE MVP: PASS
```

Com ressalvas documentadas abaixo (dívida consciente), o fluxo híbrido está utilizável: Whisper → conhecimento textual → detect/rank → clips → multimodal seletivo → merge → index → READY → UI/chat com timestamps.

---

## Arquitetura final

```text
Source
  → ingest (OneDrive/local; origin persistido sem token)
  → video.extract
  → transcription.run (Whisper)
  → knowledge.extract (texto)
  → visual.enrich   [NOVO — soft-fail]
       detect → rank → Top≤N → clip extract (remote preferido / local)
       → analyzeVisualClip → merge → visual chunks
  → embeddings.generate
  → source.index → READY
```

`VIDEO_PROCESSOR=hybrid` (default). `legacy` e `multimodal` permanecem.

## Componentes principais

| Peça | Onde |
|------|------|
| Pipeline map | `src/video-knowledge/pipeline.ts` |
| Job | `visual.enrich` → `VisualEnrichJobHandler` |
| Orquestração | `src/visual-enrichment/visual-enrichment.service.ts` |
| Select Top N | `select-top-candidates.ts` (ranker live — sem Top3 hard-coded) |
| Merge | `merge-visual-knowledge.ts` → `visualInsights` + licks |
| Clip extract / analyze | reuso de `src/poc/remote-multimodal/*` (só atrás do serviço) |
| Origin OneDrive | `ingest-origin.json` (shareUrl/itemId, sem token) |
| UI timed + visual | `apps/web` lesson page + `TimestampLink` |
| Status UX | stage `VISUAL_ENRICH` / “Analisando trechos visuais” |

## Reutilizado das POCs

- Detector + Ranker (`src/visual-candidates`)
- Remote clip extractor + byte proxy + clip analyzer
- Evidência de remote seek / token reduction (não re-POC)

## O que virou produção

- Job + stage `VISUAL_ENRICH`
- Merge no `StructuredLessonKnowledge` (`visualInsights`)
- Chunks `[visual:…]` indexáveis
- Soft-fail visual (texto preservado; pipeline segue)
- Preferência Whisper em enrich/embeddings/getKnowledge COMPLETED

## Diferenças vs POC

| POC | Produção |
|-----|----------|
| Top3 hard-coded (`top3.ts`) | Ranker live + `VISUAL_ENRICH_TOP_N` |
| Whisper baseline de outro source | Proibido — só Whisper do mesmo `sourceId` |
| Script CLI | Job BullMQ na cadeia hybrid |
| Análise solta | Merge + embeddings + UI |

## Tratamento de falha visual

- Erro/clip 503/sem candidatos → job FAILED ou SUCCEEDED+skip message
- `payloadJson` textual **não** é apagado
- Dispatcher sempre enfileira `embeddings.generate` após o handler (handler não throws em soft-fail)

## Validação real

### Aula 1 — Talisson (`5fe720dc-…`)

- Whisper + knowledge textual existentes; `visual.enrich` executado
- 6 `visualInsights` (C7 shapes / fretboard movement ~36:40)
- 6 visual chunks embeddados
- Chat: *“Onde ele mostrou o formato de C7 no braço?”*
  - Resposta cita demonstrações entre **36:40–37:33**
  - Refs com `startSeconds≈2200` e excerpt `[visual:hand position]…`
- Source **READY**; knowledge API **COMPLETED** com insights

### Aula 2 — ScreenRecording (`c5dd4077-…`)

- `visual.enrich` → *No relevant visual candidates* (skip)
- Knowledge textual COMPLETED preservado; Source READY
- Prova soft-skip sem hard-coded POC windows e sem misturar sources

### Chat / timestamps

- Resposta fundamentada em chunks visuais indexados
- Referências com timestamp (deep-link `?t=` + `TimestampLink` na lesson UI)

## Problemas encontrados

1. Sources poluídos por POC multimodal: embeddings pegavam transcription Gemini (32 chunks) em vez do Whisper — **corrigido** (preferir `local-whisper`).
2. `GET /knowledge` devolvia último FAILED vazio — **corrigido** (preferir COMPLETED).
3. Em `5fe720dc`, chunks de transcript Whisper históricos estavam no path multimodal; visual chunks ficaram só no Whisper (6). Em imports **hybrid limpos**, knowledge.extract cria chunks Whisper antes do enrich.
4. Remote seek não exercitado nestas duas aulas (arquivo local já ingerido; path remote permanece para `ingest-origin` + token).

## Dívida consciente

- Ingest OneDrive ainda baixa o arquivo (Whisper precisa de áudio)
- Heurísticas do detector ainda musicalmente enviesadas
- Clip analyzer ainda em `src/poc/` (chamado só pelo serviço de produção)
- Timestamps relativos fracos do modelo de clip
- Top 5 / HIGH-all / agentic / object storage fora de escopo
- Re-chunk Whisper em aulas antigas misturadas com multimodal POC

## Como operar

```bash
# .env
VIDEO_PROCESSOR=hybrid
VISUAL_ENRICH_TOP_N=3

make migrate   # inclui VISUAL_ENRICH
# Import OneDrive/local normalmente — cadeia hybrid roda sozinha

# Reprocessar só visual em source existente:
docker compose exec -T node pnpm tsx scripts/enqueue-visual-enrich.mts <sourceId>
```
