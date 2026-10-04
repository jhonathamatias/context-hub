# 02 — User Memory and Annotations

> 🚫 **DESIGN SPEC — DO NOT IMPLEMENT YET**
>
> Implementação bloqueada até conclusão/revisão da POC 3.

## Objetivo

Transformar o Context Hub em uma memória de aprendizagem, não apenas uma base de vídeos.

O usuário deve poder acrescentar contexto próprio ao conhecimento:

- anotações;
- ideias;
- favoritos;
- marcações;
- intenção de praticar/revisar;
- histórico de interação/aprendizagem.

Tudo independente de instrumento.

## Conceitos

```text
UserAnnotation
UserIdea
UserFavorite
LearningActivity
```

Não criar subclasses/tabelas excessivas agora. Estes nomes representam responsabilidades conceituais.

## Target genérico

Uma memória deve poder apontar para diferentes alvos:

```ts
interface MemoryTarget {
  type: string;
  id: string;
  startSeconds?: number;
  endSeconds?: number;
}
```

Exemplos:

```text
source/video @ 32:35
knowledge concept
exercise
AI artifact
future song/project
```

Evitar `GuitarAnnotation`, `GuitarFavorite`, etc.

## Annotation

Exemplo:

```text
"Essa explicação finalmente fez sentido."
→ source X @ 32:35
→ concepts: C Ionian, pentatonic
```

Annotations são conteúdo explícito do usuário e não devem ser reescritas silenciosamente pela IA.

## Idea

Uma Idea captura intenção ou associação criada pelo usuário:

```text
"Testar isso em Até Depois do Fim"
```

Pode estar relacionada a:

- source/timestamp;
- knowledge;
- música;
- prática;
- outro contexto futuro.

A IA pode sugerir relações, mas a ideia original permanece preservada.

## Favorite / Bookmark

Favorito é uma marca leve e não deve exigir conhecimento estruturado completo.

Exemplos:

- trecho favorito;
- explicação favorita;
- exercício para revisar;
- resposta/artifact útil.

## Learning Activity

Representa eventos úteis para contextualizar aprendizagem, não telemetria indiscriminada.

Exemplos:

```text
watched
annotated
saved
asked-about
practiced
reviewed
completed-exercise
```

Não registrar tudo apenas porque é possível. Histórico deve servir ao usuário.

## Contexto futuro

Pergunta:

> O que devo estudar hoje?

O Context Builder poderá considerar:

```text
knowledge recente
+ anotações
+ ideias pendentes
+ favoritos
+ perguntas anteriores
+ atividades de prática
```

Isso deve permitir personalização baseada em evidência, e não em um prompt genérico.

## Privacidade e controle

Memória pessoal precisa ter origem clara e possibilidade de inspeção/edição/exclusão pelo usuário na implementação futura.

Distinguir:

```text
user-authored
AI-suggested
system-derived
```

Nunca converter inferência da IA em preferência/fato permanente sem política explícita.

## Relação com Knowledge

```text
Knowledge = o que o sistema sabe sobre o conteúdo/música
User Memory = o que o usuário adicionou/fez em relação a esse conhecimento
```

Não misturar os dois domínios.

## Invariantes

1. User Memory não depende de instrumento.
2. Conteúdo explícito do usuário preserva autoria.
3. Toda memória possui origem e target quando aplicável.
4. IA não transforma hipótese em memória factual silenciosamente.
5. Histórico deve ser útil para aprendizagem, não apenas analytics.
6. Não exigir que um target seja vídeo; futuras fontes devem funcionar.

## Fora de escopo agora

- spaced repetition completo;
- gamificação;
- streaks;
- recommendation engine;
- agenda/calendário;
- sincronização externa;
- modelo de proficiência complexo;
- social/sharing.