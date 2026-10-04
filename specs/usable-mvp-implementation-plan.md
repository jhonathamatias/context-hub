# Plano curto — Usable MVP Hybrid Pipeline

Data: 2026-10-04. Spec: `usable-mvp-hybrid-knowledge-pipeline.md`.

## Pipeline atual vs desejado

```text
ATUAL (legacy):
  ingest → extract audio → Whisper → text knowledge → embed → READY

ATUAL (multimodal):
  ingest → full-video Gemini → synthetic chunks → embed → READY

DESEJADO (hybrid — default MVP):
  ingest → extract → Whisper → text knowledge
    → detect → rank → Top≤3 remote/local clips → clip multimodal
    → merge → (visual chunks) → embed → READY
```

## Reutilizar

- `HeuristicVisualCandidateDetector` / `RuleBasedVisualCandidateRanker`
- `extractTop3Clips` + byte-counting proxy (POC → chamado só pelo serviço de produção)
- `analyzeVisualClip` (adapter de clip; Gemini não sobe para o job layer)
- `StructuredLessonKnowledge`, `EmbeddingService`, `SourceIndexService`, lesson UI + chat/RAG

## Alterar

- `VIDEO_PROCESSOR=hybrid` (+ migration `VISUAL_ENRICH`)
- Job `visual.enrich` após `knowledge.extract`
- `src/visual-enrichment/*` (orquestração + merge + select Top N)
- Persist `ingest-origin.json` (shareUrl/itemId, sem token) para remote seek
- UI: itens timed + insights visuais + status “Analisando trechos visuais”
- Schema: `visualInsights[]` opcional

## Dívida consciente (fora desta entrega)

- Ingest OneDrive ainda baixa o arquivo (Whisper precisa de áudio local)
- Heurísticas do detector ainda são musicalmente enviesadas (não refatorar agora)
- Top 5 / HIGH-all / agentic / object storage
- Timestamps relativos fracos do modelo de clip
- Troca de ORM/queue/banco

## Soft-fail

Falha visual → stage FAILED/skipped, texto preservado, pipeline segue para embed/READY.
