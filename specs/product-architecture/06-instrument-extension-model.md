# 06 — Instrument Extension Model

> 🚫 **DESIGN SPEC — DO NOT IMPLEMENT YET**
>
> Implementação bloqueada até conclusão/revisão da POC 3.

## Objetivo

Garantir que o Context Hub não fique acoplado à guitarra.

Guitarra será provavelmente a primeira implementação concreta porque é o primeiro caso de uso, mas deve ser tratada como extensão do sistema.

## Regra central

> Nenhuma funcionalidade central do Context Hub pode depender da existência de guitarra.

O sistema deve continuar conceitualmente válido para:

- piano;
- baixo;
- bateria;
- violino;
- saxofone;
- canto;
- teoria sem instrumento;
- instrumentos ainda não considerados.

## Modelo conceitual

```ts
interface InstrumentExtension {
  readonly id: string;
  readonly name: string;

  capabilities(): InstrumentCapabilityDefinition[];
  artifacts(): InstrumentArtifactDefinition[];
}
```

Não implementar literalmente até termos pressão real de variação.

## Exemplos

### Guitar

```text
instrument.guitar.fretboard
instrument.guitar.chord-shape
instrument.guitar.scale-position
instrument.guitar.fingering
instrument.guitar.technique
```

### Piano

```text
instrument.piano.keyboard
instrument.piano.voicing
instrument.piano.inversion
instrument.piano.fingering
```

### Bass

```text
instrument.bass.fretboard
instrument.bass.position
instrument.bass.fingering
```

### Futuro

```text
instrument.drums.rudiment
instrument.drums.pattern
instrument.violin.fingering
instrument.saxophone.fingering
```

## Conhecimento compartilhado

Conceitos musicais permanecem fora do instrumento:

```text
C Ionian
Cmaj7
secondary dominant
3/4
syncopation
```

Extensão responde:

> Como representar/aplicar esse conceito neste instrumento?

## Transferência entre instrumentos

Caso de uso futuro:

> Aprendi essa ideia numa aula de guitarra. Como meu amigo pode aplicar no piano?

Fluxo conceitual:

```text
Guitar lesson
    ↓
Musical Knowledge
    ↓
C Ionian / Cmaj7 / melodic idea
    ↓
Piano Extension
    ↓
voicing / keyboard representation / exercise
```

Não traduzir diretamente `guitar shape → piano shape`; primeiro elevar ao conceito musical quando possível.

## Técnica específica vs técnica musical

Algumas técnicas são instrument-specific:

```text
bend
alternate picking
piano pedaling
bowing
```

Outras podem ser mais gerais:

```text
rhythmic subdivision
phrasing
articulation
improvisation strategy
```

Não forçar tudo a uma hierarquia única. Usar contexto e relações.

## Instrument Artifact

Instrumentos podem registrar artifacts próprios:

```text
instrument.guitar.fretboard@1
instrument.piano.keyboard@1
```

O envelope de artifact permanece genérico.

## Instrument Capability

Exemplo futuro:

```ts
applyConcept({
  conceptId,
  instrument: 'piano',
  constraints,
});
```

O contrato final deve surgir do segundo instrumento real, não somente da guitarra.

## Regra do segundo instrumento

Não criar abstrações extremamente genéricas baseadas apenas em guitarra.

Estratégia:

1. implementar o mínimo para guitarra;
2. preservar fronteira de extensão;
3. quando piano/baixo entrar de verdade, comparar necessidades;
4. somente então extrair abstrações compartilhadas adicionais.

Isso evita uma abstração fictícia de instrumentos.

## Configuração do usuário

Preferência/instrumento do usuário pertence ao contexto/perfil, não ao Knowledge Core.

Um usuário pode tocar múltiplos instrumentos.

Nunca assumir `user.instrument` singular como verdade estrutural.

## Invariantes

1. Core não importa módulos de guitarra/piano/etc.
2. Instrument extension pode depender de Music Theory; Music Theory não depende de instrument extension.
3. Usuário pode possuir zero, um ou múltiplos instrumentos.
4. Knowledge pode existir sem instrumento.
5. Novos instrumentos não exigem migration do core por padrão.
6. Artifacts específicos permanecem no módulo do instrumento.
7. Não criar uma superinterface tentando normalizar características incompatíveis entre todos os instrumentos.

## Fora de escopo agora

- implementar piano/baixo somente para provar abstração;
- catálogo universal de instrumentos;
- MIDI mappings;
- afinações alternativas completas;
- modelagem física de instrumento;
- fingering optimization avançado;
- reconhecimento visual específico de cada instrumento.