# OneDrive ingest — notas da POC (sem refactor)

Baseado no código atual (`source-ingest.service`, `onedrive.connector`, storage, multimodal).

## Quantas vezes os bytes do vídeo trafegam

1. **Download OneDrive → temp** (`TEMP_DIR/onedrive-*/download.{ext}`, ephemeral)
2. **Copy temp → storage persistente** (`STORAGE_DIR/sources/{sourceId}/original.{ext}`)
3. **Leitura para SHA-256** no adapter Gemini (reuso de file-ref)
4. **Upload para Gemini Files API** — só se não houver referência remota válida

Total típico no primeiro processamento: **3 hops locais + 1 upload remoto**.
Em retry/reprocess com cache válido: **sem novo upload** (só leitura local para hash + `files.get`).

## Arquivo temporário / local

| Onde | Path |
|------|------|
| Temp OneDrive | `{TEMP_DIR}/onedrive-*/download.{ext}` (limpo após persist) |
| Canônico | `{STORAGE_DIR}/sources/{sourceId}/original.{ext}` |
| Cache Gemini | `{STORAGE_DIR}/sources/{sourceId}/gemini-file-ref.json` |

## Stream/upload sem materializar localmente?

O SDK `@google/genai` aceita path ou `Blob` em `files.upload`. Em tese, um futuro connector poderia streamar para upload sem double-write em disco — **não implementado nesta POC**. Hoje o ingest sempre materializa o arquivo completo localmente antes do multimodal.

## Ganhos possíveis

| Tipo | Ganho |
|------|--------|
| I/O / tempo | Evitar copy temp→storage ou stream direto ao Gemini (fora de escopo) |
| Tokens / custo Gemini | `GEMINI_VIDEO_PROCESSING_MODE=agentic` e `GEMINI_VIDEO_MEDIA_RESOLUTION=low` (adapter-only) |
