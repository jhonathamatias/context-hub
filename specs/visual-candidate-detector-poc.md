# POC 2 — Visual Candidate Detector

## Contexto

A POC multimodal anterior confirmou que o Context Hub consegue analisar uma aula inteira com um `VideoKnowledgeProvider` agnóstico de vendor, usando Gemini como adapter atual.

Na aula benchmark (`5fe720dc-d4a4-42dd-81be-f236a3eea095` — Talisson, Modo Jônio / criação melódica), o processamento do vídeo inteiro consumiu aproximadamente 384k tokens de input/total na ordem de grandeza observada. `media_resolution=low` não trouxe redução relevante de input tokens nessa amostra, e a cota do Gemini foi esgotada durante os experimentos.

Antes de fazer novas chamadas multimodais, queremos validar uma estratégia híbrida: usar processamento local para descobrir quais partes da aula realmente dependem da imagem e, futuramente, enviar somente esses trechos para análise visual.

Esta POC NÃO deve chamar Gemini nem qualquer API paga.

## Objetivo

Responder somente esta pergunta:

> De uma aula inteira de guitarra, quantos minutos provavelmente dependem da imagem para serem compreendidos corretamente?

Fluxo desta POC:

```text
Vídeo
  ↓
Pipeline local existente / Whisper
  ↓
TranscriptSegment[] com timestamps
  ↓
VisualCandidateDetector
  ↓
VisualCandidate[]
  ↓
Métricas de cobertura visual
```

A POC termina aqui.

## Hipótese

Uma aula longa contém muita fala que pode ser compreendida somente pela transcrição, enquanto demonstrações de guitarra dependem de informação visual apenas em determinados momentos.

Se uma aula de aproximadamente 50 minutos resultar em poucos minutos de candidatos visuais, uma próxima POC poderá recortar apenas essas janelas e compará-las com o baseline multimodal de vídeo inteiro.

Não force uma cobertura pequena. O objetivo é medir o comportamento real.

## Regras inegociáveis

- Não chamar Gemini.
- Não chamar nenhuma API paga.
- Não recortar vídeo com FFmpeg nesta POC.
- Não alterar `StructuredLessonKnowledge`.
- Não criar migrations ou tabelas novas.
- Não alterar frontend.
- Não alterar o pipeline multimodal existente.
- Não remover ou reescrever o pipeline legacy/Whisper.
- Não criar arquitetura para processamento de clips ainda.
- Não fazer refactors fora do escopo.
- Reutilizar tipos e dados existentes sempre que possível.

## Primeiro: inspecionar o código existente

Antes de implementar, localize e entenda:

- os tipos reais usados para segmentos da transcrição;
- onde os timestamps do Whisper são persistidos;
- como recuperar a transcrição mais recente/completa de uma `Source`;
- repositories/services existentes relacionados a `Transcription`;
- utilitários de duração/timestamp existentes;
- testes existentes que possam ser reaproveitados.

Não crie `TranscriptSegment` duplicado se já existir um tipo equivalente.

## Contrato desejado

Crie uma abstração simples e vendor-agnostic equivalente a:

```ts
export interface VisualCandidateDetector {
  detect(segments: TranscriptSegment[]): Promise<VisualCandidate[]>;
}
```

O resultado conceitual deve conter pelo menos:

```ts
export type VisualCandidate = {
  startSeconds: number;
  endSeconds: number;
  reason: string;
  confidence: number;
  trigger?: string;
};
```

Adapte os nomes aos padrões existentes do projeto quando fizer sentido.

Não adicione conceitos de Gemini, OpenAI ou outro vendor ao contrato.

## Estratégia inicial — heurística local

A primeira implementação deve ser determinística e local.

Procure no texto da transcrição expressões que indiquem que o professor provavelmente está demonstrando algo visualmente.

Exemplos iniciais:

- olha aqui
- olha isso
- olha esse
- olha essa
- esse desenho
- essa posição
- desse jeito
- dessa forma
- faço assim
- faz assim
- vou mostrar
- deixa eu mostrar
- vou tocar
- vou fazer
- esse acorde
- essa escala
- esse arpejo
- esse lick
- nessa casa
- essa casa
- nessa região
- esse formato
- essa digitação
- essa posição da mão

Essa lista não é definitiva.

Organize as expressões de forma fácil de evoluir sem espalhar strings pelo código.

Considere normalização simples para melhorar matching em português, sem introduzir dependências complexas desnecessárias.

## Padding da janela

Quando um segmento for identificado como candidato, expanda sua janela inicialmente com:

- 5 segundos antes;
- 15 segundos depois.

O início nunca pode ser negativo.

Esses valores podem ser constantes/configuração interna da POC. Não é necessário adicionar env vars apenas para isso.

Exemplo:

```text
segmento detectado: 04:30 → 04:40
candidato inicial:  04:25 → 04:55
```

## Merge de candidatos

Candidatos sobrepostos ou muito próximos devem ser unidos para evitar duplicação futura de clips.

Exemplo:

```text
04:15 → 04:35
04:22 → 04:42
04:35 → 04:55
```

Resultado esperado:

```text
04:15 → 04:55
```

Além de overlap direto, faça merge quando o intervalo entre dois candidatos for pequeno (sugestão inicial: até 10 segundos).

Ao fazer merge:

- `startSeconds` deve ser o menor início;
- `endSeconds` deve ser o maior fim;
- preserve informação suficiente para entender quais triggers/reasons causaram o candidato;
- não duplique candidatos equivalentes.

## Métricas

A execução da POC deve produzir pelo menos:

```ts
{
  videoDurationSeconds: number;
  candidateCount: number;
  totalCandidateSeconds: number;
  coveragePercent: number;
}
```

Onde:

```text
coveragePercent =
  totalCandidateSeconds / videoDurationSeconds * 100
```

`totalCandidateSeconds` deve considerar os candidatos DEPOIS do merge, para não contar sobreposição duas vezes.

Também apresente cada candidato com:

- início;
- fim;
- duração;
- trigger(s);
- reason(s);
- confidence, se aplicável.

## Como executar

Crie a forma mais simples possível de executar a POC para uma `sourceId` existente.

Pode ser um script/CLI interno se isso for mais simples do que criar endpoint/job.

Não crie endpoint HTTP, BullMQ job ou tela apenas para esta POC se não forem necessários.

Exemplo conceitual:

```bash
pnpm poc:visual-candidates <sourceId>
```

O comando exato deve seguir os padrões existentes do projeto.

A execução deve reutilizar a transcrição já persistida quando ela existir. Não reprocessar Whisper desnecessariamente.

Se não existir transcrição adequada para a source, falhe com mensagem clara informando o pré-requisito, em vez de chamar serviços externos.

## Aula benchmark

Quando os dados locais estiverem disponíveis, execute com a mesma aula usada na POC multimodal anterior:

```text
sourceId:
5fe720dc-d4a4-42dd-81be-f236a3eea095

Aula:
Talisson — Modo Jônio / criação melódica
```

Baseline conhecido da POC anterior:

```text
vídeo inteiro → Gemini multimodal
≈ 384k tokens
```

Nesta POC não haverá comparação de tokens ainda.

Queremos descobrir somente quanto do vídeo seria candidato a análise visual.

## Exemplo de saída

```text
Visual Candidate Detector

Source: 5fe720dc-d4a4-42dd-81be-f236a3eea095
Video duration: 52m 03s

Candidates:

1. 04:22 → 05:05 (43s)
   triggers: "olha esse desenho", "nessa casa"

2. 11:14 → 12:03 (49s)
   triggers: "esse lick", "vou tocar"

3. 17:40 → 18:15 (35s)
   trigger: "essa posição"

...

Candidate count: 7
Candidate duration: 5m 12s
Visual coverage: 9.99%
```

Os números acima são apenas exemplo. Não tente reproduzi-los artificialmente.

## Critério de sucesso

Esta POC não tem um percentual obrigatório para ser considerada tecnicamente correta.

O resultado deve permitir tomar uma decisão.

Interpretação sugerida:

### Cobertura baixa

```text
~5–15%
```

Sinal forte de que vale testar análise multimodal somente dos candidatos.

### Cobertura intermediária

```text
~15–35%
```

Pode valer a pena, mas provavelmente precisaremos melhorar classificação/ranking dos candidatos antes de enviar todos ao multimodal.

### Cobertura muito alta

```text
>35–40%
```

Não avance automaticamente para Gemini. Primeiro investigue falsos positivos e qualidade da heurística.

Essas faixas são orientação para análise, não regra de negócio.

## Qualidade dos candidatos

Além do percentual, faça uma revisão simples dos resultados.

Para cada candidato, queremos conseguir responder:

- a frase realmente sugere dependência visual?
- provavelmente existe uma demonstração de guitarra nesse momento?
- o padding parece suficiente?
- candidatos consecutivos representam a mesma demonstração?
- existem falsos positivos óbvios?

Também observe possíveis falsos negativos manualmente se houver acesso fácil à transcrição.

Não implemente classificador LLM nesta POC para corrigir isso.

## Próxima etapa — NÃO implementar agora

Somente se esta POC indicar redução relevante, a próxima experiência será:

```text
VisualCandidate[]
      ↓
FFmpeg
      ↓
clips/frames mínimos
      ↓
VideoKnowledgeProvider
      ↓
VisualKnowledge
      ↓
merge com conhecimento textual
```

Nessa próxima etapa será medido:

- minutos multimodais enviados;
- tokens;
- custo;
- qualidade visual;
- precisão de timestamps;
- comparação com o baseline de ~384k tokens.

Não implemente essa etapa agora.

## Testes

Adicionar somente testes relevantes para a POC:

1. expressão visual gera candidato;
2. texto normal não gera candidato;
3. matching funciona com variações simples de caixa/acentuação quando suportado pela normalização escolhida;
4. padding anterior é aplicado;
5. início nunca fica negativo;
6. padding posterior é aplicado;
7. intervalos sobrepostos são unidos;
8. intervalos próximos são unidos conforme threshold;
9. intervalos distantes permanecem separados;
10. duração total não conta overlap duas vezes;
11. `coveragePercent` é calculado corretamente;
12. lista vazia retorna métricas coerentes.

## Entrega

Ao finalizar:

1. rode testes existentes e novos;
2. rode typecheck/lint conforme scripts existentes;
3. liste arquivos criados/alterados;
4. explique como executar a POC para qualquer `sourceId`;
5. confirme explicitamente que nenhuma chamada Gemini/API paga é feita;
6. se a aula benchmark estiver disponível localmente, execute nela;
7. reporte duração total da aula;
8. reporte quantidade de candidatos após merge;
9. reporte duração total dos candidatos;
10. reporte `coveragePercent`;
11. liste todos os candidatos encontrados com triggers/reasons;
12. aponte falsos positivos evidentes encontrados na amostra;
13. aponte limitações/falsos negativos prováveis da heurística;
14. dê uma recomendação: avançar ou não para a POC de clips multimodais;
15. pare após essa análise — não implemente FFmpeg/Gemini/merge visual sem nova aprovação.

## Princípio final

Esta POC existe para economizar chamadas multimodais antes de otimizar qualquer provider.

Primeiro descubra **o que realmente precisa ser visto**.

Só depois pagaremos para um modelo ver esses trechos.