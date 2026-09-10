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
  progress?: {
    percent: number;
    stage: string;
    label: string;
    detail: string | null;
    transcriptionPercent: number | null;
  } | null;
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

export type OneDriveListedVideo = {
  id: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  webUrl: string | null;
};

export type IntegrationKind = 'ONEDRIVE';

export type Integration = {
  id: string;
  kind: IntegrationKind;
  name: string;
  hasAccessToken: boolean;
  shareUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const FRIENDLY_STATUS: Partial<Record<number, string>> = {
  0: 'Não foi possível conectar à API. Verifique se o Context Hub está rodando.',
  400: 'Dados inválidos. Revise o formulário e tente de novo.',
  401: 'Sem permissão para esta operação.',
  403: 'Acesso negado.',
  404: 'Recurso não encontrado.',
  409: 'Conflito ao salvar. Tente novamente.',
  429: 'Muitas requisições. Aguarde um momento.',
  500: 'Erro interno no servidor. Tente novamente em instantes.',
  502: 'API indisponível (gateway). Verifique se o backend está no ar.',
  503: 'API temporariamente indisponível.',
};

function friendlyApiMessage(status: number, raw?: string): string {
  const detail = raw?.trim();
  if (detail && detail !== 'request failed' && !detail.startsWith('<')) {
    return detail;
  }
  return FRIENDLY_STATUS[status] ?? `Falha na requisição (${status || 'rede'}).`;
}

async function readErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await res.json()) as {
        message?: string;
        error?: string;
        statusCode?: number;
      };
      return friendlyApiMessage(
        res.status,
        body.message || body.error || undefined,
      );
    }
    const text = (await res.text()).trim();
    if (text && !text.startsWith('<')) {
      return friendlyApiMessage(res.status, text.slice(0, 240));
    }
  } catch {
    // fall through
  }
  return friendlyApiMessage(res.status);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const hasBody = init?.body != null && init.body !== '';
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(hasBody && !(init?.body instanceof FormData)
          ? { 'content-type': 'application/json' }
          : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(friendlyApiMessage(0), 0);
  }
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), res.status);
  }
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
    progress: normalizeProgress(pick(o, ['progress'])),
  };
}

function normalizeProgress(
  raw: unknown,
): LessonPipeline['progress'] {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const percent = Number(p['percent']);
  if (!Number.isFinite(percent)) return null;
  const transcriptionPercent = Number(p['transcriptionPercent']);
  return {
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    stage: String(p['stage'] ?? ''),
    label: String(p['label'] ?? 'Processando'),
    detail: typeof p['detail'] === 'string' ? p['detail'] : null,
    transcriptionPercent: Number.isFinite(transcriptionPercent)
      ? Math.max(0, Math.min(100, Math.round(transcriptionPercent)))
      : null,
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

function normalizeIntegration(raw: unknown): Integration {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick<string>(o, ['id']) ?? ''),
    kind: (pick<string>(o, ['kind']) as IntegrationKind) ?? 'ONEDRIVE',
    name: String(pick<string>(o, ['name']) ?? 'Integração'),
    hasAccessToken: Boolean(pick<boolean>(o, ['hasAccessToken'])),
    shareUrl: pick<string>(o, ['shareUrl']) ?? null,
    createdAt: String(pick<string>(o, ['createdAt']) ?? ''),
    updatedAt: String(pick<string>(o, ['updatedAt']) ?? ''),
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

  previewOneDrive: async (input: {
    url?: string;
    integrationId?: string;
  }): Promise<OneDriveListedVideo[]> => {
    const body: Record<string, unknown> = {};
    if (input.url) body.url = input.url;
    if (input.integrationId) body.integrationId = input.integrationId;
    const data = (await request<unknown>('/sources/onedrive/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    return asArray(data).map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      return {
        id: String(pick<string>(o, ['id']) ?? ''),
        name: String(pick<string>(o, ['name']) ?? 'video'),
        size: Number(pick<number>(o, ['size']) ?? 0) || null,
        mimeType: pick<string>(o, ['mimeType']) ?? null,
        webUrl: pick<string>(o, ['webUrl']) ?? null,
      };
    });
  },

  importFromOneDrive: async (input: {
    url?: string;
    integrationId?: string;
    itemId?: string;
    importAll?: boolean;
  }): Promise<{ count: number; sourceIds: string[] }> => {
    const body: Record<string, unknown> = {};
    if (input.url) body.url = input.url;
    if (input.integrationId) body.integrationId = input.integrationId;
    if (input.itemId) body.itemId = input.itemId;
    if (input.importAll) body.importAll = true;
    const data = (await request<unknown>('/sources/onedrive', {
      method: 'POST',
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    const items = asArray(data);
    return {
      count: Number(pick<number>(data ?? {}, ['count']) ?? items.length),
      sourceIds: items
        .map((raw) =>
          String(
            pick<string>((raw ?? {}) as Record<string, unknown>, [
              'sourceId',
              'id',
            ]) ?? '',
          ),
        )
        .filter(Boolean),
    };
  },

  listIntegrations: async (kind?: IntegrationKind): Promise<Integration[]> => {
    const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
    const data = (await request<unknown>(`/integrations${qs}`)) as Record<
      string,
      unknown
    >;
    return asArray(data).map(normalizeIntegration);
  },

  createIntegration: async (input: {
    kind?: IntegrationKind;
    name: string;
    accessToken?: string;
    shareUrl?: string;
  }): Promise<Integration> => {
    const data = await request<unknown>('/integrations', {
      method: 'POST',
      body: JSON.stringify({
        kind: input.kind ?? 'ONEDRIVE',
        name: input.name,
        ...(input.accessToken ? { accessToken: input.accessToken } : {}),
        ...(input.shareUrl ? { shareUrl: input.shareUrl } : {}),
      }),
    });
    return normalizeIntegration(data);
  },

  updateIntegration: async (
    id: string,
    input: {
      name?: string;
      accessToken?: string | null;
      shareUrl?: string | null;
      clearAccessToken?: boolean;
    },
  ): Promise<Integration> => {
    const data = await request<unknown>(`/integrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return normalizeIntegration(data);
  },

  deleteIntegration: async (id: string): Promise<void> => {
    await request<unknown>(`/integrations/${id}`, { method: 'DELETE' });
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
