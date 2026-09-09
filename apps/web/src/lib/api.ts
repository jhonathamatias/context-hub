/**
 * Centralized API layer. Never call fetch() from components.
 * Empty VITE_API_BASE_URL uses same-origin (Vite proxy → API :3000).
 */

export const API_BASE_URL =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined)?.replace(
    /\/$/,
    '',
  ) || '';

export type LessonStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export type LessonPipeline = {
  transcriptionStatus: string | null;
  knowledgeStatus: string | null;
  chunkCount: number;
  embeddingCount: number;
  suggestedTitle: string | null;
};

export type Lesson = {
  id: string;
  title: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  durationSeconds?: number | null;
  status: LessonStatus;
  topics?: string[];
  videoUrl?: string | null;
  pipeline?: LessonPipeline;
};

export type TranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type Transcript = {
  language?: string | null;
  segments: TranscriptSegment[];
};

export type Knowledge = {
  title?: string | null;
  summary?: string | null;
  topics: string[];
  keyIdeas: string[];
  exercises: string[];
};

export type SearchHit = {
  lessonId: string;
  lessonTitle: string;
  startSeconds: number;
  endSeconds: number;
  excerpt: string;
};

export type ChatReference = SearchHit;

export type ChatAnswer = {
  answer: string;
  references: ChatReference[];
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData
          ? {}
          : { 'content-type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('offline', 0);
  }
  if (!res.ok) throw new ApiError('request failed', res.status);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ---------- normalizers: keep the UI stable whatever shape the API returns ---------- */

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    for (const key of [
      'items',
      'data',
      'sources',
      'results',
      'segments',
      'hits',
      'references',
    ]) {
      const inner = (value as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner;
    }
  }
  return [];
}

function pick<T>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string'
          ? item
          : item && typeof item === 'object'
            ? String(
                pick<string>(item as Record<string, unknown>, [
                  'title',
                  'name',
                  'label',
                  'text',
                ]) ?? '',
              )
            : '',
      )
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeStatus(raw: unknown): LessonStatus {
  const status = String(raw ?? 'PENDING').toUpperCase();
  return (['PENDING', 'PROCESSING', 'READY', 'FAILED'] as const).includes(
    status as LessonStatus,
  )
    ? (status as LessonStatus)
    : 'PENDING';
}

/** Com pipeline, READY quando há conhecimento completo ou embeddings (busca/chat). */
export function deriveLessonStatus(
  status: LessonStatus,
  pipeline?: LessonPipeline | null,
): LessonStatus {
  if (status === 'FAILED' || status === 'PENDING') return status;
  if (!pipeline) return status;
  if (pipeline.knowledgeStatus === 'COMPLETED' || pipeline.embeddingCount > 0) {
    return 'READY';
  }
  // Knowledge falhou e ainda não há embeddings → trata como erro, não processando eterno.
  if (pipeline.knowledgeStatus === 'FAILED') {
    return 'FAILED';
  }
  // Transcript falhou
  if (pipeline.transcriptionStatus === 'FAILED') {
    return 'FAILED';
  }
  return 'PROCESSING';
}

function normalizePipeline(raw: unknown): LessonPipeline | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const transcription = (pick<Record<string, unknown>>(o, ['transcription']) ??
    {}) as Record<string, unknown>;
  const knowledge = (pick<Record<string, unknown>>(o, ['knowledge']) ??
    {}) as Record<string, unknown>;
  const chunks = (pick<Record<string, unknown>>(o, ['chunks']) ??
    {}) as Record<string, unknown>;
  const embeddings = (pick<Record<string, unknown>>(o, ['embeddings']) ??
    {}) as Record<string, unknown>;
  return {
    transcriptionStatus:
      pick<string>(transcription, ['status']) ?? null,
    knowledgeStatus: pick<string>(knowledge, ['status']) ?? null,
    chunkCount: Number(pick<number>(chunks, ['count']) ?? 0),
    embeddingCount: Number(pick<number>(embeddings, ['count']) ?? 0),
    suggestedTitle: pick<string>(knowledge, ['suggestedTitle']) ?? null,
  };
}

function normalizeLesson(raw: unknown): Lesson {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pipeline =
    normalizePipeline(pick(o, ['pipeline'])) ??
    (o.transcription || o.knowledge ? normalizePipeline(o) : undefined);
  const status = deriveLessonStatus(
    normalizeStatus(pick<string>(o, ['status', 'state'])),
    pipeline,
  );
  return {
    id: String(pick<string>(o, ['id', 'sourceId', '_id']) ?? ''),
    title: String(
      pick<string>(o, [
        'title',
        'suggestedTitle',
        'name',
        'filename',
        'originalName',
        'originalFilename',
        'displayName',
      ]) ??
        pipeline?.suggestedTitle ??
        'Aula sem nome',
    ),
    createdAt: pick<string>(o, ['createdAt', 'created_at', 'uploadedAt']) ?? null,
    updatedAt: pick<string>(o, ['updatedAt', 'updated_at']) ?? null,
    durationSeconds:
      Number(
        pick<number>(o, ['durationSeconds', 'duration', 'lengthSeconds']) ?? 0,
      ) || null,
    status,
    topics: toStringList(pick(o, ['topics', 'tags', 'subjects'])),
    videoUrl: pick<string>(o, ['videoUrl', 'streamUrl', 'url']) ?? null,
    pipeline,
  };
}

function normalizeSegment(raw: unknown): TranscriptSegment {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    startSeconds: Number(pick<number>(o, ['startSeconds', 'start', 'from']) ?? 0),
    endSeconds: Number(pick<number>(o, ['endSeconds', 'end', 'to']) ?? 0),
    text: String(pick<string>(o, ['text', 'content']) ?? '').trim(),
  };
}

function normalizeHit(raw: unknown): SearchHit {
  const o = (raw ?? {}) as Record<string, unknown>;
  const source = (pick<Record<string, unknown>>(o, ['source', 'lesson']) ??
    {}) as Record<string, unknown>;
  return {
    lessonId: String(
      pick<string>(o, ['sourceId', 'lessonId', 'id']) ??
        pick<string>(source, ['id', 'sourceId']) ??
        '',
    ),
    lessonTitle: String(
      pick<string>(o, [
        'sourceName',
        'sourceTitle',
        'lessonTitle',
        'title',
      ]) ??
        pick<string>(source, [
          'title',
          'name',
          'originalName',
          'filename',
        ]) ??
        'Aula',
    ),
    startSeconds: Number(
      pick<number>(o, ['startSeconds', 'start', 'startTime']) ?? 0,
    ),
    endSeconds: Number(pick<number>(o, ['endSeconds', 'end', 'endTime']) ?? 0),
    excerpt: String(
      pick<string>(o, ['excerpt', 'text', 'snippet', 'content']) ?? '',
    ).trim(),
  };
}

/* ---------------------------------- endpoints --------------------------------- */

export const api = {
  listLessons: async (): Promise<Lesson[]> => {
    const data = await request<unknown>('/sources?page=1&pageSize=100');
    const basic = asArray(data).map(normalizeLesson).filter((l) => l.id);
    // /sources não traz pipeline — buscar status pra badge bater com a realidade.
    const detailed = await Promise.all(
      basic.map(async (lesson) => {
        try {
          return await api.getLesson(lesson.id);
        } catch {
          return lesson;
        }
      }),
    );
    return detailed;
  },

  getLesson: async (id: string): Promise<Lesson> => {
    // Prefer /status — includes pipeline so UI can avoid premature 404s.
    const data = await request<unknown>(`/sources/${id}/status`);
    return normalizeLesson(data);
  },

  getLessonStatus: async (id: string): Promise<LessonStatus> => {
    const lesson = await api.getLesson(id);
    return lesson.status;
  },

  getTranscript: async (id: string): Promise<Transcript> => {
    const data = (await request<unknown>(
      `/sources/${id}/transcript`,
    )) as Record<string, unknown>;
    const segmentsRaw =
      pick<unknown>(data ?? {}, ['segments']) ?? asArray(data);
    return {
      language: (pick<string>(data ?? {}, ['language', 'lang']) ??
        null) as string | null,
      segments: asArray(segmentsRaw)
        .map(normalizeSegment)
        .filter((s) => s.text),
    };
  },

  getKnowledge: async (id: string): Promise<Knowledge> => {
    const raw = (await request<unknown>(
      `/sources/${id}/knowledge`,
    )) as Record<string, unknown>;
    const nested = (pick<Record<string, unknown>>(raw ?? {}, [
      'knowledge',
      'data',
    ]) ?? {}) as Record<string, unknown>;
    return {
      title:
        pick<string>(raw ?? {}, ['suggestedTitle', 'title']) ??
        pick<string>(nested, ['title', 'lessonTitle', 'suggestedTitle']) ??
        null,
      summary:
        pick<string>(raw ?? {}, ['summary']) ??
        pick<string>(nested, ['summary', 'overview', 'abstract']) ??
        null,
      topics: toStringList(
        pick(nested, ['topics', 'tags', 'concepts', 'subjects']) ??
          pick(raw ?? {}, ['topics']),
      ),
      keyIdeas: toStringList(
        pick(nested, [
          'keyIdeas',
          'key_ideas',
          'insights',
          'takeaways',
          'points',
        ]),
      ),
      exercises: toStringList(
        pick(nested, ['exercises', 'practice', 'drills']),
      ),
    };
  },

  uploadVideo: async (file: File): Promise<{ id?: string | undefined }> => {
    const form = new FormData();
    form.append('file', file);
    const data = (await request<unknown>('/sources/videos', {
      method: 'POST',
      body: form,
    })) as Record<string, unknown>;
    return { id: pick<string>(data ?? {}, ['id', 'sourceId']) };
  },

  search: async (query: string): Promise<SearchHit[]> => {
    const data = await request<unknown>('/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    return asArray(data).map(normalizeHit);
  },

  ask: async (question: string, lessonId?: string): Promise<ChatAnswer> => {
    const body: Record<string, unknown> = { question };
    if (lessonId) body.sourceId = lessonId;
    const data = (await request<unknown>('/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    const answer = String(
      pick<string>(data ?? {}, [
        'answer',
        'message',
        'reply',
        'response',
        'content',
      ]) ?? '',
    );
    const refs = pick<unknown>(data ?? {}, [
      'references',
      'sources',
      'citations',
      'results',
    ]);
    return { answer, references: asArray(refs).map(normalizeHit) };
  },
};
