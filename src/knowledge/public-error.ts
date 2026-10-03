/**
 * User-facing knowledge soft-fail copy. Keep provider/quota internals out of the UI.
 */
export const KNOWLEDGE_SOFT_FAIL_USER_MESSAGE =
  'Não foi possível gerar o resumo agora. A transcrição e a busca continuam disponíveis.';

export function toPublicKnowledgeErrorMessage(raw: string): string {
  const text = raw.trim();
  if (!text) return KNOWLEDGE_SOFT_FAIL_USER_MESSAGE;

  const looksInternal =
    /\b(429|quota|rate[\s_-]?limit|fallback|ollama|gemini|openai|ETIMEDOUT|ECONNREFUSED|RESOURCE_EXHAUSTED|Retry-After|statusCode)\b/i.test(
      text,
    ) || text.length > 280;

  return looksInternal ? KNOWLEDGE_SOFT_FAIL_USER_MESSAGE : text;
}
