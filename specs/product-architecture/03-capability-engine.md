# 03 — Capability Engine

> 🚫 **DESIGN SPEC — DO NOT IMPLEMENT YET**
>
> Implementação bloqueada até conclusão/revisão da POC 3.

## Objetivo

Permitir que novas ideias sejam adicionadas como capacidades pequenas e composáveis, evitando um use case específico para cada combinação de intenção.

Não queremos:

```text
PracticeTechniqueInSongUseCase
PracticeTechniqueOnPianoUseCase
CreateSoloFromLessonUseCase
TransposeSavedLickUseCase
...
```

Queremos composição de capacidades.

## Contrato conceitual

```ts
interface Capability<TInput, TOutput> {
  readonly id: string;
  readonly description: string;

  execute(
    input: TInput,
    context: CapabilityContext,
  ): Promise<TOutput>;
}
```

Não implementar um framework genérico baseado nisso agora. É uma fronteira conceitual.

## Categorias possíveis

```text
knowledge.search
knowledge.related
knowledge.compare

music.scale
music.chord
music.transpose
music.harmony

learning.create-exercise
learning.create-practice-plan
learning.review

instrument.apply-concept
instrument.render
```

IDs devem ser estáveis e independentes do provider LLM.

## Composição

Pergunta:

> Pegue aquela ideia da aula e me ajude a praticar no piano.

Possível plano:

```text
knowledge.search
      ↓
knowledge.related
      ↓
music.harmony
      ↓
instrument.apply-concept(piano)
      ↓
learning.create-exercise
```

Não é necessário existir uma capability para a frase inteira.

## Capability Context

Capabilities não devem buscar dependências globais arbitrariamente.

Conceitualmente:

```ts
interface CapabilityContext {
  userContext?: unknown;
  knowledgeContext?: unknown;
  sourceContext?: unknown;
}
```

O formato real deve nascer dos casos de uso.

## Registry

Pode existir futuramente um registry:

```text
CapabilityRegistry
 ├─ knowledge.search
 ├─ music.transpose
 ├─ learning.create-exercise
 └─ instrument.apply-concept
```

Mas não criar plugin framework sofisticado antes de existirem capabilities reais suficientes.

Inicialmente DI explícita pode ser melhor.

## Determinístico vs generativo

Uma capability deve deixar claro se seu resultado é:

- determinístico;
- recuperado;
- inferido;
- generativo.

Exemplo:

```text
music.scale(C, ionian)
```

deve preferir lógica determinística.

Já:

```text
learning.create-exercise(context)
```

pode combinar regras + geração.

## Segurança semântica

O LLM pode decidir **quando** chamar uma capability, mas não deve inventar o resultado de uma capability determinística se ela está disponível.

## Extensão futura

Uma ideia como treino de ouvido deve poder entrar como:

```text
learning.ear-training
```

sem alterar Knowledge Core.

Uma nova integração instrumental deve entrar pelo Instrument Extension Model, não criando dependência no engine.

## Observabilidade

Futuramente registrar:

- capability selecionada;
- input sanitizado/metadata;
- duração;
- sucesso/falha;
- origem do resultado;

Evitar logs contendo conteúdo pessoal desnecessário.

## Invariantes

1. Capability possui responsabilidade pequena.
2. IDs não dependem do nome de modelo/provider.
3. Capability não conhece frontend renderer.
4. Capability não conhece Gemini/OpenAI salvo adapters explicitamente específicos.
5. Orchestrator compõe capabilities; capability não vira um mini-orchestrator.
6. Cálculos determinísticos permanecem determinísticos quando possível.
7. Adicionar capability nova não deve exigir modificar todas as existentes.

## Fora de escopo agora

- autonomous agents irrestritos;
- marketplace de plugins;
- execução dinâmica de código;
- workflows persistentes genéricos;
- capability DSL;
- permission system complexo;
- planner multi-agent.