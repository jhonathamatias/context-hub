/**
 * Parse JSON from LLM output that may include fences or trailing junk.
 * Does not invent missing fields — only extracts a complete object when possible.
 */
export function parseLlmJsonObject(raw: string): unknown {
  const cleaned = stripCodeFences(raw).trim();
  if (!cleaned) {
    throw new Error('LLM returned empty JSON content');
  }

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const extracted = extractBalancedObject(cleaned);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch {
        // fall through
      }
    }
    const message =
      firstError instanceof Error ? firstError.message : String(firstError);
    throw new Error(`Failed to parse LLM JSON: ${message}`);
  }
}

function stripCodeFences(value: string): string {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

function extractBalancedObject(value: string): string | null {
  const start = value.indexOf('{');
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < value.length; i += 1) {
    const ch = value[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, i + 1);
      }
    }
  }

  return null;
}
