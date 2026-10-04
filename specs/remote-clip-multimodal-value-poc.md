# POC 3 — Remote Clip + Multimodal Value

## Contexto

As POCs anteriores validaram duas etapas locais antes de gastar processamento multimodal:

1. `VisualCandidateDetector`: 17 candidatos / ~10m02s / 14.35% de uma aula de ~69m52s.
2. `VisualCandidateRanker`: HIGH + MEDIUM = ~7m41s / 11.01%; Top 5 = ~4m04s / ~5.8%.

Baseline da análise multimodal do vídeo inteiro:

- Gemini: ~384k tokens para a aula benchmark.
- `media_resolution=low` não trouxe redução estrutural de input tokens no teste anterior.

A aula benchmark é:

```text
sourceId: 5fe720dc-d4a4-42dd-81be-f236a3eea095
Talisson — Modo Jônio / criação melódica
Duração: ~1h09m52s
```

Top candidatos atuais:

```text
1. 36:39–37:33  score 7  (~54s)
2. 31:57–32:19  score 5  (~22s)
3. 32:35–32:57  score 5  (~22s)
4. 33:32–34:34  score 5  (~62s)
5. 42:20–43:44  score 5  (~84s)
```

Esta POC deve começar somente com **Top 3** (~1m38s total), para gastar o mínimo possível antes de provar valor.

Além do custo multimodal, existe outro problema arquitetural atual: o fluxo do OneDrive tende a baixar o arquivo inteiro antes do processamento. Para uma aula longa, isso pode ser desperdício se precisamos apenas de poucos trechos.

Esta POC deve testar as duas hipóteses em conjunto:

1. É possível extrair trechos arbitrários do vídeo remoto do OneDrive sem transferir o arquivo inteiro?
2. O multimodal encontra conhecimento visual relevante que não está disponível apenas na transcrição?

## Objetivo

Executar um experimento pequeno e mensurável:

```text
OneDrive
   ↓
playback/download URL temporária
   ↓
remote seek / FFmpeg
   ↓
Top 3 clips
   ↓
VideoKnowledgeProvider
   ↓
resultado multimodal
   ↓
comparação com transcript
```

Ao final devemos saber:

- se remote seek é viável;
- quantos bytes foram transferidos para gerar os clips;
- quanto isso representa comparado ao arquivo inteiro;
- quantos tokens o multimodal consumiu;
- quanto isso representa comparado ao baseline ~384k;
- se apareceu conhecimento visual novo e útil.

## Princípio principal

Esta POC não existe para implementar o pipeline final.

Ela existe para responder:

> Vale a pena continuar investindo na arquitetura híbrida transcript + visual candidates + clips multimodais?

Não generalize prematuramente.

---

# Parte A — Remote media access

## 1. Inspecionar integração OneDrive existente

Antes de alterar qualquer coisa, leia a implementação atual do connector OneDrive, principalmente o fluxo responsável por:

- resolver playback/download URL;
- obter metadata;
- baixar vídeo;
- criar arquivo temporário/local.

Reutilize o mecanismo atual de autenticação/resolução da URL.

Não crie uma segunda integração Microsoft Graph paralela.

## 2. Não baixar o vídeo inteiro deliberadamente

O objetivo principal desta etapa é descobrir se conseguimos fazer algo equivalente a:

```text
FFmpeg
  ↓
remote OneDrive URL
  ↓
seek 36:39
  ↓
extrair até 37:33
```

sem primeiro executar:

```text
OneDrive → download completo → arquivo local → FFmpeg
```

## 3. Validar suporte remoto

Investigue empiricamente o comportamento da URL temporária retornada pelo fluxo atual.

Registre, quando possível:

- suporte a HTTP Range Requests;
- `Accept-Ranges`;
- `Content-Length`;
- status `206 Partial Content` quando aplicável;
- redirecionamentos;
- comportamento do FFmpeg ao fazer seek;
- bytes efetivamente transferidos.

Não assuma que `Range` implica automaticamente seek eficiente em MP4.

O container, metadata e keyframes podem exigir leituras adicionais.

O resultado deve ser medido.

## 4. Extração dos Top 3

Extrair somente:

```text
36:39 → 37:33
31:57 → 32:19
32:35 → 32:57
```

Preserve alguns segundos de contexto somente se tecnicamente necessário ou se já fizer parte das janelas acima.

Não expanda os clips arbitrariamente.

Produza arquivos temporários locais para a POC.

Não criar storage permanente ainda.

## 5. Qualidade do clip

Não faça otimização agressiva de resolução nesta primeira execução.

Queremos saber se o multimodal consegue enxergar adequadamente:

- braço da guitarra;
- posição da mão;
- shapes;
- casas/cordas quando visíveis;
- execução/demonstração.

Se for necessário re-encode para gerar clips válidos, documente os parâmetros.

Preferir inicialmente preservar qualidade suficiente para avaliação visual.

## 6. Medição de transferência

Para cada clip, registrar pelo menos:

```ts
{
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  outputBytes: number;
  transferredBytes?: number;
  extractionDurationMs: number;
}
```

`transferredBytes` deve representar tráfego remoto real quando for possível medi-lo de forma confiável.

Se não for possível medir precisamente com FFmpeg/HTTP, não invente o número. Documente a limitação e use evidências disponíveis (logs HTTP, range requests, etc.).

Também registrar:

- tamanho total do vídeo remoto;
- soma dos clips;
- percentual de output em relação ao vídeo original;
- evidência de que o arquivo completo foi ou não transferido.

## 7. Fallback

Se remote seek NÃO funcionar eficientemente:

- documentar exatamente o motivo;
- não esconder o problema fazendo fallback silencioso para download completo;
- é permitido executar um fallback controlado somente para continuar a Parte B, mas o relatório deve separar claramente:

```text
REMOTE SEEK RESULT: FAILED
MULTIMODAL VALUE TEST: executed using full-download fallback
```

Não alterar o pipeline principal para usar fallback novo nesta POC.

---

# Parte B — Multimodal value

## 8. Reutilizar VideoKnowledgeProvider

Não acople a POC diretamente ao SDK Gemini se o projeto já possui `VideoKnowledgeProvider`.

O experimento deve reutilizar a abstração existente.

Gemini continua sendo apenas um adapter/provider.

Não altere `StructuredLessonKnowledge` para acomodar campos Gemini.

## 9. Não usar o prompt de aula inteira cegamente

Os clips são pequenos e foram escolhidos porque provavelmente contêm conhecimento visual.

A análise deve enfatizar:

> Identifique informação útil que depende da imagem e que não pode ser inferida com segurança apenas pela fala/transcrição.

Queremos especialmente observar:

- posição/região no braço;
- shape/desenho;
- casas;
- cordas;
- digitação aparente;
- posição da mão;
- movimento;
- técnica demonstrada;
- acorde/escala/arpejo/lick visualmente demonstrado;
- direção/deslocamento no braço;
- informação visual não verbalizada.

Não inventar casas, dedos ou notas quando a imagem não permitir identificar com confiança.

## 10. Resultado experimental separado do domínio

Não altere ainda o contrato canônico `StructuredLessonKnowledge` para suportar detalhes visuais novos.

Para esta POC, pode existir um DTO/resultado experimental equivalente a:

```ts
export type VisualClipKnowledge = {
  clipStartSeconds: number;
  clipEndSeconds: number;
  summary: string;
  visualFindings: Array<{
    type: string;
    description: string;
    startSeconds?: number;
    endSeconds?: number;
    confidence?: number;
  }>;
};
```

O formato exato pode ser adaptado ao projeto.

Mantenha isso fora do domínio permanente até validarmos valor.

## 11. Timestamp absoluto

Se o provider retornar timestamps relativos ao clip, converta no relatório para timestamp absoluto da aula:

```ts
absoluteStart = clipStart + relativeStart;
absoluteEnd = clipStart + relativeEnd;
```

Não persistir timestamps relativos como se fossem absolutos.

## 12. Comparação transcript vs multimodal

Para cada Top 3, recuperar os `TranscriptionSegment[]` correspondentes à janela original.

O relatório deve mostrar lado a lado:

```text
TRANSCRIPT
...

MULTIMODAL
...

NOVO CONHECIMENTO VISUAL
...
```

Classificar manualmente/heuristicamente cada finding como:

```text
NEW_VISUAL_INFORMATION
SUPPORTED_BY_TRANSCRIPT
DUPLICATE_OF_TRANSCRIPT
UNCERTAIN
```

Não precisamos automatizar perfeitamente essa classificação.

O importante é produzir evidência legível para revisão humana.

## 13. Pergunta central de qualidade

Para cada clip responder explicitamente:

> Se tivéssemos apenas a transcrição, perderíamos informação importante que o multimodal conseguiu recuperar?

Exemplo de ganho real:

```text
Transcript:
"vou usar esse desenho da pentatônica"

Multimodal:
"o professor demonstra um shape específico da pentatônica na região X do braço e desloca a mesma forma para ..."
```

Exemplo sem ganho:

```text
Transcript:
"vou usar esse desenho da pentatônica"

Multimodal:
"o professor demonstra um desenho da pentatônica"
```

O segundo caso não justifica sozinho o custo multimodal.

---

# Parte C — Tokens, custo e desempenho

## 14. Telemetria

Usar a telemetria já existente do `VideoKnowledgeProvider` quando possível.

Para cada clip registrar:

```text
model
processing mode
media resolution
duration
input tokens
output tokens
total tokens
file reuse
```

Não colocar campos Gemini específicos no contrato genérico se isso exigir novo acoplamento.

Metadata específica pode permanecer dentro do adapter/telemetria metadata.

## 15. Comparação com baseline

Baseline conhecido:

```text
vídeo inteiro ≈ 384k tokens
```

Calcular:

```text
Top 3 total tokens
Top 3 / 384k
redução percentual aproximada
```

Não extrapolar custo financeiro sem preço/modelo confirmado.

Tokens medidos são mais importantes que estimativa monetária nesta POC.

## 16. Quota / 429 / 503

Não desperdice cota repetindo chamadas agressivamente.

A POC deve respeitar o mecanismo de retry já existente quando aplicável.

Se a cota estiver indisponível:

- não alterar arquitetura para contornar quota;
- salvar os clips/artefatos locais necessários;
- registrar que a Parte A foi concluída;
- permitir executar somente a Parte B posteriormente.

Evite re-upload/reprocessamento desnecessário do mesmo clip se o provider já oferece mecanismo de reuse/cache.

---

# Escopo proibido

Não:

- processar todos os 17 candidatos;
- processar todos os 10 HIGH;
- processar Top 5 nesta primeira execução;
- criar pipeline de produção;
- mudar worker principal;
- mudar frontend;
- criar migrations;
- criar storage definitivo de clips;
- alterar schema permanente de knowledge;
- remover pipeline legacy Whisper;
- remover download atual do OneDrive;
- substituir connector OneDrive;
- implementar S3/GCS/R2;
- criar abstrações genéricas complexas para um experimento;
- otimizar resolução/frame rate antes de termos baseline Top 3;
- fazer refactors fora do necessário.

---

# Execução sugerida

Criar um comando de POC explícito, seguindo os padrões do repositório, por exemplo:

```bash
pnpm poc:remote-multimodal <sourceId>
```

Se for melhor separar para evitar gastar Gemini durante testes:

```bash
pnpm poc:remote-clips <sourceId>
pnpm poc:multimodal-clips <sourceId>
```

A segunda opção é preferível se impedir chamadas multimodais acidentais durante desenvolvimento da Parte A.

Nunca faça chamada Gemini como efeito colateral de teste unitário.

---

# Testes mínimos

Adicionar testes apenas para lógica determinística nova, incluindo quando aplicável:

1. seleção correta do Top 3;
2. geração correta das janelas;
3. conversão timestamp relativo → absoluto;
4. agregação de métricas de clips;
5. agregação de tokens;
6. comparação percentual com baseline;
7. comportamento quando remote extraction falha;
8. garantia de que fallback não é silencioso;
9. relatório funciona quando telemetria/token usage está indisponível;
10. nenhuma chamada externa em testes unitários.

Não tente unit-testar FFmpeg ou Microsoft Graph em detalhes com mocks gigantes.

O comportamento remoto real deve ser validado pela execução da POC.

---

# Relatório obrigatório

Ao terminar, criar uma análise autocontida em `specs/` para revisão externa.

Ela deve conter:

## A. Remote access

```text
Original video size:
Remote seek supported:
HTTP Range evidence:
Full download avoided:
Transferred bytes (if measurable):
Clip output bytes:
Extraction time:
```

Por clip e total.

## B. Multimodal

```text
Clip 1
Transcript:
Multimodal findings:
New visual information:
Tokens:
Duration:

Clip 2
...

Clip 3
...
```

## C. Comparação global

```text
Full video duration: ~69m52s
Top 3 duration: ~1m38s

Full-video baseline tokens: ~384k
Top-3 tokens: X
Token ratio: Y%

Original file bytes: X
Transferred bytes for remote extraction: Y (se mensurável)
Transfer ratio: Z%
```

## D. Avaliação qualitativa

Responder:

1. Quantos dos 3 clips produziram informação visual realmente nova?
2. Qual informação não seria recuperável somente pelo Whisper?
3. O multimodal inventou algum detalhe visual?
4. A qualidade/resolução foi suficiente para braço, mão e shapes?
5. Os timestamps absolutos ficaram corretos?
6. O ranker escolheu bons trechos?
7. O candidato #1 score 7 realmente justificou estar no topo?
8. Remote seek evitou download completo?
9. Qual foi o maior gargalo: transferência, FFmpeg, upload, Gemini ou tokens?
10. Vale avançar para Top 5 / todos HIGH?

## E. Decisão

Terminar com uma das recomendações:

```text
GO
Arquitetura híbrida mostrou ganho visual e redução material de custo/transferência.

ITERATE
Há sinal de valor, mas precisamos ajustar ranking/clips/resolução antes de ampliar.

STOP
O ganho visual não justificou a complexidade/custo comparado à transcrição.
```

Justificar com dados medidos.

---

# Critério de sucesso

Não existe número artificial obrigatório.

A POC será considerada promissora se houver evidência de que:

1. conseguimos evitar grande parte da transferência do vídeo completo OU identificamos claramente a limitação técnica;
2. os Top 3 gastam uma fração material dos ~384k tokens;
3. pelo menos parte dos clips produz conhecimento visual relevante que o transcript não contém;
4. o ganho é suficientemente útil para justificar continuar com a estratégia híbrida.

O principal critério é **valor informacional por custo**, não apenas redução de tokens.

# Princípio final

Não queremos mandar menos vídeo para o Gemini apenas para economizar.

Queremos mandar **somente os trechos em que enxergar muda o que o Context Hub consegue aprender**.

E, se possível, queremos obter esses trechos sem baixar uma aula inteira que não será analisada visualmente.