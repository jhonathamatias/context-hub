# 05 — Music Theory Capabilities

> 🚫 **DESIGN SPEC — DO NOT IMPLEMENT YET**
>
> Implementação bloqueada até conclusão/revisão da POC 3.

## Objetivo

Separar raciocínio/orquestração da IA de cálculos musicais que podem ser executados deterministicamente.

A IA decide que precisa de determinada informação; uma capability confiável calcula o resultado.

## Instrument-independent

Estas capabilities representam teoria/música, não guitarra.

Possíveis exemplos futuros:

```text
music.notes
music.interval
music.scale
music.chord
music.transpose
music.harmonize
music.progression
music.key-analysis
music.rhythm
```

Implementar somente conforme casos reais surgirem.

## Exemplo

Pergunta:

> Quais notas posso usar sobre Cmaj7 nesse contexto?

O LLM pode recuperar contexto e decidir consultar:

```text
music.chord(Cmaj7)
music.scale(C, ionian)
```

O cálculo das notas não deve depender da memória estatística do LLM quando existe regra determinística disponível.

## Contratos conceituais

Exemplo:

```ts
type NoteName = string;

type ScaleQuery = {
  root: NoteName;
  scale: string;
};

type ScaleResult = {
  root: NoteName;
  scale: string;
  notes: NoteName[];
  intervals: string[];
};
```

Não congelar esses tipos sem avaliar enharmonia, acidentes, contexto tonal etc.

## Responsabilidades

Theory capability pode:

- calcular;
- validar;
- transformar;
- fornecer estrutura musical.

Não deve:

- decidir plano de estudo;
- escolher instrumento;
- renderizar fretboard;
- acessar UI;
- buscar aulas;
- orquestrar outras features arbitrariamente.

## Enharmonia e contexto

Evitar implementação ingênua que trate apenas pitch classes e produza grafia musical ruim.

Exemplo:

```text
F# major ≠ exibir automaticamente Gb onde a função harmônica pede E#
```

Quando esse problema entrar no escopo real, modelar spelling musical explicitamente.

## Relação com instrumentos

```text
music.scale(C, ionian)
        ↓
C D E F G A B
        ↓
Instrument Extension
        ↓
Guitar: posições no braço
Piano: teclas/fingering
Bass: posições
```

Theory não conhece a representação instrumental.

## Relação com LLM

LLM pode:

- interpretar intenção;
- selecionar capabilities;
- explicar resultado;
- combinar resultado com contexto recuperado;
- sugerir aplicações criativas.

LLM não deve substituir cálculo determinístico disponível.

## Testabilidade

Theory capabilities devem ser altamente testáveis sem LLM/API.

Casos de teste futuros devem usar teoria musical conhecida e edge cases relevantes.

## Invariantes

1. Theory é independente de instrumento.
2. Cálculo determinístico não chama LLM.
3. Resultado possui estrutura, não somente texto.
4. Instrument extension consome resultado musical; theory não consome renderer.
5. Não implementar teoria completa antes de necessidade real.

## Fora de escopo agora

- engine completo de notação;
- MIDI generation;
- audio synthesis;
- score engraving;
- análise harmônica universal;
- reharmonization engine;
- composição automática completa.