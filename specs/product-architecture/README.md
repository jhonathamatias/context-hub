# Context Hub — Product Architecture Roadmap

> 🚫 **DESIGN SPEC — DO NOT IMPLEMENT YET**
>
> Estas specs descrevem a direção arquitetural futura do produto. Nenhuma delas autoriza implementação antes da conclusão e revisão da POC 3 (`remote-clip-multimodal-value-poc.md`).

## Visão

O Context Hub não deve ser uma aplicação de guitarra nem apenas um chat sobre vídeos. O objetivo é construir uma plataforma de conhecimento e aprendizagem musical capaz de entender fontes, relacionar conceitos, incorporar memória do usuário e oferecer capacidades especializadas de forma extensível.

```text
Sources / Videos / Notes
          ↓
   Knowledge Ingestion
          ↓
     Knowledge Core
          +
      User Memory
          ↓
    Context Builder
          ↓
    AI Orchestrator
          ↓
  Capability Registry
          ↓
 Response + Artifacts
```

Instrumentos são extensões da plataforma, não o centro do domínio.

## Princípios arquiteturais

1. O core não conhece guitarra.
2. Conhecimento musical não depende de instrumento.
3. Instrumentos são extensões substituíveis/adicionáveis.
4. Capabilities devem ser pequenas e composáveis.
5. Artifacts devem ser extensíveis e versionados.
6. LLM decide/orquestra; código determinístico calcula o que puder ser calculado com segurança.
7. Providers de IA são substituíveis.
8. Knowledge não depende da origem: vídeo, áudio, PDF, anotação ou futuras fontes.
9. User Memory não depende de instrumento.
10. Não modelar hoje todas as possibilidades futuras.
11. Novas ideias devem preferencialmente entrar como novo tipo de knowledge, capability, instrument extension ou artifact — sem alterar o core.
12. Flexibilidade não significa abandonar tipos, validação ou invariantes.
13. Evitar abstrações antecipadas sem pelo menos um segundo caso concreto.
14. Não transformar o sistema em um framework genérico antes de validar o produto.

## Teste arquitetural

Quando surgir uma ideia nova, perguntar:

> Esta capacidade pode ser adicionada sem alterar o núcleo?

Exemplos futuros:

- treino de ouvido baseado em erros;
- aplicação de conceito em outro instrumento;
- exercício de ritmo;
- geração de voicings;
- comparação entre explicações do mesmo conceito;
- criação de rotina de prática;
- aplicação de uma aula a uma música;
- representação para um instrumento ainda não suportado.

Se toda ideia exigir mudanças em Knowledge Core, RAG, banco, AIResponse e frontend simultaneamente, a arquitetura está acoplada demais.

## Specs

1. `01-musical-knowledge-model.md` — núcleo de conhecimento musical independente de instrumento.
2. `02-user-memory-and-annotations.md` — notas, ideias, favoritos e histórico de aprendizagem.
3. `03-capability-engine.md` — capabilities pequenas, registráveis e composáveis.
4. `04-dynamic-artifacts.md` — respostas ricas além de texto, com artifacts extensíveis/versionados.
5. `05-music-theory-capabilities.md` — cálculos musicais determinísticos independentes de instrumento.
6. `06-instrument-extension-model.md` — guitarra, piano, baixo e futuros instrumentos como extensões.
7. `07-contextual-ai-orchestrator.md` — construção de contexto e composição das capacidades pela IA.

## Dependências conceituais

```text
01 Knowledge Model
       │
       ├──────────→ 02 User Memory
       │
       └──────────→ 03 Capability Engine
                          │
             ┌────────────┼────────────┐
             ↓            ↓            ↓
        04 Artifacts   05 Theory   06 Instruments
             └────────────┼────────────┘
                          ↓
                 07 AI Orchestrator
```

Isso não significa que tudo precisa ser implementado de uma vez.

## Ordem futura sugerida

Após a POC 3 e somente se houver decisão de continuar:

1. consolidar Knowledge Model mínimo;
2. annotations + ideas + favorites;
3. construir contexto do usuário;
4. capability engine mínimo com 2–3 capabilities reais;
5. artifacts mínimos necessários para essas capabilities;
6. theory capabilities determinísticas conforme casos reais;
7. primeiro instrument extension (guitarra) como prova da extensão;
8. validar um segundo instrumento antes de generalizar mais;
9. evoluir AI Orchestrator progressivamente.

## Regra anti-overengineering

Estas specs definem fronteiras e princípios, não uma obrigação de criar interfaces/classes/tabelas para cada conceito imediatamente.

Na implementação futura:

- implementar somente o necessário para o caso de uso atual;
- preferir contratos pequenos;
- criar abstração quando existir pressão real de variação;
- evitar factories/registries genéricos sem necessidade;
- preservar compatibilidade com o pipeline atual sempre que possível.

## Relação com a POC multimodal

O pipeline atual é responsável por **adquirir conhecimento**:

```text
Video
 ↓
Whisper
 ↓
Detector
 ↓
Ranker
 ↓
Multimodal
 ↓
Knowledge Extraction
```

Estas specs descrevem principalmente como o produto poderá **usar conhecimento** depois.

A arquitetura de produto não deve depender de Gemini, Whisper, OneDrive ou de qualquer provider específico.