import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Transcription } from '../database/entities/transcription.entity';
import { TranscriptionStatus } from '../database/enums';
import type { DatabaseService } from '../database/database.service';
import type { TranscriptionSegment } from '../transcription/types';

export type LoadedWhisperTranscription = {
  sourceId: string;
  provider: string;
  language: string | null;
  segments: TranscriptionSegment[];
  origin: 'database' | 'storage-file';
};

const WHISPER_PROVIDER = 'local-whisper';

/**
 * Load Whisper segments for a source. Prefers COMPLETED local-whisper DB row;
 * falls back to storage/sources/{id}/transcription.json.
 * Never calls Whisper or paid APIs.
 */
export async function loadWhisperTranscription(options: {
  sourceId: string;
  storageDir: string;
  database?: DatabaseService;
}): Promise<LoadedWhisperTranscription> {
  const { sourceId, storageDir, database } = options;

  if (database?.isConnected) {
    const fromDb = await loadFromDatabase(database, sourceId);
    if (fromDb) return fromDb;
  }

  const fromFile = await loadFromStorageFile(storageDir, sourceId);
  if (fromFile) return fromFile;

  throw new Error(
    [
      `No Whisper transcription found for source ${sourceId}.`,
      'Prerequisite: a COMPLETED local-whisper transcription in the database,',
      `or ${join('sources', sourceId, 'transcription.json')} under STORAGE_DIR.`,
      'This POC does not run Whisper or call external APIs.',
    ].join(' '),
  );
}

async function loadFromDatabase(
  database: DatabaseService,
  sourceId: string,
): Promise<LoadedWhisperTranscription | null> {
  const row = await database.getRepository(Transcription).findOne({
    where: {
      sourceId,
      status: TranscriptionStatus.COMPLETED,
      provider: WHISPER_PROVIDER,
    },
    order: { createdAt: 'DESC' },
  });

  if (!row?.segmentsJson?.length) return null;

  return {
    sourceId,
    provider: row.provider,
    language: row.language,
    segments: row.segmentsJson.map((s) => ({
      startSeconds: s.startSeconds,
      endSeconds: s.endSeconds,
      text: s.text,
    })),
    origin: 'database',
  };
}

async function loadFromStorageFile(
  storageDir: string,
  sourceId: string,
): Promise<LoadedWhisperTranscription | null> {
  const path = join(storageDir, 'sources', sourceId, 'transcription.json');
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return null;
  }

  const parsed = JSON.parse(raw) as {
    language?: string;
    segments?: TranscriptionSegment[];
  };

  if (!parsed.segments?.length) return null;

  return {
    sourceId,
    provider: WHISPER_PROVIDER,
    language: parsed.language ?? null,
    segments: parsed.segments.map((s) => ({
      startSeconds: s.startSeconds,
      endSeconds: s.endSeconds,
      text: s.text,
    })),
    origin: 'storage-file',
  };
}
