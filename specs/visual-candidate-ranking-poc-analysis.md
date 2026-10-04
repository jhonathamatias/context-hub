# Análise da POC — Visual Candidate Ranking (Context Hub)

Documento autocontido para revisão externa (GPT / peer review).  
Spec: `specs/visual-candidate-ranking-poc.md`.  
POCs anteriores:
- Multimodal baseline: `specs/video-knowledge-provider-poc-analysis.md` (~384k tokens vídeo inteiro)
- Detector local: `specs/visual-candidate-detector-poc-analysis.md` (17 candidatos / 14.35%)

Data dos runs: 2026-10-03.

---

## 1. Contexto

A POC do detector mostrou que ~**14.35%** da aula (~10m de ~70m) era candidata a análise visual por heurística de transcrição. Havia FPs claros (`faz assim` metafórico, `não vou tocar essa nota`, `vou tocar`/`vou fazer` genéricos).

Antes de gastar cota multimodal, esta POC adicionou um **ranker local** independente do detector:

```text
TranscriptionSegment[]
  → VisualCandidateDetector   (recall: “pode ter demo visual?”)
  → VisualCandidate[]
  → VisualCandidateRanker     (precision: “quão forte a imagem importa?”)
  → RankedVisualCandidate[]
  → relatório + métricas
```

**100% local. Sem Gemini, LLM, API paga, FFmpeg clips, frontend, migrations ou mudança no multimodal.**

---

## 2. Objetivo

1. Eliminar FPs óbvios  
2. Distinguir evidência visual forte vs genérica  
3. Combinar evidências em candidatos merged  
4. Score/ranking explicável  
5. Medir cobertura HIGH / MEDIUM / LOW / REJECTED  
6. Identificar **Top 5** para futura POC de clips multimodais  

---

## 3. Implementação

### 3.1 Contrato

```ts
interface VisualCandidateRanker {
  rank(
    candidates: VisualCandidate[],
    segments: TranscriptionSegment[],
  ): Promise<RankedVisualCandidate[]>;
}

type RankedVisualCandidate = VisualCandidate & {
  score: number;
  relevance: 'high' | 'medium' | 'low';
  scoreReasons: string[];
  rejected: boolean;
  rejectionReasons: string[];
  contextSnippet: string;
};
```

Implementação: `RuleBasedVisualCandidateRanker`  
Pesos centralizados: `src/visual-candidates/scoring-weights.ts`  
Detector **não** foi inchado com scoring.

### 3.2 Scoring (determinístico)

| Força | Peso | Exemplos |
|-------|------|----------|
| Strong | +3 | `esse desenho`, `nessa regiao`, `nesse formato`, `essa posicao`, casa, digitação |
| Medium | +2 | `vou mostrar`, `olha aqui/esse`, `esse acorde`, `dessa escala`, lick/arpejo |
| Weak | +1 | `olha so`, `vou tocar`, `vou fazer`, `faz assim`, `desse jeito`, `dessa forma` |

Bônus:
- +1 multi-categoria (ex.: attention + spatial)
- +1 termo espacial no contexto (`shape`, `braco`, `desenho`, …) se ainda não creditado
- +1 termo musical no contexto (`acorde`, `penta`, `corda`, …) se ainda não creditado

Triggers duplicados no mesmo candidato **não** inflacionam o score.

### 3.3 Anti-falso-positivo

**Negação** (conservadora, local): `nao`/`nunca` até ~5 tokens antes de frases fracas (`vou tocar`, `vou fazer`, `faz assim`, …) → essa evidência vale **0**. Outras evidências fortes na mesma janela permanecem.

**Genérico sozinho:** só cues fracos sem suporte musical/espacial → **REJECTED** (aparece no relatório, não some).

### 3.4 Thresholds de relevância (documentados)

```text
HIGH    score ≥ 3   (forte espacial/shape ou combo equivalente)
MEDIUM  score ≥ 2   (objeto musical / cue médio sem spatial forte)
LOW     score ≥ 1   (fraco mas com algum suporte residual)
REJECTED score 0 ou só weak sem suporte musical/espacial
```

Não foram ajustados para forçar um % alvo.

### 3.5 Como executar

```bash
docker compose exec -T node pnpm poc:visual-candidates <sourceId>
```

O CLI existente agora imprime DETECTION + RANKING + TOP 5.

---

## 4. Resultados — aula benchmark

```text
sourceId: 5fe720dc-d4a4-42dd-81be-f236a3eea095
Aula: Talisson — Modo Jônio / criação melódica
Duração: 1h 09m 52s (~4192s)
Transcript: local-whisper, 1548 segments
Baseline Gemini full video: ~384k tokens
```

### 4.1 Antes vs depois

| Estágio | Count | Duração | Coverage |
|---------|-------|---------|----------|
| **DETECTION** | 17 | 10m 02s | **14.35%** |
| HIGH | 10 | 6m 43s | 9.62% |
| MEDIUM | 2 | 0m 58s | 1.38% |
| LOW | 1 | 0m 34s | 0.80% |
| REJECTED | 4 | 1m 46s | — |
| **HIGH + MEDIUM** | **12** | **7m 41s** | **11.01%** |

Redução: 14.35% → 11.01% (HIGH+MEDIUM). Top 5 sozinho ~ **4m 04s** (~5.8% da aula).

### 4.2 REJECTED (4)

| Janela | Trigger | Motivo |
|--------|---------|--------|
| 4:28–4:53 | `faz assim` | só weak sem suporte (metáfora “faz sentido”) |
| 5:48–6:22 | `olha so` | só weak sem suporte |
| 7:04–7:30 | `desse jeito` | só weak sem suporte |
| 1:01:10–1:01:31 | `vou tocar` | só weak sem suporte |

### 4.3 LOW (1)

| Janela | Nota |
|--------|------|
| 25:42–26:16 | `vou tocar` **negado** (“não vou tocar essa nota”); score residual +1 por “penta” no contexto → LOW, não HIGH |

### 4.4 MEDIUM (2)

- 39:15–39:37 `desse acorde` (score 2)
- 1:07:34–1:08:10 `esse acorde` (score 2)

### 4.5 HIGH (10) — ordenado por score

1. 36:39–37:33 (54s) **score 7** — olha so + dessa forma + esse formato  
2. 31:57–32:19 (22s) **score 5** — nessa regiao  
3. 32:35–32:57 (22s) **score 5** — nesse formato  
4. 33:32–34:34 (62s) **score 5** — nessa regiao  
5. 42:20–43:44 (84s) **score 5** — olha so + vou fazer + vou tocar  
6. 48:54–49:16 (22s) **score 5** — esse desenho  
7. 9:59–10:44 (45s) **score 4** — desse acorde + dessa escala  
8. 31:07–31:29 (22s) **score 4** — desse jeito (+ contexto desenho/penta)  
9. 27:46–28:34 (48s) **score 3** — vou tocar (+ escala/corda)  
10. 50:58–51:20 (22s) **score 3** — vou tocar (+ frase)  

### 4.6 TOP 5 (completo — candidatos para próxima POC)

#### 1) 36:39 → 37:33 (54s) · score 7 · HIGH
- triggers: `olha so`, `dessa forma`, `esse formato`
- reasons: +1 look, +1 manner, +3 shape/form, +1 musical (corda), +1 multi-category
- context: “…olha só está vendo que a gente está muito indo pela parte de baixo… todas as direções…”

#### 2) 31:57 → 32:19 (22s) · score 5 · HIGH
- trigger: `nessa regiao`
- reasons: +3 region, +1 acorde, +1 multi-category
- context: “…ficar só nessa região… soar o mesmo acorde em todo o braço…”

#### 3) 32:35 → 32:57 (22s) · score 5 · HIGH
- trigger: `nesse formato`
- reasons: +3 shape/form, +1 penta, +1 multi-category
- context: “…lance de penta… um dó 7 nesse formato… tônica… sétima…”

#### 4) 33:32 → 34:34 (62s) · score 5 · HIGH
- trigger: `nessa regiao`
- reasons: +3 region, +1 penta, +1 multi-category
- context: “…pentatônica… toca muito nessa região aqui… afastando…”

#### 5) 42:20 → 43:44 (84s) · score 5 · HIGH
- triggers: `olha so`, `vou fazer`, `vou tocar`
- reasons: +1+1+1 weak cues, +1 corda/penta, +1 multi-category
- context: “…olha só, vamos pegar uma primeira estrutura… C7…”

---

## 5. Avaliação qualitativa obrigatória

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | `faz assim de uma forma que faz sentido` caiu? | **Sim → REJECTED** |
| 2 | `eu não vou tocar essa nota` deixou de ser forte? | **Sim** — evidência negada; ficou LOW residual por “penta”, não HIGH |
| 3 | `esse desenho` ficou forte? | **Sim → HIGH score 5** |
| 4 | `nessa região` / `nesse formato` fortes? | **Sim → HIGH** |
| 5 | Clusters multi-sinal acima de isolados? | **Sim** (score 7 no topo) |
| 6 | Útil caiu em LOW/REJECTED? | **Não** — spatiais fortes permaneceram HIGH |
| 7 | FPs restantes | `vou tocar`+vocab musical → HIGH (27:46, 50:58); `desse jeito`+desenho/penta (31:07) pode ser generoso; Top5 #5 é cluster fraco+musical (plausível mas menos espacial) |
| 8 | FNs impossíveis transcript-only | Demos silenciosas, gestos, ASR errado, cues fora da lista |

---

## 6. Validação

- Testes: **128 pass** (inclui 13 novos do ranker/métricas)
- Typecheck: OK
- **Nenhuma** chamada Gemini / OpenAI / API externa / FFmpeg clip

Casos cobertos: strong > weak, multi-evidência, anti-duplicata, negação, negação+strong independente, `faz assim` rejected, `esse desenho` HIGH, spatial+demo, ordenação/empate, reasons, métricas, lista vazia.

---

## 7. Arquivos

```text
src/visual-candidates/scoring-weights.ts          (novo)
src/visual-candidates/rule-based-visual-candidate.ranker.ts  (novo)
src/visual-candidates/ranking-metrics.ts          (novo)
src/visual-candidates/visual-candidate-ranking.test.ts (novo)
src/visual-candidates/types.ts                    (RankedVisualCandidate, metrics)
src/visual-candidates/report.ts                   (DETECTION + RANKING + TOP 5)
src/visual-candidates/index.ts
scripts/poc-visual-candidates.mts
specs/visual-candidate-ranking-poc.md
```

---

## 8. Critério de decisão / recomendação

A spec dizia que ~5–10% HIGH+MEDIUM seria ótimo; obtivemos **11.01%** HIGH+MEDIUM e **~5.8%** só no Top 5.

**Recomendação: avançar para a POC Top-5 clips multimodais.**

Motivos:
- FPs óbvios da POC anterior foram tratados
- Top 5 concentra evidência espacial/shape forte
- Ordem de grandeza de minutos a enviar (~4 min) ≪ aula inteira (~70 min) e ≪ baseline ~384k tokens do vídeo completo
- Qualidade > perseguir % artificial

Opcional não-bloqueante antes dos clips: endurecer score de `vou tocar` quando só há vocab musical genérico (sem spatial).

### Próxima etapa (NÃO implementada)

```text
Top 5 RankedVisualCandidate
  → FFmpeg (5 clips mínimos)
  → VideoKnowledgeProvider
  → medir tokens + informação visual nova vs ~384k baseline
```

Pergunta da próxima POC:

> O multimodal encontra conhecimento visual relevante que não existe na transcrição, gastando uma fração dos ~384k tokens?

---

## 9. Perguntas abertas para o revisor (GPT)

1. HIGH+MEDIUM 11% vs Top-5 ~6%: na próxima POC, enviar só Top 5 ou todos os HIGH?
2. O LOW residual em `não vou tocar` (+penta no contexto) deveria ser REJECTED?
3. `vou tocar` + termo musical genérico merecendo HIGH (score 3) é aceitável ou deve exigir spatial?
4. Thresholds HIGH≥3 / MEDIUM≥2 estão razoáveis?
5. A separação Detector vs Ranker está limpa o suficiente para trocar o ranker depois (ex. classificador local)?
6. Vale amostrar Top 3 primeiro para poupar cota Gemini free-tier?

---

## 10. Princípio final

> Não estamos construindo um detector perfeito.  
> Estamos usando processamento local barato para decidir **onde vale gastar visão multimodal**.  
> O ranking precisa ser simples, explicável, substituível e independente do provider de vídeo.
