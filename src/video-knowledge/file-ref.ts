import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

/**
 * Local cache of a Gemini Files API reference for reprocessing.
 * Kept outside the domain — only the Gemini adapter uses this.
 */
export type GeminiVideoFileRef = {
  fileName: string;
  fileUri: string;
  mimeType: string;
  contentSha256: string;
  expiresAt: string | null;
};

export async function hashFileSha256(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

export function geminiFileRefPath(storageDir: string, sourceId: string): string {
  return join(storageDir, 'sources', sourceId, 'gemini-file-ref.json');
}

export async function readGeminiFileRef(
  storageDir: string,
  sourceId: string,
): Promise<GeminiVideoFileRef | null> {
  const path = geminiFileRefPath(storageDir, sourceId);
  try {
    await access(path);
    const raw = JSON.parse(await readFile(path, 'utf8')) as GeminiVideoFileRef;
    if (!raw.fileUri || !raw.mimeType || !raw.contentSha256) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function writeGeminiFileRef(
  storageDir: string,
  sourceId: string,
  ref: GeminiVideoFileRef,
): Promise<void> {
  const path = geminiFileRefPath(storageDir, sourceId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(ref, null, 2), 'utf8');
}

export function isGeminiFileRefReusable(
  ref: GeminiVideoFileRef,
  contentSha256: string,
): boolean {
  if (ref.contentSha256 !== contentSha256) return false;
  if (!ref.expiresAt) return true;
  return Date.parse(ref.expiresAt) > Date.now() + 60_000;
}
