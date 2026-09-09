import type {
  ApiErrorBody,
  ChatResponse,
  SourceKnowledgeResult,
  SourceListResult,
  SourceStatusResult,
  SourceTranscriptResult,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiClientError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
  }
}

async function parseError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.message) {
      message = body.message;
    }
  } catch {
    // keep default
  }
  throw new ApiClientError(response.status, message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    await parseError(response);
  }
  return (await response.json()) as T;
}

export class ContextHubApi {
  listSources(page = 1, pageSize = 20): Promise<SourceListResult> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    return request(`/sources?${params}`);
  }

  getStatus(sourceId: string): Promise<SourceStatusResult> {
    return request(`/sources/${sourceId}/status`);
  }

  getTranscript(sourceId: string): Promise<SourceTranscriptResult> {
    return request(`/sources/${sourceId}/transcript`);
  }

  getKnowledge(sourceId: string): Promise<SourceKnowledgeResult> {
    return request(`/sources/${sourceId}/knowledge`);
  }

  async uploadVideo(file: File): Promise<{ sourceId: string; status: string }> {
    const body = new FormData();
    body.append('file', file);
    return request('/sources/videos', { method: 'POST', body });
  }

  enqueueTranscribe(sourceId: string): Promise<{ queued: string }> {
    return request(`/sources/${sourceId}/transcribe`, { method: 'POST' });
  }

  enqueueKnowledge(sourceId: string): Promise<{ queued: string }> {
    return request(`/sources/${sourceId}/knowledge`, { method: 'POST' });
  }

  enqueueEmbeddings(sourceId: string): Promise<{ queued: string }> {
    return request(`/sources/${sourceId}/embeddings`, { method: 'POST' });
  }

  chat(input: {
    question: string;
    sourceId?: string;
  }): Promise<ChatResponse> {
    return request('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  }
}

export const api = new ContextHubApi();
