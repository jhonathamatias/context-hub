# POC 3 — Mandatory Execution Guard

> **MANDATORY ADDENDUM TO `specs/remote-clip-multimodal-value-poc.md`**
>
> Este documento faz parte da POC 3 e deve ser seguido junto com a spec principal. Ele existe porque uma execução anterior acabou repetindo o experimento de full-video em vez de executar o experimento de remote clips.

## Não repetir o full-video POC

Execute exclusivamente a POC definida em:

```text
specs/remote-clip-multimodal-value-poc.md
```

A execução anterior processou novamente um vídeo completo. Esse experimento já forneceu evidência suficiente de que full-video é caro e não responde à pergunta desta POC.

**NÃO execute novamente:**

- análise multimodal do vídeo inteiro;
- A/B de `media_resolution`;
- `agentic`;
- Top 5;
- todos os candidatos;
- refactors fora da spec.

## Perguntas obrigatórias

Esta execução precisa responder exatamente:

1. Conseguimos extrair os Top 3 trechos do vídeo no OneDrive via remote seek sem baixar o arquivo inteiro?
2. Esses Top 3 trechos, analisados multimodalmente, produzem informação visual relevante que não existe na transcrição?

Se essas duas perguntas não forem respondidas, a POC não está concluída.

---

# Ordem obrigatória de execução

## Fase 1 — Remote clips SEM Gemini

Primeiro execute e valide somente a parte de remote media access.

Não chamar Gemini durante o desenvolvimento/validação desta fase.

Usar exatamente os Top 3 definidos na spec principal:

```text
36:39 → 37:33
31:57 → 32:19
32:35 → 32:57
```

O objetivo é provar empiricamente se é possível extrair esses trechos sem transferir o arquivo inteiro.

### Medição obrigatória

Registrar:

```text
originalVideoBytes
transferredBytes
transferRatio
clipOutputBytes
extractionDurationMs
HTTP Range evidence
206 Partial Content evidence
redirect behavior
FFmpeg seek behavior
```

`transferredBytes` deve representar bytes realmente transferidos do remoto quando isso puder ser medido com confiabilidade.

Não confundir:

```text
clipOutputBytes != transferredBytes
```

Um clip pequeno não prova que poucos bytes foram baixados.

### Regra de evidência

Não assumir que `Accept-Ranges`, HTTP Range ou uso de `ffmpeg -ss` significa que o download completo foi evitado.

É necessário provar pela medição/evidência de rede.

Se não for possível medir precisamente, registrar explicitamente a limitação e as evidências disponíveis. Nunca inventar a métrica.

### Falha do remote seek

Se remote seek não funcionar eficientemente:

```text
REMOTE SEEK RESULT: FAILED
```

Registrar causa e evidência.

Não fazer fallback silencioso para download completo.

Um fallback controlado pode ser usado posteriormente apenas para permitir a avaliação multimodal, conforme a spec principal, mas deve estar claramente identificado.

---

## Gate entre Fase 1 e Fase 2

**Não iniciar chamadas Gemini antes de concluir a Fase 1 e produzir evidência suficiente sobre transferência remota.**

Isso evita consumir quota enquanto ainda estamos tentando descobrir se o acesso remoto funciona.

Após a Fase 1, deve ser possível responder:

```text
Full download avoided: YES | NO | UNPROVEN
```

Somente então seguir para a Fase 2.

---

# Fase 2 — Multimodal somente nos Top 3

Depois da validação de remote access, analisar somente os Top 3 clips.

Reutilizar `VideoKnowledgeProvider`.

Não chamar Gemini SDK diretamente se isso puder ser evitado.

Não executar o vídeo inteiro como baseline novamente. Usar os baselines já medidos:

```text
Talisson full-video: ~384k tokens
Segundo full-video real: ~410k tokens
```

## Por clip

Registrar:

```text
Transcript
Multimodal findings
New visual information
Input tokens
Output tokens
Total tokens
Processing duration
```

Classificar findings em:

```text
NEW_VISUAL_INFORMATION
SUPPORTED_BY_TRANSCRIPT
DUPLICATE_OF_TRANSCRIPT
UNCERTAIN
```

Responder obrigatoriamente:

> Se tivéssemos apenas a transcrição, perderíamos informação importante que o multimodal conseguiu recuperar?

Apenas repetir visualmente algo já explícito no transcript não conta como ganho multimodal relevante.

---

# Comparação obrigatória

Ao final calcular:

```text
Top3TotalTokens
Top3TotalTokens / 384k
Top3TotalTokens / 410k
TokenReductionVsFullVideo

OriginalVideoBytes
TransferredBytesForTop3
TransferRatio
```

O objetivo não é apenas reduzir tokens.

O critério é:

> informação visual nova e útil por custo de transferência/processamento.

---

# Relatório obrigatório

Criar análise autocontida em `specs/` contendo pelo menos:

## Remote access

```text
Original video size:
Remote seek supported:
HTTP Range evidence:
Full download avoided: YES | NO | UNPROVEN
Transferred bytes:
Transfer ratio:
Clip output bytes:
Extraction time:
```

## Multimodal

Para cada clip:

```text
Transcript:
Multimodal findings:
New visual information:
Classification:
Tokens:
Duration:
```

## Global

```text
Full-video baseline: ~384k / ~410k tokens
Top-3 tokens:
Token ratio:
Token reduction:

Original file bytes:
Transferred bytes:
Transfer ratio:
```

## Decisão

Finalizar obrigatoriamente com:

```text
GO
```

ou

```text
ITERATE
```

ou

```text
STOP
```

com justificativa baseada em evidência.

---

# Regra final

Esta POC não está concluída por conseguir processar vídeo no Gemini. Isso já foi provado.

Ela só está concluída quando tivermos evidência para as duas perguntas:

```text
1. conseguimos evitar o download completo?
2. enxergar somente os trechos selecionados adiciona conhecimento que a transcrição perde?
```

Se uma execução terminar sem responder a essas perguntas, ela executou o experimento errado.