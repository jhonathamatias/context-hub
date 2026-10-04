# Análise da POC — Video Knowledge Provider (Context Hub)

Documento autocontido para revisão externa (GPT / peer review).  
Spec original: `specs/video-knowledge-provider-poc.md`.  
Data dos runs: 2026-10-03. Modelo: `gemini-3.8-flash`. Aula: source `5fe720dc-d4a4-42dd-81be-f236a3eea095` (Talisson — Modo Jônio / criação melódica).

---

## 1. Contexto do produto

**Context Hub** processa aulas de guitarra (vídeo) para extrair conhecimento estruturado usável em busca/RAG/chat.

Há dois pipelines:

| Pipeline | Env | O que faz |
|----------|-----|-----------|
| Legacy | `VIDEO_PROCESSOR=legacy` | FFmpeg → Whisper → chunks → embeddings → knowledge LLM (texto) |
| Multimodal POC | `VIDEO_PROCESSOR=multimodal` | Vídeo → `VideoKnowledgeProvider` → `StructuredLessonKnowledge` → Postgres/embeddings |

Esta POC evolui **somente** o caminho multimodal, sem remover Whisper.

Contrato canônico (independente de vendor):

```ts
interface VideoKnowledgeProvider {
  analyze(input: VideoAnalysisInput): Promise<StructuredLessonKnowledge>;
}
```

Implementação atual: `GeminiVideoKnowledgeProvider` (`src/video-knowledge/`).

---

## 2. Objetivo da POC

1. Manter Gemini como **adapter substituível** (sem vazamento no domínio).
2. Migrar o adapter para o SDK atual `@google/genai`.
3. Expor knobs econômicos **só no adapter**: processing mode + media resolution.
4. Preservar cache de file-ref (Gemini Files API) e retries via BullMQ.
5. Medir A/B/C/D na mesma aula (tempo, tokens, qualidade aproximada).
6. Documentar OneDrive I/O sem refactor.

---

## 3. O que foi implementado

### 3.1 Provider selection (composition root)

- Env: `VIDEO_KNOWLEDGE_PROVIDER=gemini`
- Bind em `src/di/register-providers.ts` via token `VIDEO_KNOWLEDGE_PROVIDER`
- Domínio/use cases injetam a interface; não importam `@google/genai`

### 3.2 SDK migration

- De: `@google/generative-ai` (Files Manager legado)
- Para: `@google/genai` (`GoogleGenAI`, `files.upload` / `files.get`, `models.generateContent`)
- Structured output: `responseMimeType: application/json` + `responseSchema` (`gemini-response-schema.ts` com `Type.*` do SDK)
- Prompt curto em `prompt.ts`; schema Gemini isolado do Zod de domínio

### 3.3 Knobs econômicos (adapter-only)

```env
GEMINI_VIDEO_PROCESSING_MODE=static|agentic   # default: static
GEMINI_VIDEO_MEDIA_RESOLUTION=default|low|medium|high  # default: default
```

Mapeamento interno (`gemini-video-config.ts`):

- `static` → `MediaProcessing.STATIC`
- `agentic` → `MediaProcessing.AGENTIC`
- `low|medium|high` → `PartMediaResolutionLevel.MEDIA_RESOLUTION_*`
- `default` → omite o campo (default do modelo)

Nenhuma outra camada conhece esses enums.

### 3.4 Telemetry

Via `onTelemetry` / logs do multimodal service:

- provider, model, sourceId
- processingMode, mediaResolution
- durationMs
- inputTokens / outputTokens / totalTokens (quando a API envia `usageMetadata`)
- fileReuse (boolean)
- retries ficam na política BullMQ (não sleep loop no provider)

### 3.5 File-ref cache (preservado)

- Path: `{STORAGE_DIR}/sources/{sourceId}/gemini-file-ref.json`
- Hash SHA-256 do arquivo local
- Em retry/reprocess: `files.get` + validade → **reuso sem re-upload** (`fileReuse: true` nos runs A/B)
- Novo upload só se cache inválido/expirado/file não ACTIVE

### 3.6 Resiliência

- Erros transitórios 429/503 → normalizados e **bubbled** para BullMQ
- Sem sleep/retry longo dentro do provider
- Sem fallback automático para Whisper
- Correção nesta POC: parsing de `ApiError` do `@google/genai` (status embutido em JSON/mensagem) + extração de texto em respostas agentic

### 3.7 OneDrive (só documentação)

Ver `specs/video-knowledge-provider-poc-onedrive-notes.md`:

- Bytes: download temp → copy storage → hash local → upload Gemini (1ª vez)
- Retry com cache: sem novo upload
- Stream OneDrive→Gemini sem materializar disco: **não implementado** (fora de escopo)

---

## 4. Arquitetura (após POC)

```text
Video on disk
  → MultimodalKnowledgeService (job BullMQ)
  → VideoKnowledgeProvider (token DI)
       → GeminiVideoKnowledgeProvider  [@google/genai, knobs, file-ref]
  → StructuredLessonKnowledge
  → Postgres + embeddings / index
```

Remover Gemini no futuro: trocar o bind DI + adapter. Domínio/use cases não mudam.

---

## 5. Como executar cada cenário

```bash
# A — baseline (seguro)
GEMINI_VIDEO_PROCESSING_MODE=static
GEMINI_VIDEO_MEDIA_RESOLUTION=default

# B — low resolution
GEMINI_VIDEO_PROCESSING_MODE=static
GEMINI_VIDEO_MEDIA_RESOLUTION=low

# C — agentic
GEMINI_VIDEO_PROCESSING_MODE=agentic
GEMINI_VIDEO_MEDIA_RESOLUTION=default

# D — agentic + low
GEMINI_VIDEO_PROCESSING_MODE=agentic
GEMINI_VIDEO_MEDIA_RESOLUTION=low
```

Reiniciar worker após mudar env (`docker compose up -d --force-recreate worker`) e:

```http
POST /sources/{sourceId}/multimodal
```

Também necessário: `VIDEO_PROCESSOR=multimodal`, `GEMINI_API_KEY`, `GEMINI_VIDEO_MODEL=gemini-3.8-flash`.

---

## 6. Resultados reais (mesma aula)

Source: `5fe720dc-d4a4-42dd-81be-f236a3eea095`  
Título sugerido (A/B): *Aplicação Prática do Modo Jônio e Criação Melódica na Guitarra*

| Cenário | Mode / Res | Duração | Input tok | Output tok | Total tok | fileReuse | Qualidade (contagens estruturadas) |
|---------|------------|---------|-----------|------------|-----------|-----------|-------------------------------------|
| **A** | static / default | 26.3 s | 381 568 | 2 190 | 384 382 | true | topics 5, concepts 5, techniques 3, scales 5, exercises 4, licks 2; summary ~474 chars |
| **B** | static / low | 23.5 s | 381 568 | 1 961 | ~384 521 | true | mesma ordem de magnitude / mesmas contagens nos campos principais |
| **C** | agentic / default | — | — | — | — | — | **Falhou**: 503 high demand → retries BullMQ; sem telemetry útil no fim |
| **D** | agentic / low | — | — | — | — | — | **Não medido** (quota/503 após C) |

### Leitura dos dados

1. **`low` não reduziu input tokens** neste vídeo longo vs `default` (381 568 iguais). Alinhado à documentação Gemini: para vídeo geral, low/medium frequentemente equivalem em tokens.
2. **Output tokens** de B ligeiramente menores; duração ~11% menor — ganho marginal, não estrutural de custo de input.
3. **`agentic` está implementado e aceito pelo SDK**, mas a API estava instável (503) + free tier **20 req/dia** no `gemini-3.8-flash` esgotou durante a bateria de testes.
4. **Cache de arquivo funcionou**: A e B com `fileReuse: true` (sem re-upload).
5. Qualidade por contagens de campos: A ≈ B nesta amostra. Não houve avaliação humana fina de timestamps/visuais entre A e B além das contagens.

### Estado pós-teste

- Aula ficou `FAILED` após esgotar quota free.
- Env restaurado para `static` / `default`.
- Reprocessamento depende de reset de quota (~22h no momento do teste) + `POST .../multimodal` ou botão Analisar no front.

---

## 7. Validação automatizada

- Testes: **101 pass** (`pnpm test` / suite do projeto no momento da entrega)
- Typecheck: `tsc --noEmit` ok
- Cobertura relevante da POC:
  - config mode/resolution inválidos falham claro
  - file-ref reuso
  - provider-error (429/503 / ApiError)
  - contrato → `StructuredLessonKnowledge`

---

## 8. Arquivos tocados (commit da POC)

Principais:

- `package.json`, `pnpm-lock.yaml` — `@google/genai`
- `src/config/env.ts`, `.env.example`
- `src/di/register-providers.ts`
- `src/video-knowledge/gemini-video-knowledge.provider.ts`
- `src/video-knowledge/gemini-video-config.ts` (+ test)
- `src/video-knowledge/gemini-response-schema.ts`
- `src/video-knowledge/prompt.ts`, `types.ts`, `provider-error.ts`
- `src/video-knowledge/multimodal-knowledge.service.ts`, `file-ref.test.ts`, `index.ts`
- `specs/video-knowledge-provider-poc-onedrive-notes.md`

Commit de referência no repo: `c84092fe` (“addd”) — inclui a implementação acima.

---

## 9. Fora de escopo (respeitado)

- Cloud Storage / migrations novas de cache
- Novo provider OpenAI/Anthropic/local para vídeo
- Remoção do Whisper
- Redesign frontend (houve polish separado de UX do botão Analisar, fora desta spec)
- Rewrite do connector OneDrive
- Circuit breaker complexo
- Fallback Whisper automático em 429/503

---

## 10. Perguntas abertas para revisão (pedir opinião ao GPT)

1. Dado que `MEDIA_RESOLUTION_low` **não cortou input tokens** neste vídeo, vale manter `low` como default de produção, ou só como experimento?
2. `agentic` vale o risco operacional (503, latência, cota) para aulas de guitarra longas, ou só `static` até haver paid tier estável?
3. Com ~380k input tokens/aula, qual política de cota/billing faz sentido antes de escalar multimodal?
4. O contrato `VideoKnowledgeProvider` + DI está suficientemente agnóstico, ou ainda há vazamento sutil (env names, telemetry fields)?
5. Vale persistir métricas A/B (tokens/mode) em tabela, ou log estruturado basta para a próxima fase?
6. Para qualidade: além de contagens de campos, qual rubrica mínima (timestamps, acordes, info visual) para decidir “low é aceitável”?
7. OneDrive: priorizar stream sem disco na próxima iteração, ou o gargalo real é só Gemini tokens?

---

## 11. Princípio final (da spec)

> O Context Hub é o produto. Gemini é somente uma implementação substituível de `VideoKnowledgeProvider`. Otimize o Gemini agressivamente onde fizer sentido, mas não permita que decisões específicas dele definam a arquitetura do Context Hub.

---

## 12. Pedido ao revisor

Avalie:

- se a POC atendeu a spec;
- se a conclusão A≈B em tokens é interpretada corretamente;
- se a arquitetura permanece vendor-agnostic;
- recomendações concretas de próximo passo (default de produção, paid tier, métricas, qualidade).
