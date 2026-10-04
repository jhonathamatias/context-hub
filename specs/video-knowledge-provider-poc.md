# POC — Video Knowledge Provider agnóstico e otimização de custo

## Objetivo

Testar uma evolução do processamento multimodal do Context Hub reduzindo custo/tempo de processamento, sem criar dependência arquitetural do Gemini.

O Gemini deve continuar sendo apenas um adapter/provider substituível. O contrato canônico do Context Hub continua sendo `StructuredLessonKnowledge`.

Esta é uma POC. Fazer a menor mudança possível e medir antes de expandir a arquitetura.

## Regras inegociáveis

- Não acoplar domínio, banco, jobs ou frontend ao Gemini.
- Não alterar `StructuredLessonKnowledge` para acomodar payload específico de provider.
- Não remover o pipeline legacy/Whisper.
- Não fazer refactor amplo.
- Não criar migrations/tabelas novas sem necessidade comprovada.
- Não espalhar `if (provider === 'gemini')` pela aplicação.
- Recursos específicos do Gemini devem permanecer dentro do adapter Gemini.
- O pipeline deve continuar funcionando mesmo se futuramente o Gemini for removido.

## Arquitetura desejada

```text
Video
  |
  v
VideoKnowledgeProvider
  |
  +-- GeminiVideoKnowledgeProvider
  +-- futuro provider multimodal
  +-- futuro provider local
  |
  v
StructuredLessonKnowledge
  |
  +-- Postgres
  +-- Embeddings
  +-- Index/RAG
```

O contrato deve continuar equivalente a:

```ts
interface VideoKnowledgeProvider {
  analyze(input: VideoAnalysisInput): Promise<StructuredLessonKnowledge>;
}
```

Não colocar tipos do SDK Gemini nesse contrato.

## Primeiro: inspecionar o código existente

Antes de implementar, leia pelo menos:

- `GeminiVideoKnowledgeProvider`;
- `VideoKnowledgeProvider` e `VideoAnalysisInput`;
- configuração/DI responsável pela escolha do provider;
- multimodal job/handler;
- `StructuredLessonKnowledge`;
- `file-ref` e cache atual da Gemini Files API;
- OneDrive connector e fluxo de ingest;
- configuração BullMQ/retries;
- testes multimodais existentes.

Preserve os comportamentos que já estão corretos.

## Parte 1 — Blindar independência de provider

Verifique se a implementação atual permite substituir Gemini sem alterar use cases/domínio.

Se já permitir, não crie novas abstrações.

Se houver vazamento de tipos/configuração Gemini para application/domain, faça somente a correção mínima.

A seleção do provider deve acontecer em composition root/factory/DI, centralizada.

Preferir uma configuração genérica como:

```env
VIDEO_KNOWLEDGE_PROVIDER=gemini
```

Evitar fazer o restante da aplicação conhecer `gemini` além da composição/configuração.

O pipeline `legacy`/Whisper deve permanecer disponível e independente.

## Parte 2 — Atualizar SDK Gemini dentro do adapter

Avalie migrar o adapter do SDK legado `@google/generative-ai` para o SDK atual `@google/genai`.

IMPORTANTE:

- confirme a API real disponível na versão instalada/selecionada antes de codificar;
- não invente métodos/model IDs;
- altere somente o adapter Gemini e infraestrutura estritamente necessária;
- preserve o contrato `VideoKnowledgeProvider`;
- preserve o mapeamento para `StructuredLessonKnowledge`;
- preserve structured JSON/schema validation;
- preserve tratamento normalizado de erros;
- preserve cache/reuso de arquivo remoto quando possível.

## Parte 3 — Testar processamento de vídeo mais econômico

O objetivo da POC é comparar o processamento atual com opções mais econômicas disponíveis no SDK/API atual.

Investigue e, se suportado oficialmente pelo modelo/API utilizados, teste:

1. processamento agentic de vídeo;
2. resolução de mídia baixa (`low`) para vídeo;
3. combinação dos dois quando suportada.

Esses recursos são otimizações internas do `GeminiVideoKnowledgeProvider`.

Nenhuma outra camada deve saber que existem.

Deixe configurável para permitir A/B sem alterar código, por exemplo conceitualmente:

```env
GEMINI_VIDEO_PROCESSING_MODE=static|agentic
GEMINI_VIDEO_MEDIA_RESOLUTION=low|medium|high
```

Use apenas nomes/valores realmente suportados pela API atual. Se a API não suportar algum item, documente e não simule o recurso.

Defaults devem preservar um caminho seguro.

## Parte 4 — Não perder o cache já implementado

A implementação atual reaproveita a referência do arquivo Gemini usando hash do vídeo e validade da referência remota.

Esse comportamento é importante.

Após a migração, retry/reprocessamento não deve fazer upload do vídeo novamente se a referência remota válida puder ser reutilizada.

Se o novo SDK exigir mudança nesse mecanismo, adapte-o mantendo o mesmo objetivo.

Não crie persistência nova apenas para esta POC.

## Parte 5 — OneDrive

NÃO refatore o ingest do OneDrive nesta tarefa.

Somente documente, com base no código atual:

- quantas vezes os bytes do vídeo trafegam;
- onde existe arquivo temporário/local;
- se o SDK atual permitiria no futuro stream/upload sem materializar o vídeo inteiro localmente;
- quais ganhos seriam de tempo/I/O e quais seriam de tokens/custo Gemini.

Não misture essa otimização com a POC do provider.

## Parte 6 — Resiliência

Preserve a política de retry via BullMQ para erros transitórios como 429/503.

Não implemente loops longos de retry dentro do provider.

Não faça fallback automático para Whisper apenas porque Gemini teve uma indisponibilidade temporária.

Whisper deve continuar sendo um pipeline independente que pode ser escolhido explicitamente.

## Parte 7 — Métricas da POC

Precisamos conseguir comparar a MESMA aula nos modos disponíveis.

Registre/logue, quando a API disponibilizar:

- provider;
- model;
- processing mode;
- media resolution;
- sourceId;
- duração total da chamada;
- input tokens;
- output tokens;
- total tokens;
- se houve upload ou reuso de arquivo;
- quantidade de retries.

Não invente token usage se a API não fornecer.

Não logue prompt completo, resposta completa, vídeo ou API key.

## Critério de qualidade

Custo menor não basta.

Compare o conhecimento produzido para a mesma aula considerando:

- resumo;
- tópicos;
- timestamps;
- técnicas;
- acordes;
- escalas/arpejos;
- exercícios;
- licks/ideias práticas;
- recomendações do professor;
- informação visual que não aparece claramente na fala.

O objetivo é descobrir o menor custo que mantém qualidade aceitável para aulas de guitarra.

## Cenários a comparar

Quando suportados pela API/modelo atual:

### A — baseline
Processamento multimodal atual.

### B — low resolution
Mesmo provider/modelo com resolução de mídia reduzida.

### C — agentic
Processamento agentic com configuração segura.

### D — agentic + low
Combinação, se oficialmente suportada.

Todos devem produzir `StructuredLessonKnowledge` compatível.

## Testes

Adicionar/ajustar somente testes relevantes:

1. provider continua obedecendo `VideoKnowledgeProvider`;
2. resultado continua validando como `StructuredLessonKnowledge`;
3. cache de file reference continua sendo reutilizado;
4. configuração específica Gemini não vaza para domínio/use case;
5. legacy/Whisper continua funcionando;
6. erro transitório continua chegando à política de retry apropriada;
7. configurações inválidas falham de maneira clara.

## Fora de escopo

Não fazer nesta tarefa:

- Cloud Storage;
- migrations novas para cache;
- novo provider OpenAI/Anthropic/local;
- remoção do Whisper;
- redesign do frontend;
- reescrita do OneDrive connector;
- circuit breaker complexo;
- abstrações para problemas que ainda não existem.

## Entrega

Ao terminar:

1. rode testes, typecheck e lint existentes;
2. liste arquivos alterados;
3. explique o fluxo antes/depois;
4. informe quais recursos Gemini específicos ficaram isolados no adapter;
5. confirme que remover Gemini futuramente não exige alterar domínio/use cases;
6. mostre como executar cada cenário A/B/C/D;
7. apresente uma tabela com tempo, tokens e qualidade observada se houver dados reais;
8. documente qualquer recurso que a API/modelo atual não suporte;
9. diga explicitamente se cada tentativa/reprocessamento faz novo upload ou reutiliza o arquivo remoto;
10. não faça melhorias adicionais fora desta spec.

## Princípio final

O Context Hub é o produto.

Gemini é somente uma implementação substituível de `VideoKnowledgeProvider`.

Otimize o Gemini agressivamente onde fizer sentido, mas não permita que decisões específicas dele definam a arquitetura do Context Hub.
