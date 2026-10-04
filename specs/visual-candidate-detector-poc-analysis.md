# Análise da POC — Visual Candidate Detector (Context Hub)

Documento autocontido para revisão externa (GPT / peer review).  
Spec: `specs/visual-candidate-detector-poc.md`.  
POC multimodal anterior (baseline tokens): `specs/video-knowledge-provider-poc-analysis.md`.  
Data dos runs: 2026-10-03.

---

## 1. Contexto

A POC multimodal anterior mostrou que analisar o **vídeo inteiro** da aula benchmark com Gemini consome ~**384k tokens** de input/total. `media_resolution=low` não reduziu input tokens de forma relevante nessa amostra, e a cota free do Gemini foi esgotada.

Antes de novas chamadas multimodais pagas, esta POC valida uma estratégia híbrida **100% local**:

> De uma aula inteira de guitarra, quantos minutos provavelmente dependem da imagem para serem compreendidos corretamente?

Fluxo (esta POC termina aqui):

```text
Vídeo
  → Whisper (já persistido)
  → TranscriptionSegment[]
  → VisualCandidateDetector (heurística local)
  → VisualCandidate[]
  → métricas de cobertura visual
```

**Não chama Gemini. Não chama API paga. Não recorta vídeo. Não altera multimodal/frontend/schema.**

---

## 2. Hipótese

Uma aula longa tem muita fala compreensível só pela transcrição. Demonstrações de guitarra dependem do visual só em trechos. Se poucos minutos forem candidatos, a próxima POC pode enviar só esses clips ao multimodal e comparar com o baseline de ~384k tokens.

---

## 3. O que foi implementado

### 3.1 Contrato vendor-agnostic

```ts
interface VisualCandidateDetector {
  detect(segments: TranscriptionSegment[]): Promise<VisualCandidate[]>;
}

type VisualCandidate = {
  startSeconds: number;
  endSeconds: number;
  reason: string;
  confidence: number;
  triggers: string[];
};
```

Tipo de segmento reutilizado: `TranscriptionSegment` (`src/transcription/types.ts`) — **não** foi criado `TranscriptSegment` duplicado no backend.

### 3.2 Implementação

Pasta: `src/visual-candidates/`

| Peça | Papel |
|------|--------|
| `HeuristicVisualCandidateDetector` | matching local determinístico |
| `triggers.ts` | lista evolutiva de frases PT |
| `normalize.ts` | lowercase, remove acentos, match por frase inteira (space-bounded) |
| `window.ts` | padding 5s antes / 15s depois; merge overlap ou gap ≤ 10s |
| `metrics.ts` | coverage após merge (sem double-count) |
| `load-transcription.ts` | DB `local-whisper` COMPLETED → fallback `transcription.json` |
| `report.ts` + CLI | saída legível |

### 3.3 Como executar

```bash
docker compose exec -T node pnpm poc:visual-candidates <sourceId>
# ou local com .env/DB:
pnpm poc:visual-candidates <sourceId>
```

Script: `scripts/poc-visual-candidates.mts`  
Package: `"poc:visual-candidates": "tsx scripts/poc-visual-candidates.mts"`

Se não houver transcrição Whisper adequada → erro claro; **não** reprocessa Whisper.

### 3.4 Garantia de custo zero nesta POC

- Sem import/uso de `@google/genai` / Gemini
- Sem OpenAI / Graph / APIs externas
- Sem FFmpeg cut
- Só leitura de DB/storage + heurística em memória

---

## 4. Regras de janela

| Parâmetro | Valor |
|-----------|--------|
| Pad before | 5s (nunca negativo) |
| Pad after | 15s |
| Merge gap | ≤ 10s une candidatos |
| Merge fields | min start, max end, union triggers/reasons, max confidence |

---

## 5. Resultados — aula benchmark

```text
sourceId: 5fe720dc-d4a4-42dd-81be-f236a3eea095
Aula: Talisson — Modo Jônio / criação melódica
Transcript: database (local-whisper, 1548 segments)
```

| Métrica | Valor |
|---------|--------|
| Video duration | **1h 09m 52s** (≈ 4192s) |
| Candidate count (após merge) | **17** |
| Candidate duration | **10m 02s** |
| Visual coverage | **14.35%** |

Baseline multimodal anterior (vídeo inteiro → Gemini): ≈ **384k tokens**.

### 5.1 Lista completa de candidatos

1. **4:28 → 4:53** (26s) — `faz assim`
2. **5:48 → 6:22** (34s) — `olha so`
3. **7:04 → 7:30** (26s) — `desse jeito`
4. **9:59 → 10:44** (45s) — `desse acorde`, `dessa escala`
5. **25:42 → 26:16** (34s) — `vou tocar`
6. **27:46 → 28:34** (48s) — `vou tocar`
7. **31:07 → 31:29** (22s) — `desse jeito`
8. **31:57 → 32:19** (22s) — `nessa regiao`
9. **32:35 → 32:57** (22s) — `nesse formato`
10. **33:32 → 34:34** (62s) — `nessa regiao`
11. **36:39 → 37:33** (54s) — `olha so`, `dessa forma`, `esse formato`
12. **39:15 → 39:37** (22s) — `desse acorde`
13. **42:20 → 43:44** (84s) — `olha so`, `vou fazer`, `vou tocar`
14. **48:54 → 49:16** (22s) — `esse desenho`
15. **50:58 → 51:20** (22s) — `vou tocar`
16. **1:01:10 → 1:01:31** (21s) — `vou tocar`
17. **1:07:34 → 1:08:10** (36s) — `esse acorde`

### 5.2 Interpretação pela faixa da spec

| Faixa | Significado |
|-------|-------------|
| ~5–15% | Sinal forte para testar multimodal só nos candidatos |
| ~15–35% | Pode valer, mas melhorar ranking antes |
| >35–40% | Não avançar; investigar FPs |

**14.35%** está na faixa baixa (limítrofe com intermediária) → **sinal favorável** para a próxima POC de clips, com filtragem dos triggers fracos.

---

## 6. Revisão qualitativa (amostra)

### Falsos positivos evidentes

| Candidato | Por quê |
|-----------|---------|
| #1 `faz assim` (~4:28) | “faz assim de uma forma que faz sentido” — metáfora, não demo visual |
| #5 `vou tocar` (~25:42) | “eu **não** vou tocar essa nota” — negação |
| Vários `vou tocar` | Intenção de tocar ≠ necessariamente dependência de câmera |

### Candidatos mais plausíveis (dependência visual)

- `nessa regiao` / `nesse formato` (~31–34 min) — região/forma no braço
- `dessa forma` + `esse formato` (~36–37) — forma de acorde
- `esse desenho` (~48:54) — “desenho da penta” (shape/diagrama)
- Clusters com `olha so` + demo (~42 min)

### Falsos negativos / limitações

- Professor toca sem verbalizar cue → FN
- Expressões fora da lista (`repara`, gestos, “no braço” sem frase-alvo)
- Padding fixo pode cortar demos longas ou incluir fala irrelevante
- Whisper ASR errado → perde trigger
- Confidence fixa heurística (~0.65); não é score de modelo

### Correção importante durante a POC

Match inicial por `includes` fazia `desse acorde` casar com trigger `esse acorde` (substring).  
Corrigido para **match space-bounded** (`containsNormalizedPhrase`). Variantes explícitas (`desse acorde`, `nessa escala`, `nesse formato`, `olha so`) foram adicionadas à lista.

---

## 7. Validação automatizada

- Testes: **115 pass** (suite do projeto no momento da entrega)
- Typecheck: OK
- Cobertura de testes da POC: match, não-match, acentos, padding, clamp ≥0, merge overlap/gap/distante, métricas sem double-count, lista vazia

---

## 8. Arquivos principais

```text
src/visual-candidates/
  types.ts
  triggers.ts
  normalize.ts
  window.ts
  metrics.ts
  heuristic-visual-candidate.detector.ts
  load-transcription.ts
  format.ts
  report.ts
  index.ts
  visual-candidates.test.ts
scripts/poc-visual-candidates.mts
package.json  (poc:visual-candidates)
specs/visual-candidate-detector-poc.md
```

Commit de implementação (repo): `0eb2a3a` — *feat: implement visual candidate detection POC*.

---

## 9. O que NÃO foi feito (respeitado)

- Chamadas Gemini / APIs pagas
- FFmpeg clip cut
- Alteração de `StructuredLessonKnowledge`
- Migrations / frontend / jobs HTTP
- Mudança no pipeline multimodal
- Classificador LLM para limpar FPs
- Merge visual com knowledge textual

---

## 10. Próxima etapa (NÃO implementada — só se aprovada)

```text
VisualCandidate[]
  → FFmpeg (clips/frames mínimos)
  → VideoKnowledgeProvider
  → VisualKnowledge
  → merge com conhecimento textual
```

Medir então: minutos multimodais, tokens, custo, qualidade visual, timestamps vs baseline ~384k.

Sugestão de preparação antes dessa etapa:

1. Filtrar/rankear triggers fracos (`vou tocar`, `vou fazer`, `faz assim`) — ex.: negar se houver “não/nunca” no segmento
2. Opcional: exigir 2 triggers na janela merged ou score mínimo
3. Só então cortar e enviar ao Gemini os top-N candidatos

---

## 11. Recomendação da POC

**Avançar para a POC de clips multimodais**, com filtro prévio de FPs.

Motivo: ~**14%** da aula (~10 min de ~70) seria candidata → ordem de grandeza bem menor que vídeo inteiro. Economia potencial de tokens/custo é alta o suficiente para justificar o experimento, mas a lista atual ainda tem FPs óbvios que não devem ir todos para o Gemini.

---

## 12. Perguntas abertas para o revisor (GPT)

1. 14.35% é cobertura baixa o bastante para justificar clips, ou pediria ranking mais agressivo antes?
2. Vale blacklist/negation rules para `vou tocar` / `faz assim`, ou outro critério (ex.: só cues espaciais: região/formato/desenho/casa)?
3. Padding 5/15 + merge 10s está razoável para aulas de guitarra, ou aumentaria o after-pad?
4. Como estimar tokens multimodais dos 10 min de candidatos vs 384k do vídeo inteiro sem medir ainda?
5. A abstração `VisualCandidateDetector` está limpa o suficiente para trocar heurística por um classificador local depois, sem acoplar Gemini?
6. Próximo passo concreto: (A) regras anti-FP + rerun, (B) ir direto para FFmpeg+Gemini nos 17 clips, ou (C) amostrar 5 melhores clips primeiro?

---

## 13. Princípio final

> Esta POC existe para economizar chamadas multimodais antes de otimizar qualquer provider.  
> Primeiro descubra **o que realmente precisa ser visto**.  
> Só depois pagaremos para um modelo ver esses trechos.
