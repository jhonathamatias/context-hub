# Context Hub — Usable MVP / Hybrid Knowledge Pipeline

> IMPLEMENTATION SPEC
>
> Objetivo: sair da fase de POC e deixar o Context Hub utilizável no dia a dia.

## 1. Objetivo principal

Ao final desta implementação deve ser possível:

1. importar uma aula real do OneDrive;
2. transcrever a aula;
3. extrair conhecimento textual;
4. detectar e ranquear trechos onde a imagem pode acrescentar conhecimento;
5. buscar somente os melhores trechos do vídeo usando remote seek;
6. executar análise multimodal somente nesses trechos;
7. combinar conhecimento textual + visual;
8. indexar o conhecimento;
9. abrir a aula no frontend;
10. visualizar resumo, conceitos, técnicas, exercícios e informações relevantes;
11. fazer perguntas sobre a aula;
12. receber respostas fundamentadas no conteúdo processado;
13. receber referências com timestamps;
14. clicar no timestamp e abrir o vídeo no ponto correspondente.

Marco de sucesso:

> Consigo importar uma aula hoje e, depois de processada, perguntar o que foi ensinado, receber uma resposta baseada naquela aula e navegar para o trecho exato do vídeo.

---

## 2. Antes de implementar

Primeiro analisar o estado ATUAL do repositório.

Ler obrigatoriamente as POCs/specs e implementações relacionadas a:

- Visual Candidate Detector;
- Visual Candidate Ranking;
- Remote Clip + Multimodal Value POC;
- análise final da POC 3;
- transcription;
- knowledge extraction;
- embeddings/indexação;
- Source processing;
- OneDrive connector;
- VideoKnowledgeProvider;
- lesson frontend;
- chat/search existente.

Não recriar componentes que já existem.

Não substituir implementação funcional apenas para deixá-la mais elegante.

Não fazer refactors fora do escopo.

Antes de escrever código, registrar um plano curto mostrando pipeline atual vs pipeline desejado, componentes reutilizados, arquivos que serão alterados e dívida técnica que conscientemente ficará para depois.

---

## 3. Decisões já provadas pelas POCs

Considere estas decisões encerradas:

- Whisper/transcrição continua sendo a base textual;
- não enviar vídeo inteiro ao multimodal;
- `VisualCandidateDetector` identifica possíveis regiões visuais;
- `VisualCandidateRanker` reduz os candidatos;
- Top 3 foi suficiente para provar a hipótese;
- OneDrive remote seek funciona;
- full download pode ser evitado;
- na POC real aproximadamente 14.59% dos bytes do vídeo foram transferidos;
- Top 3 consumiu aproximadamente 12.4k tokens contra ~410k do full-video;
- houve aproximadamente 97% de redução de tokens multimodais;
- 3/3 clips analisados trouxeram informação visual adicional;
- `VideoKnowledgeProvider` deve continuar provider-agnostic;
- Gemini continua sendo apenas um adapter;
- domínio não depende de Gemini;
- core não deve ficar acoplado a guitarra nem a outro instrumento específico.

Não repetir essas POCs.

---

## 4. Pipeline desejado

```text
Source
  ↓
Ingest
  ↓
Transcription
  ↓
Text Knowledge Extraction
  ↓
Visual Candidate Detector
  ↓
Visual Candidate Ranker
  ↓
seleção limitada de candidatos
  ↓
Remote Clip Extraction
  ↓
VideoKnowledgeProvider
  ↓
Visual Knowledge
  ↓
Knowledge Merge
  ↓
Embeddings / Index
  ↓
Source READY
```

Não criar uma segunda pipeline paralela se a atual puder ser evoluída de maneira simples.

---

## 5. Source ↔ Transcription

A POC permitiu usar uma transcrição benchmark de outro source. Isso era aceitável exclusivamente para a POC.

No fluxo real isso é proibido.

Sempre:

```text
Source A
 ↓
video A
 ↓
transcription A
 ↓
visual candidates A
 ↓
clips A
 ↓
visual knowledge A
```

Nunca `Source A + transcription B`.

Remover qualquer fallback de produção capaz de misturar sources. Código isolado de POC pode permanecer se necessário, mas o pipeline real nunca deve depender desse comportamento.

---

## 6. Detector + Ranker

Reutilizar as implementações validadas:

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
```

Para o primeiro MVP usar no máximo os Top 3 relevantes.

Se houver menos de três, processar somente os existentes.

Se nenhum candidato relevante existir, continuar normalmente apenas com conhecimento textual.

Ausência de candidato visual não pode fazer o Source falhar.

---

## 7. Remote Clip Extraction

Transformar somente o mínimo necessário da POC de remote seek em componente reutilizável.

Reutilizar o OneDrive connector existente.

```text
RankedVisualCandidate
        ↓
OneDrive temporary playback URL
        ↓
remote seek
        ↓
temporary clip
```

Não baixar o vídeo completo antes de extrair o clip.

Não criar object storage novo nesta entrega.

Clips são artefatos temporários de processamento e devem ter cleanup.

Se remote seek falhar:

- registrar claramente o erro;
- não fazer fallback silencioso para full download;
- utilizar comportamento controlado;
- preferencialmente preservar e concluir o conhecimento textual se o enriquecimento visual não puder ser executado.

Visual enrichment não pode destruir conhecimento textual válido.

---

## 8. Multimodal seletivo

Usar a abstração existente `VideoKnowledgeProvider`.

Não chamar Gemini SDK diretamente no application/pipeline layer.

Gemini permanece atrás do adapter.

Analisar somente clips selecionados.

O prompt multimodal deve buscar informação musical útil presente visualmente que não pode ser recuperada com segurança somente pela transcrição, por exemplo:

- posição/região;
- shape;
- digitação;
- movimento;
- execução;
- técnica visual;
- relação espacial;
- representação visual de acorde/escala/arpejo/lick.

Não inventar detalhes quando a imagem não permitir identificação confiável.

---

## 9. Knowledge Merge

Criar uma etapa explícita equivalente a:

```text
Text Knowledge
+
Visual Knowledge
=
Final Lesson Knowledge
```

Antes de criar novo modelo de domínio, analisar `StructuredLessonKnowledge` atual e reutilizá-lo sempre que semanticamente possível.

Não fazer grande remodelagem de domínio nesta entrega.

Informação visual deve preservar, quando aplicável:

```text
sourceId
startSeconds
endSeconds
 description/propriedade equivalente
provenance
confidence
```

Deve ser possível distinguir conhecimento proveniente de transcript, visual e inference quando isso for relevante.

Evitar duplicação. Se o visual acrescentar detalhe a algo já extraído do texto, preservar o enriquecimento em vez de criar duplicata desnecessária.

Não construir uma ontologia completa agora.

---

## 10. Resiliência

O pipeline precisa ser utilizável mesmo quando o provider multimodal estiver instável.

Exemplo:

```text
Whisper OK
Text Knowledge OK
Visual processing FAILED
```

Resultado esperado:

```text
Source utilizável
Text Knowledge preservado
Visual enrichment failed/skipped
```

Visual enrichment é enriquecimento e não pode virar single point of failure.

429, 503, timeout e erros temporários devem seguir a política de retry existente quando apropriado, sem retry infinito.

Uma tentativa de reprocessamento que falhar não pode apagar ou esconder conhecimento válido anteriormente concluído.

---

## 11. Indexação

Depois do merge:

```text
Final Knowledge
 ↓
chunks
 ↓
embeddings
 ↓
index
```

Reutilizar o pipeline atual.

Conhecimento visual relevante também precisa ser recuperável posteriormente pelo search/RAG.

Uma pergunta como `onde ele mostrou aquele formato de C7?` deve conseguir encontrar conhecimento visual quando ele tiver sido extraído.

Preservar `sourceId` e timestamp nos chunks/referências.

---

## 12. Lesson UI

Analisar e reutilizar o frontend existente, principalmente player, lesson page, timestamp links, transcript, status e knowledge components.

Uma aula READY deve permitir visualizar de forma útil:

- título;
- resumo;
- tópicos;
- conceitos;
- técnicas;
- exercícios;
- ideias práticas;
- informação visual relevante quando existir.

Itens associados a timestamps devem permitir navegar para o ponto correspondente do vídeo.

Não redesenhar todo o frontend.

---

## 13. Chat da aula

O usuário deve conseguir perguntar, por exemplo:

```text
O que ele ensinou sobre C7?
Em qual parte ele mostrou esse formato?
Quais exercícios ele passou?
Como ele aplicou essa ideia?
Em qual trecho ele fala sobre região do braço?
```

A resposta deve usar, quando relevante:

```text
Structured Knowledge
+
indexed chunks
+
transcript
+
visual knowledge
```

A resposta deve fornecer evidência/referência com timestamp.

Exemplo conceitual:

```text
Ele demonstra duas formas diferentes de C7 e compara regiões diferentes do braço.

[36:39]
```

O timestamp deve ser clicável e levar o player para a posição correta.

O objetivo não é apenas responder `Segundo a aula...`; deve ser possível chegar à evidência.

---

## 14. Status de processamento

A UX deve comunicar estados compreensíveis, conceitualmente equivalentes a:

```text
Importando aula
Transcrevendo
Extraindo conhecimento
Analisando trechos visuais
Indexando
Pronto
```

Não expor BullMQ/Gemini ou detalhes internos desnecessários.

Se visual enrichment falhar mas a aula estiver utilizável, não deixar a aula permanentemente FAILED por causa disso.

---

## 15. Validação real

Depois da implementação, processar UMA aula real de ponta a ponta.

Não usar mocks para declarar o MVP concluído.

Validar:

```text
OneDrive
 ↓
Source
 ↓
Transcription
 ↓
Text Knowledge
 ↓
Detector
 ↓
Ranker
 ↓
Remote Clips
 ↓
Multimodal
 ↓
Merge
 ↓
Index
 ↓
READY
 ↓
Lesson UI
 ↓
Question
 ↓
Answer
 ↓
Timestamp
 ↓
Player
```

Depois executar uma segunda aula real para garantir que não existem IDs, timestamps, paths ou outras informações hard-coded provenientes das POCs.

---

## 16. Critérios de aceite

O MVP só está concluído quando:

- [ ] consigo importar uma aula real;
- [ ] não preciso baixar o vídeo inteiro para análise visual seletiva;
- [ ] a transcrição pertence ao mesmo Source;
- [ ] conhecimento textual é extraído;
- [ ] candidatos visuais são detectados;
- [ ] candidatos são ranqueados;
- [ ] somente candidatos selecionados são enviados ao multimodal;
- [ ] conhecimento visual é preservado;
- [ ] texto + visual são combinados;
- [ ] conhecimento final é indexado;
- [ ] Source chega a READY;
- [ ] consigo abrir a aula;
- [ ] consigo ver conhecimento extraído;
- [ ] consigo fazer uma pergunta sobre a aula;
- [ ] a resposta usa conhecimento real daquela aula;
- [ ] a resposta possui referência/timestamp;
- [ ] consigo clicar no timestamp;
- [ ] player navega para o ponto correto;
- [ ] falha no enriquecimento visual não destrói knowledge textual;
- [ ] não existem IDs da POC hard-coded no fluxo de produção;
- [ ] uma segunda aula também funciona.

---

## 17. Fora de escopo agora

Não implementar nesta entrega:

- Top 5 automático;
- todos os HIGH candidates;
- agentic video;
- otimização avançada de resolução;
- otimização prematura dos 14.59% de transferência;
- graph database / Neo4j;
- knowledge graph complexo;
- memória pessoal completa;
- learning history completo;
- spaced repetition;
- gamification;
- capability engine completo;
- dynamic artifacts completo;
- music theory engine completo;
- sistema completo de instrumentos;
- arquitetura guitar-specific no core;
- piano/bass/drums;
- geração de tablatura;
- geração de partitura;
- diagramas avançados;
- multi-agent;
- autonomous agent;
- novo object storage;
- redesign completo do frontend;
- refactor geral;
- troca de ORM;
- troca de queue;
- troca de banco.

As specs de product architecture existentes são direção futura, não backlog desta implementação.

---

## 18. Regras arquiteturais

1. Context Hub continua dono do domínio.
2. Gemini é adapter.
3. `VideoKnowledgeProvider` permanece provider-agnostic.
4. Core não conhece guitarra.
5. Knowledge não depende de instrumento.
6. Source e provenance devem ser preservados.
7. Enriquecimento visual é opcional/resiliente.
8. Código determinístico continua determinístico.
9. LLM não assume responsabilidade já coberta por implementação determinística.
10. Não criar abstrações sem necessidade real.
11. Não alterar entidades/use cases não relacionados para `preparar o futuro`.
12. Não transformar POC em framework.
13. Preferir integrar componentes existentes a reescrevê-los.
14. Nenhum dado específico das POCs pode ficar hard-coded no fluxo real.

---

## 19. Estratégia de implementação

Não fazer tudo em uma alteração gigante.

Ordem:

1. analisar;
2. escrever plano;
3. identificar arquivos que serão alterados;
4. identificar componentes existentes reutilizados;
5. identificar dívida técnica que NÃO será resolvida agora;
6. implementar em pequenas etapas verificáveis.

Após cada etapa executar typecheck, testes e lint quando aplicável.

Não continuar se comportamento existente quebrar sem entender a causa.

---

## 20. Entrega final

Ao terminar criar:

`specs/usable-mvp-implementation-analysis.md`

Documentar:

- arquitetura final implementada;
- fluxo real;
- arquivos/componentes principais;
- o que foi reutilizado das POCs;
- o que virou produção;
- decisões tomadas;
- diferenças em relação às POCs;
- tratamento de falha visual;
- resultado da primeira aula real;
- resultado da segunda aula real;
- perguntas testadas no chat;
- respostas obtidas;
- timestamps retornados;
- problemas encontrados;
- dívida técnica conscientemente deixada para depois.

Finalizar obrigatoriamente com uma destas decisões:

```text
USABLE MVP: PASS
```

ou

```text
USABLE MVP: FAIL
```

Se FAIL, explicar exatamente o que ainda impede o uso diário.

## Princípio final

O objetivo desta entrega não é obter arquitetura perfeita.

O objetivo é conseguir USAR o Context Hub de ponta a ponta.