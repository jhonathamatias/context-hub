# Análise — execução Video Knowledge Provider POC (vídeo novo)

Documento autocontido para revisão externa (GPT / peer review).  
Spec: `specs/video-knowledge-provider-poc.md`.  
Análise da implementação anterior: `specs/video-knowledge-provider-poc-analysis.md`.  
Data do run: 2026-10-03 / 2026-10-04 (UTC).

---

## 1. Contexto

Esta execução validou o adapter multimodal já implementado (`@google/genai`, knobs `static|agentic` + `mediaResolution`, file-ref cache, retries BullMQ) em um **segundo vídeo de aula**, ingerido via OneDrive com token Graph temporário.

Não houve mudança arquitetural nesta rodada — só ingest + medição A/B (C/D bloqueados por cota).

---

## 2. Source / vídeo

| Campo | Valor |
|--------|--------|
| sourceId | `2913adff-2332-40fb-9303-6c23eda1f463` |
| Nome | `POC video1240787473.mp4` (OneDrive: `video1240787473.mp4`) |
| Tamanho | ~1.58 GB (1 585 633 066 bytes) |
| Link | `https://1drv.ms/v/c/e2849fb0d7807182/IQAfWT7FNcT_RqmGGPAYiokVAZdOY37n-RdFcerWmJt1_WE` |
| Pipeline | `VIDEO_PROCESSOR=multimodal` |
| Provider | `VIDEO_KNOWLEDGE_PROVIDER=gemini` |
| Model | `gemini-3.8-flash` |

### Ops necessárias para ingest

1. Integração OneDrive temporária criada com token Graph (token **limpo depois** da execução).
2. `MAX_UPLOAD_BYTES` elevado de 1 GiB → **2 GiB** (arquivo > 1 GB).
3. Download OneDrive (~15+ min) → multimodal.analyze → embeddings → index.

---

## 3. Cenários A/B/C/D

### A — baseline (`static` / `default`) — **SUCESSO**

Telemetry (worker log `Video knowledge analysis telemetry`):

| Métrica | Valor |
|---------|--------|
| processingMode | static |
| mediaResolution | default |
| durationMs | **191 087** (~3m 11s) |
| fileReuse | **true** (attempt 2; reuso após retry BullMQ) |
| inputTokens | **406 802** |
| outputTokens | **2 354** |
| totalTokens | **409 992** |
| attempt | 2 / max 4 |

**Conhecimento produzido (antes do retry B):**

- Título: *Expressividade em Bends, Transposição de Frases e Estruturação de Ideias*
- Summary ~445 chars (Guthrie Govan–style expressiveness, bends, rhythmic precision, arpeggio transposition)
- Contagens: topics 7, concepts 4, techniques 5, theoryHarmony 3, scalesArpeggiosChords 3, exercises 4, licksOrPracticalIdeas 3, teacherRecommendations 4, reviewQuestions 4
- Chunks/embeddings: **37** (persistiram após falha do B)

Source ficou **READY** após A.

### B — `static` / `low` — **FALHOU (quota)**

- Reenqueue `POST /sources/.../multimodal` com `GEMINI_VIDEO_MEDIA_RESOLUTION=low`
- Falha rápida com **429** free tier:

```text
Quota exceeded … generate_content_free_tier_requests
limit: 20 / day
model: gemini-3.8-flash
retry in ~21h
```

- Sem telemetry útil de tokens para B
- Source marcada **FAILED**; knowledge status FAILED (payload A deixou de ser exposto pelo endpoint `/knowledge`)

### C — agentic / default — **não medido** (cota)

### D — agentic / low — **não medido** (cota)

---

## 4. Tabela comparativa

| Cenário | Mode / Res | Duração | Input | Output | Total | fileReuse | Resultado |
|---------|------------|---------|-------|--------|-------|-----------|-----------|
| **A** | static / default | 191 s | 406 802 | 2 354 | 409 992 | true | OK — knowledge rico |
| **B** | static / low | — | — | — | — | — | 429 quota |
| **C** | agentic / default | — | — | — | — | — | não rodado |
| **D** | agentic / low | — | — | — | — | — | não rodado |

### Comparação com aula Talisson (POC anterior)

| Aula | sourceId (prefix) | Total tokens (A) |
|------|-------------------|------------------|
| Talisson Modo Jônio | `5fe720dc…` | ~384 k |
| video1240787473 (bends/expressividade) | `2913adff…` | ~**410 k** |

Mesma ordem de grandeza: multimodal full-video continua caro (~0.4M tokens/aula longa).

---

## 5. Observações técnicas

1. **File-ref cache funcionou** — `fileReuse: true` no attempt 2 do A (upload não repetido no retry).
2. **Resiliência BullMQ** — 429 transitórios durante A foram retentados; tentativa bem-sucedida na attempt 2.
3. **Cota free 20/dia** continua o gargalo para A/B/C/D na mesma sessão.
4. **Retry B sobrescreveu status** da source para FAILED; embeddings/chunks do A (37) permaneceram.
5. Token OneDrive temporário **não permanece** na integração (`clearAccessToken` após o run).
6. Env restaurado: `GEMINI_VIDEO_PROCESSING_MODE=static`, `GEMINI_VIDEO_MEDIA_RESOLUTION=default`.

---

## 6. Estado atual da source

```text
status: FAILED
knowledge: FAILED (mensagem: Gemini temporariamente indisponível / 429)
chunks: 37
embeddings: 37
```

Para restaurar após reset de cota:

```bash
# env: static + default
docker compose up -d --force-recreate worker
curl -X POST http://127.0.0.1:3000/sources/2913adff-2332-40fb-9303-6c23eda1f463/multimodal
```

Para medir B (low) depois, alterar só `GEMINI_VIDEO_MEDIA_RESOLUTION=low` e repetir o POST.

---

## 7. Conclusões

1. O provider agnóstico + adapter Gemini processou com sucesso um segundo vídeo real (~1.6 GB OneDrive).
2. Custo multimodal full-video nesta amostra: **~410k tokens** — reforça a estratégia das POCs de candidatos visuais / ranking / clips.
3. `media_resolution=low` **ainda não foi medido** neste vídeo (quota). Na Talisson, low ≈ default em input tokens.
4. Próximo passo de medição multimodal neste vídeo: B quando cota resetar; C/D só se API agentic estiver estável e houver quota.

---

## 8. Perguntas abertas para o revisor

1. Vale insistir em A/B de `low` neste segundo vídeo, ou priorizar Top-5 clips da POC de ranking?
2. Com ~410k tokens/aula, o free tier (20 req/dia) é inviável para iteração — paid tier é pré-requisito?
3. O fato de B failed apagar a exposição do knowledge A no API é aceitável, ou o soft-fail deveria preservar o último COMPLETED?

---

## 9. Princípio

Gemini continua sendo só o adapter. Esta execução confirma o caminho multimodal end-to-end (OneDrive → storage → Files API → `StructuredLessonKnowledge` → embeddings) e o custo alto do vídeo inteiro — alinhado a enviar só candidatos visuais ranqueados na próxima fase.
