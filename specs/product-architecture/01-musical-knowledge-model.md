# 01 — Musical Knowledge Model

> 🚫 **DESIGN SPEC — DO NOT IMPLEMENT YET**
>
> Implementação bloqueada até conclusão/revisão da POC 3.

## Objetivo

Definir um núcleo de conhecimento musical que não dependa de guitarra, de um provider de IA ou de uma origem específica.

O Knowledge Core deve representar **o que sabemos**, **de onde sabemos** e **como conhecimentos se relacionam**.

## Não é objetivo

- escolher agora todas as tabelas;
- criar um knowledge graph complexo;
- migrar o `StructuredLessonKnowledge` imediatamente;
- substituir RAG;
- criar Neo4j;
- definir ontologia musical completa;
- modelar todos os instrumentos.

## Modelo conceitual

```ts
interface KnowledgeNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  attributes: Record<string, unknown>;
  sources: KnowledgeSource[];
}

interface KnowledgeRelation {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  attributes?: Record<string, unknown>;
  sources?: KnowledgeSource[];
}
```

Esses contratos são conceituais. Não implementar literalmente sem avaliar o modelo atual.

## Exemplos de nodes

```text
music.mode: C Ionian
music.chord: Cmaj7
music.technique: alternate picking
music.harmony: secondary dominant
music.phrase: frase demonstrada na aula
music.exercise: exercício proposto pelo professor
```

Novos tipos devem poder aparecer sem exigir alteração do core.

## Relações

Exemplos:

```text
C Ionian --derived-from--> C major
C Ionian --works-over--> Cmaj7
Concept X --demonstrated-in--> Source @ 32:35
Exercise Y --practices--> Concept X
Phrase Z --uses--> Scale X
Concept A --related-to--> Concept B
```

Relações devem ser tipadas e explicáveis. Evitar transformar qualquer similaridade vetorial em relação permanente automaticamente.

## Proveniência

Conhecimento sem origem confiável perde valor.

```ts
interface KnowledgeSource {
  sourceId: string;
  sourceType: string;
  startSeconds?: number;
  endSeconds?: number;
  extractionMethod?: string;
  confidence?: number;
}
```

Uma informação pode vir de:

- transcrição;
- multimodal;
- professor;
- anotação do usuário;
- documento;
- inferência;
- capability determinística.

Deve ser possível distinguir evidência observada de inferência.

## Instrument independence

O Knowledge Core não deve possuir conceitos obrigatórios como:

```text
fret
stringNumber
pickDirection
fretboardPosition
```

Esses dados podem existir como attributes específicos ou conhecimento de uma extensão de instrumento, mas não como requisito do core.

`Scale`, `Chord`, `Interval`, `Harmony`, `Rhythm`, `Phrase` e conceitos semelhantes são musicais e podem ser aplicados a múltiplos instrumentos.

## StructuredLessonKnowledge

O contrato atual continua válido durante a evolução.

Não fazer big-bang migration.

Futuramente pode existir um mapper:

```text
StructuredLessonKnowledge
        ↓
Knowledge ingestion/mapping
        ↓
Knowledge Nodes + Relations
```

Somente criar isso quando houver caso de uso real.

## Busca

Knowledge estruturado complementa, não substitui automaticamente embeddings/RAG.

```text
Question
  ├─ semantic search
  ├─ structured relations
  └─ source references
```

O Context Builder poderá combinar esses sinais.

## Invariantes

1. Todo conhecimento persistente relevante deve poder apontar para sua origem quando aplicável.
2. Inferência não deve se passar por observação direta.
3. Tipos novos não devem exigir alteração do core.
4. Attributes flexíveis precisam de validação no módulo que os produz/consome.
5. Relações não devem ser criadas sem semântica definida.
6. Knowledge não depende de Gemini, Whisper, OneDrive ou instrumento.

## Questões para implementação futura

- Postgres relacional, JSONB ou combinação?
- quais nodes merecem identidade global?
- deduplicação de conceitos;
- versionamento/correção de knowledge;
- confiança e conflitos entre fontes;
- materialização de relações vs relações inferidas em runtime.

Essas decisões devem ser tomadas com casos reais, não agora.