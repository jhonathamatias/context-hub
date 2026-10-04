# 04 — Dynamic AI Artifacts

> 🚫 **DESIGN SPEC — DO NOT IMPLEMENT YET**
>
> Implementação bloqueada até conclusão/revisão da POC 3.

## Objetivo

Permitir que respostas da IA tragam elementos interativos/estruturados além de texto sem acoplar `AIResponse` a todos os formatos futuros.

## Contrato conceitual

```ts
interface AIResponse {
  message: string;
  artifacts: Artifact[];
}

interface Artifact {
  type: string;
  version: number;
  data: unknown;
}
```

`unknown` não significa ausência de validação. Cada tipo deve possuir schema/validator próprio no módulo responsável.

## Exemplos

```text
music.chord
music.progression
learning.exercise
learning.practice-plan
source.reference

instrument.guitar.fretboard
instrument.guitar.chord-diagram
instrument.piano.keyboard
instrument.piano.voicing
instrument.bass.fretboard
```

Futuramente:

```text
learning.ear-training
instrument.drums.pattern
instrument.violin.fingering
rhythm.metronome-exercise
```

## Renderer Registry

Conceitualmente:

```text
Artifact
   ↓ type/version
ArtifactRendererRegistry
   ↓
Renderer
```

Exemplo:

```text
instrument.guitar.fretboard@1
  → GuitarFretboardRendererV1
```

O backend não deve conhecer componentes React.

## Versionamento

Artifact deve possuir versão desde o início do contrato.

Mudança incompatível de `data` exige nova versão.

Não usar versão para cada pequena adição opcional compatível.

## Validação

Cada artifact type deve possuir schema explícito.

Exemplo conceitual:

```ts
registerArtifact({
  type: 'learning.exercise',
  version: 1,
  schema: ExerciseArtifactSchema,
});
```

Não permitir que LLM envie JSON arbitrário diretamente para componentes sem validação.

## Fallback

Frontend que não conhece determinado artifact deve continuar exibindo `message` e ignorar/renderizar fallback seguro.

Isso permite evolução gradual entre backend/frontend.

## Persistência

Nem todo artifact precisa ser persistido.

Distinguir futuramente:

```text
ephemeral response artifact
saved artifact
user-created/saved artifact
```

Decidir persistência por caso de uso.

## Relação com Knowledge

Artifact é **representação/interação**, não necessariamente knowledge permanente.

Exemplo:

```text
Knowledge: C Ionian
Artifact: teclado mostrando C Ionian
```

Não persistir automaticamente cada visualização como knowledge novo.

## Relação com instrumentos

Instrument-specific artifacts pertencem às extensões de instrumento.

Core conhece apenas o envelope `Artifact`.

## Invariantes

1. Artifact sempre possui type + version.
2. Payload é validado antes de renderizar.
3. Backend não depende de renderer frontend.
4. Core não enumera todos os artifact types.
5. Instrument artifact não entra no core musical.
6. Texto continua funcionando mesmo quando artifact não é suportado.
7. Artifact não vira automaticamente knowledge persistente.

## Fora de escopo agora

- editor visual genérico;
- artifact marketplace;
- execução de HTML/JS vindo da IA;
- componentes arbitrários gerados por modelo;
- dezenas de renderers antes de casos reais.