import { ApiError } from '@/lib/api';
import type { FeedbackTone } from '@/components/ui/alert';

export type ImportFeedback = {
  tone: FeedbackTone;
  title: string;
  message: string;
};

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function feedbackFromError(
  err: unknown,
  fallbackTitle: string,
): ImportFeedback {
  const message = errorMessage(err, fallbackTitle);
  const lower = message.toLowerCase();
  if (
    lower.includes('invalid url') ||
    lower.includes('<html') ||
    lower.includes('url inválida') ||
    lower.includes('url invalida')
  ) {
    return {
      tone: 'warning',
      title: 'Link inválido para a API',
      message,
    };
  }
  if (
    lower.includes('404') ||
    lower.includes('não encontrado') ||
    lower.includes('not found')
  ) {
    return {
      tone: 'warning',
      title: 'Link não encontrado',
      message,
    };
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('files.read') ||
    lower.includes('token') ||
    lower.includes('acesso negado') ||
    lower.includes('permissão') ||
    lower.includes('read only')
  ) {
    return {
      tone: 'destructive',
      title: 'Sem permissão no OneDrive',
      message,
    };
  }
  return {
    tone: 'destructive',
    title: fallbackTitle,
    message,
  };
}

export function formatBytes(size: number | null | undefined): string {
  if (size == null || size <= 0) return 'tamanho desconhecido';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
