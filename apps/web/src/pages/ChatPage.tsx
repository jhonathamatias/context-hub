import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ChatResponse } from '../api/types';
import { ReferenceList } from '../components/ReferenceList';

export function ChatPage() {
  const [params] = useSearchParams();
  const sourceId = params.get('sourceId') ?? undefined;
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ChatResponse | null>(null);

  const scopeLabel = useMemo(
    () =>
      sourceId
        ? `Filtrado pela aula ${sourceId.slice(0, 8)}…`
        : 'Todas as aulas indexadas',
    [sourceId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      setError('Digite uma pergunta.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const payload: { question: string; sourceId?: string } = {
        question: trimmed,
      };
      if (sourceId) {
        payload.sourceId = sourceId;
      }
      const result = await api.chat(payload);
      setResponse(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chat falhou');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-stone-600">{scopeLabel}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          placeholder="Ex.: Como praticar improvisação com metrônomo?"
          className="w-full border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
        />
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {busy ? 'Consultando…' : 'Perguntar'}
        </button>
      </form>

      {response && (
        <div className="space-y-4 border border-stone-200 bg-white p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">
              Resposta
              {!response.sufficientEvidence ? ' · evidência insuficiente' : ''}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {response.answer}
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Referências</h2>
            <ReferenceList references={response.references} />
          </div>
        </div>
      )}
    </section>
  );
}
