# 07 — Contextual AI Orchestrator

> 🚫 **DESIGN SPEC — DO NOT IMPLEMENT YET**
>
> Implementação bloqueada até conclusão/revisão da POC 3.

## Objetivo

Evoluir o atual “Pergunte à IA” de resumo/RAG simples para uma experiência capaz de cruzar conteúdo, conhecimento musical, memória do usuário e capabilities — sem transformar o orchestrator em um God Object.

## Visão

```text
User Question
      ↓
Context Builder
 ├─ current source/timestamp
 ├─ semantic retrieval
 ├─ structured knowledge
 ├─ user annotations
 ├─ user ideas/favorites
 ├─ learning history
 └─ instrument context (optional)
      ↓
AI Orchestrator
      ↓
Capability selection/composition
      ↓
Capabilities
      ↓
AI synthesis
      ↓
Message + Artifacts + References
```

## Context Builder

Context building deve ser responsabilidade separada da geração da resposta.

O orchestrator não deve executar SQL/search diretamente espalhado pelo código.

Possível saída conceitual:

```ts
interface AIContext {
  query: string;
  source?: unknown;
  retrievedKnowledge: unknown[];
  userMemory: unknown[];
  learningContext?: unknown;
  instrumentContext?: unknown;
}
```

O contrato real deve permanecer mínimo.

## Contexto relevante, não contexto máximo

Não despejar toda a base do usuário no prompt.

Context Builder deve priorizar:

- relevância;
- recência quando fizer sentido;
- relação explícita;
- origem/evidência;
- limites de tokens.

## Orchestration

O LLM pode decidir usar capabilities disponíveis.

Exemplo:

> Quero praticar essa ideia em outra tonalidade no piano.

```text
context current concept
       ↓
music.transpose
       ↓
instrument.apply-concept(piano)
       ↓
learning.create-exercise
       ↓
response + keyboard/exercise artifacts
```

O orchestrator coordena; não implementa teoria, piano ou exercício internamente.

## Provider independence

O orchestrator depende de uma abstração de modelo/LLM, não de Gemini/OpenAI diretamente.

Provider-specific tool schemas/adapters podem existir na infraestrutura.

Trocar modelo não deve alterar Knowledge Core ou capabilities.

## Referências e evidência

Quando a resposta usa conhecimento de aula/source, preservar referências:

```text
lesson/source
start/end timestamp
knowledge source
```

O usuário deve conseguir voltar ao trecho que sustenta a resposta.

Distinguir:

```text
source-backed fact
music-theory deterministic result
AI suggestion
creative idea
```

Isso melhora confiança e UX.

## Resposta

Conceitualmente:

```ts
interface ContextualAIResponse {
  message: string;
  references: SourceReference[];
  artifacts: Artifact[];
  suggestions?: SuggestedAction[];
}
```

Não congelar esse contrato antes da implementação.

## Suggested Actions

Futuramente a resposta pode sugerir ações:

```text
salvar ideia
criar exercício
ver trecho
mostrar no instrumento
comparar com outra aula
adicionar à prática
```

Ação sugerida não deve executar automaticamente operações persistentes importantes sem intenção do usuário.

## Exemplo de experiência

Pergunta:

> O que eu já vi que pode me ajudar a improvisar sobre Cmaj7?

O sistema pode:

1. recuperar aulas/conceitos relacionados;
2. recuperar uma anotação do usuário sobre uma frase;
3. consultar teoria determinística;
4. considerar instrumento escolhido para a resposta;
5. gerar explicação;
6. anexar exercise/fretboard/keyboard artifact quando útil;
7. citar timestamps das aulas.

A resposta deixa de ser apenas “resumo de chunks”.

## Controle de complexidade

Primeira implementação futura deve usar poucos casos reais.

Não começar com planner autônomo multi-step irrestrito.

Sugestão de evolução:

```text
V1: context + retrieval + resposta
V2: 2–3 deterministic capabilities
V3: artifacts
V4: user memory contextual
V5: capability composition limitada
```

A ordem pode mudar conforme produto, mas evitar big bang.

## Observabilidade

Medir futuramente:

- fontes recuperadas;
- capabilities usadas;
- tokens;
- latência;
- artifacts produzidos;
- feedback do usuário;

Não armazenar raciocínio interno do modelo.

## Invariantes

1. Orchestrator não contém regras específicas de guitarra.
2. Orchestrator não implementa teoria musical.
3. Orchestrator não conhece componentes frontend.
4. Context Builder é separado da geração.
5. Respostas source-backed preservam referências quando possível.
6. Sugestão criativa deve ser distinguível de conhecimento extraído.
7. Provider LLM é substituível.
8. Capabilities são explícitas e observáveis.
9. Contexto deve ser selecionado, não despejado indiscriminadamente.
10. Operações persistentes importantes exigem intenção adequada do usuário.

## Fora de escopo agora

- agente totalmente autônomo;
- multi-agent architecture;
- memória infinita de conversa;
- execução arbitrária de tools;
- planner persistente complexo;
- implementação antes da decisão da POC 3.