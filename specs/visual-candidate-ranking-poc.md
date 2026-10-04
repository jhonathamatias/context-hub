# POC 2.1 — Visual Candidate Ranking e Anti-False-Positive

## Contexto

A POC `Visual Candidate Detector` confirmou que é possível reduzir significativamente a região potencialmente multimodal de uma aula usando somente processamento local.

Benchmark atual:

- source: `5fe720dc-d4a4-42dd-81be-f236a3eea095`
- aula: Talisson — Modo Jônio / criação melódica
- duração: ~1h09m52s (~4192s)
- transcrição: 1548 segmentos
- candidatos após merge: 17
- duração dos candidatos: ~10m02s
- cobertura visual: 14.35%
- baseline Gemini vídeo inteiro: ~384k tokens

A análise qualitativa mostrou falsos positivos importantes, principalmente em triggers genéricos:

- `faz assim` usado metaforicamente;
- `vou tocar` em frases negativas como `eu não vou tocar essa nota`;
- `vou tocar` / `vou fazer` sem indicação de que a imagem seja necessária.

Também mostrou sinais visualmente fortes:

- `nessa região`;
- `nesse formato`;
- `esse formato`;
- `esse desenho`;
- referências a posição, casa, região do braço, shape e digitação;
- combinações de múltiplos sinais dentro da mesma janela.

Antes de gastar nova cota multimodal, queremos reduzir e priorizar os candidatos usando somente regras locais.

## Objetivo

Adicionar uma segunda etapa independente ao fluxo:

```text
TranscriptionSegment[]
        ↓
VisualCandidateDetector
        ↓
VisualCandidate[]
        ↓
VisualCandidateRanker
        ↓
RankedVisualCandidate[]
        ↓
relatório + métricas
```

O objetivo é:

1. eliminar falsos positivos óbvios;
2. distinguir sinais visuais fortes de sinais genéricos;
3. combinar evidências dentro de candidatos merged;
4. produzir um score/ranking explicável;
5. descobrir quanto da aula sobraria se enviássemos somente candidatos de alta relevância visual;
6. identificar um Top-N pequeno para a futura POC multimodal.

Esta POC continua 100% local e gratuita.

## Restrições obrigatórias

NÃO:

- chamar Gemini;
- chamar OpenAI ou qualquer LLM;
- chamar qualquer API externa/paga;
- usar FFmpeg para gerar clips;
- alterar `StructuredLessonKnowledge`;
- criar migrations/tabelas;
- alterar frontend;
- alterar pipeline multimodal;
- alterar BullMQ;
- implementar análise visual;
- fazer merge com knowledge;
- refatorar componentes fora de `visual-candidates` sem necessidade comprovada.

A POC termina no ranking e relatório.

## Preservar responsabilidades existentes

Não transforme `HeuristicVisualCandidateDetector` em um componente complexo de scoring.

O detector continua respondendo:

> Este trecho pode conter uma demonstração visual?

O novo ranker responde:

> Entre os candidatos encontrados, quão forte é a evidência de que a imagem realmente importa?

Preferir uma abstração equivalente a:

```ts
export interface VisualCandidateRanker {
  rank(
    candidates: VisualCandidate[],
    segments: TranscriptionSegment[],
  ): Promise<RankedVisualCandidate[]>;
}
```

Adaptar aos padrões reais do projeto se necessário.

## Resultado esperado

Conceitualmente:

```ts
export type RankedVisualCandidate = VisualCandidate & {
  score: number;
  relevance: 'high' | 'medium' | 'low';
  scoreReasons: string[];
  rejected?: boolean;
  rejectionReasons?: string[];
};
```

Não é obrigatório usar exatamente esses nomes/campos se houver alternativa mais coerente com o projeto.

O ponto importante é que o resultado seja explicável.

Não queremos apenas `score: 7`; queremos saber por que ele recebeu 7.

## Scoring inicial

Use regras explícitas, determinísticas e fáceis de alterar.

Uma sugestão inicial:

### Evidência visual forte

Peso alto, por exemplo +3:

- `esse desenho`
- `essa posição`
- `nessa posição`
- `nesse formato`
- `esse formato`
- `nessa região`
- `essa região`
- `nessa casa`
- `essa casa`
- referências explícitas a `shape`
- referências explícitas a `digitação`
- referências explícitas a posição da mão/dedos
- referências espaciais claras ao braço da guitarra

### Evidência intermediária

Peso médio, por exemplo +2:

- `vou mostrar`
- `deixa eu mostrar`
- `olha aqui`
- combinação explícita de verbo demonstrativo com objeto musical

### Evidência fraca

Peso baixo, por exemplo +1:

- `olha só`
- `vou tocar`
- `vou fazer`
- `faz assim`
- `desse jeito`
- `dessa forma`

Os valores acima são ponto de partida da POC, não regra de negócio definitiva.

Organize pesos e categorias de forma centralizada e fácil de testar.

## Combinação de evidências

O score deve considerar o candidato merged como um todo.

Exemplo:

```text
"olha só"
+
"vou tocar"
+
"nessa região"
```

é muito mais interessante do que apenas:

```text
"vou tocar"
```

Portanto, agregue triggers/evidências encontradas na janela/candidato.

Evite contar repetidamente a mesma expressão apenas porque o Whisper a segmentou em vários fragmentos equivalentes.

Considere bônus pequeno quando existirem múltiplas categorias independentes de evidência, por exemplo:

```text
cue de atenção + referência espacial
cue de demonstração + objeto musical
referência espacial + shape/digitação
```

Mantenha isso simples e explicável.

## Regras anti-falso-positivo

### Negação

Identifique pelo menos negações simples próximas de triggers fracos.

Exemplos:

```text
"não vou tocar essa nota"
"não vou fazer desse jeito"
"nunca vou tocar assim"
```

Esses casos não devem receber o mesmo score positivo que:

```text
"vou tocar esse lick"
```

Não é necessário construir NLP sofisticado.

Implemente uma regra local simples, testável e conservadora.

Evite descartar um candidato inteiro quando houver outras evidências visuais fortes independentes na mesma janela.

Exemplo:

```text
"não vou tocar essa nota"
+
"olha essa posição aqui"
```

A primeira evidência pode ser anulada, mas a segunda continua válida.

### Uso metafórico/genérico

Triggers muito genéricos como:

- `faz assim`
- `desse jeito`
- `dessa forma`

não devem, sozinhos, gerar alta relevância.

Se forem a única evidência do candidato, classifique como baixa relevância ou possível rejeição.

## Contexto da transcrição

O ranker recebe também `TranscriptionSegment[]` porque pode precisar consultar texto ao redor do candidato para:

- identificar negação;
- entender combinação de triggers;
- identificar termos musicais próximos;
- evitar decisões baseadas apenas na string isolada do trigger.

Não expanda demais a janela.

Use apenas contexto local necessário ao candidato.

## Vocabulário musical

Pode ser útil reconhecer termos que aumentam a probabilidade de demonstração visual quando combinados com cues genéricos:

- acorde
- escala
- arpejo
- lick
- frase
- shape
- desenho
- posição
- casa
- corda
- braço
- dedo
- digitação
- pestana
- slide
- bend / bending
- hammer-on
- pull-off
- palhetada

Não transforme isso em classificador semântico complexo.

É somente evidência adicional para o ranking.

## Relevância

Defina thresholds simples depois de observar os scores produzidos.

Conceitualmente:

```text
HIGH
forte probabilidade de informação visual útil

MEDIUM
pode conter informação visual, mas evidência é incompleta

LOW
trigger genérico / baixa confiança / provável falso positivo
```

Não escolha thresholds apenas para atingir um percentual desejado.

Documente os thresholds utilizados e por que parecem razoáveis para esta POC.

## Rejeição

Permita marcar um candidato como rejeitado quando todas as evidências forem fracas/anuladas.

Exemplo:

```text
faz assim
```

em contexto claramente metafórico, sem qualquer referência musical/espacial/demonstrativa adicional.

Mas seja conservador: preferimos manter um `LOW` duvidoso no relatório a apagar silenciosamente um possível trecho visual.

O relatório deve mostrar candidatos rejeitados separadamente.

## Métricas

Preserve as métricas da POC anterior e adicione métricas pós-ranking.

Exemplo:

```ts
{
  originalCandidateCount: number;
  originalCandidateSeconds: number;
  originalCoveragePercent: number;

  highCandidateCount: number;
  highCandidateSeconds: number;
  highCoveragePercent: number;

  mediumCandidateCount: number;
  mediumCandidateSeconds: number;
  mediumCoveragePercent: number;

  lowCandidateCount: number;
  rejectedCandidateCount: number;
}
```

Também produza uma visão combinada:

```text
HIGH + MEDIUM coverage
```

Isso será importante para decidir quantos minutos poderiam ser enviados ao multimodal futuramente.

## Top-N

O relatório deve mostrar explicitamente os candidatos ordenados por score.

Mostrar pelo menos:

```text
Top 5 visual candidates
```

Para cada um:

- rank;
- start/end;
- duração;
- score;
- relevance;
- triggers;
- scoreReasons;
- trecho textual/contexto relevante.

Esse Top 5 será usado posteriormente para escolher os primeiros clips multimodais.

Não gere os clips agora.

## Aula benchmark

Rode novamente na mesma source, se disponível localmente:

```text
5fe720dc-d4a4-42dd-81be-f236a3eea095
```

Baseline atual:

```text
Duração da aula: 1h09m52s
Candidatos: 17
Candidate duration: 10m02s
Coverage: 14.35%
Gemini full video: ~384k tokens
```

O objetivo desta POC é descobrir algo como:

```text
Antes do ranking:
17 candidates
10m02s
14.35%

Depois:
HIGH: 5 candidates / 3m10s
MEDIUM: 4 candidates / 2m20s
LOW: 5 candidates
REJECTED: 3 candidates

HIGH + MEDIUM:
5m30s
7.9%
```

Esses números são apenas exemplo.

Não ajuste regras artificialmente para alcançá-los.

## Avaliação qualitativa obrigatória

Além dos números, revise manualmente a saída da aula benchmark e responda:

1. O falso positivo `faz assim de uma forma que faz sentido` caiu de relevância?
2. `eu não vou tocar essa nota` deixou de ser tratado como forte evidência?
3. `esse desenho` permaneceu forte?
4. `nessa região` / `nesse formato` permaneceram fortes?
5. Clusters com múltiplos sinais ficaram acima de triggers isolados?
6. Algum candidato claramente útil caiu para LOW/REJECTED?
7. Quais falsos positivos ainda sobraram?
8. Quais falsos negativos continuam impossíveis de detectar com transcript-only?

## Testes mínimos

Adicionar testes para:

1. strong trigger recebe score maior que weak trigger;
2. múltiplas evidências aumentam score;
3. trigger duplicado não infla score indevidamente;
4. `não vou tocar` anula/reduz evidência de `vou tocar`;
5. negação de um trigger não apaga outra evidência forte independente;
6. `faz assim` sozinho fica LOW ou rejeitado;
7. `esse desenho` fica HIGH conforme thresholds escolhidos;
8. referência espacial + demonstração recebe score maior;
9. candidatos são ordenados por score;
10. empate tem ordenação determinística;
11. métricas HIGH/MEDIUM/LOW são corretas;
12. coverage considera duração sem double-count;
13. lista vazia funciona;
14. resultado inclui razões explicáveis do score.

Não crie uma suíte enorme além do necessário.

## CLI / relatório

Preferencialmente evolua o comando existente:

```bash
pnpm poc:visual-candidates <sourceId>
```

para mostrar também o ranking.

Evite criar outro CLI se não houver necessidade.

O relatório deve deixar claro:

```text
DETECTION
17 candidates
10m02s
14.35%

RANKING
HIGH: ...
MEDIUM: ...
LOW: ...
REJECTED: ...

HIGH + MEDIUM coverage: ...

TOP 5
...
```

## Critério de decisão

Não existe percentual obrigatório.

O objetivo é descobrir se conseguimos reduzir os ~14.35% mantendo os trechos visualmente mais promissores.

Um resultado como ~5–10% de cobertura HIGH+MEDIUM seria um sinal muito bom para avançar, mas não altere scoring para forçar essa faixa.

Qualidade dos candidatos é mais importante que atingir um número específico.

## Próxima etapa — NÃO implementar

Se esta POC for aprovada, a próxima será deliberadamente pequena:

```text
Top 5 RankedVisualCandidate
        ↓
FFmpeg
        ↓
5 clips mínimos
        ↓
VideoKnowledgeProvider
        ↓
medir tokens + informação visual nova
```

A pergunta da próxima POC será:

> O multimodal encontra conhecimento visual relevante que não existe na transcrição, gastando uma fração dos ~384k tokens do vídeo completo?

Não implemente essa etapa agora.

## Entrega

Ao finalizar:

1. rode testes;
2. rode typecheck/lint conforme scripts existentes;
3. liste arquivos alterados/criados;
4. confirme que nenhuma API externa/Gemini/LLM foi chamada;
5. execute na source benchmark se disponível;
6. mostre métricas antes e depois do ranking;
7. liste HIGH, MEDIUM, LOW e REJECTED;
8. mostre Top 5 completo;
9. explique score de cada Top 5;
10. responda à avaliação qualitativa obrigatória;
11. reporte falsos positivos restantes;
12. reporte riscos de falsos negativos;
13. recomende se devemos avançar para Top-5 clips multimodais;
14. pare após essa análise.

## Princípio final

Não estamos tentando construir um detector perfeito.

Estamos tentando usar processamento local barato para decidir **onde vale gastar visão multimodal**.

O ranking precisa ser simples, explicável, substituível e independente do provider de vídeo.