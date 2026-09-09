import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type {
  SourceKnowledgeResult,
  SourceStatusResult,
  SourceTranscriptResult,
} from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatTimestamp } from '../lib/format';

type Tab = 'status' | 'summary' | 'transcript';

export function SourceDetailPage() {
  const { sourceId = '' } = useParams();
  const [tab, setTab] = useState<Tab>('status');
  const [status, setStatus] = useState<SourceStatusResult | null>(null);
  const [transcript, setTranscript] = useState<SourceTranscriptResult | null>(
    null,
  );
  const [knowledge, setKnowledge] = useState<SourceKnowledgeResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!sourceId) return;
    const next = await api.getStatus(sourceId);
    setStatus(next);
  }, [sourceId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        await refreshStatus();
        if (!cancelled) setError(null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar');
        }
      }
    }

    void load();
    timer = setInterval(() => {
      void load();
    }, 4000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (!sourceId || tab !== 'transcript') return;
    let cancelled = false;
    api
      .getTranscript(sourceId)
      .then((result) => {
        if (!cancelled) setTranscript(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTranscript(null);
          setError(err instanceof Error ? err.message : 'Sem transcrição');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId, tab]);

  useEffect(() => {
    if (!sourceId || tab !== 'summary') return;
    let cancelled = false;
    api
      .getKnowledge(sourceId)
      .then((result) => {
        if (!cancelled) setKnowledge(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setKnowledge(null);
          setError(err instanceof Error ? err.message : 'Sem conhecimento');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId, tab]);

  async function runAction(
    label: string,
    action: () => Promise<{ queued: string }>,
  ) {
    setBusyAction(label);
    setActionMessage(null);
    try {
      const result = await action();
      setActionMessage(`Fila: ${result.queued}`);
      await refreshStatus();
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'Ação falhou');
    } finally {
      setBusyAction(null);
    }
  }

  if (!sourceId) {
    return <p className="text-sm text-rose-700">Source id inválido.</p>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">
            <Link to="/" className="underline">
              Biblioteca
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {status?.originalName ?? 'Carregando…'}
          </h1>
          {status && (
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={status.status} />
              <span className="text-xs text-stone-500">
                atualizado {formatDate(status.updatedAt)}
              </span>
            </div>
          )}
        </div>
        <Link
          to={`/chat?sourceId=${sourceId}`}
          className="rounded bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-800"
        >
          Perguntar sobre esta aula
        </Link>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {actionMessage && (
        <p className="text-sm text-stone-700">{actionMessage}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <ActionButton
          label="Transcrever"
          busy={busyAction === 'Transcrever'}
          onClick={() =>
            void runAction('Transcrever', () =>
              api.enqueueTranscribe(sourceId),
            )
          }
        />
        <ActionButton
          label="Extrair conhecimento"
          busy={busyAction === 'Extrair conhecimento'}
          onClick={() =>
            void runAction('Extrair conhecimento', () =>
              api.enqueueKnowledge(sourceId),
            )
          }
        />
        <ActionButton
          label="Gerar embeddings"
          busy={busyAction === 'Gerar embeddings'}
          onClick={() =>
            void runAction('Gerar embeddings', () =>
              api.enqueueEmbeddings(sourceId),
            )
          }
        />
      </div>

      <div className="flex gap-2 border-b border-stone-300">
        {(
          [
            ['status', 'Status'],
            ['summary', 'Resumo'],
            ['transcript', 'Transcrição'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setError(null);
            }}
            className={`px-3 py-2 text-sm ${
              tab === id
                ? 'border-b-2 border-stone-900 font-medium'
                : 'text-stone-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'status' && status && <StatusPanel status={status} />}
      {tab === 'summary' && (
        <SummaryPanel knowledge={knowledge} />
      )}
      {tab === 'transcript' && <TranscriptPanel transcript={transcript} />}
    </section>
  );
}

function ActionButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50"
    >
      {busy ? `${label}…` : label}
    </button>
  );
}

function StatusPanel({ status }: { status: SourceStatusResult }) {
  const { pipeline } = status;
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Metric
          label="Transcrição"
          value={pipeline.transcription.status ?? '—'}
        />
        <Metric
          label="Conhecimento"
          value={pipeline.knowledge.status ?? '—'}
        />
        <Metric label="Chunks" value={String(pipeline.chunks.count)} />
        <Metric
          label="Embeddings"
          value={String(pipeline.embeddings.count)}
        />
      </dl>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Jobs recentes</h2>
        <ul className="divide-y divide-stone-200 border border-stone-200 bg-white text-sm">
          {pipeline.latestJobs.map((job) => (
            <li key={job.id} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{job.stage}</span>
                <StatusBadge status={job.status} />
              </div>
              {job.errorMessage && (
                <p className="mt-1 text-xs text-rose-700">{job.errorMessage}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-stone-200 bg-white px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function SummaryPanel({
  knowledge,
}: {
  knowledge: SourceKnowledgeResult | null;
}) {
  if (!knowledge) {
    return (
      <p className="text-sm text-stone-600">
        Ainda não há resumo. Execute “Extrair conhecimento” quando a transcrição
        estiver pronta.
      </p>
    );
  }

  return (
    <article className="space-y-3 border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <StatusBadge status={knowledge.status} />
        <h2 className="text-lg font-semibold">
          {knowledge.suggestedTitle ?? 'Sem título sugerido'}
        </h2>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
        {knowledge.summary ?? 'Sem resumo.'}
      </p>
    </article>
  );
}

function TranscriptPanel({
  transcript,
}: {
  transcript: SourceTranscriptResult | null;
}) {
  if (!transcript) {
    return (
      <p className="text-sm text-stone-600">
        Transcrição ainda não disponível. Execute “Transcrever”.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        idioma: {transcript.language ?? '—'} · {transcript.segments.length}{' '}
        segmentos
      </p>
      <ul className="max-h-[28rem] space-y-2 overflow-y-auto border border-stone-200 bg-white p-3 text-sm">
        {transcript.segments.map((segment, index) => (
          <li key={`${segment.startSeconds}-${index}`}>
            <span className="mr-2 font-mono text-xs text-stone-500">
              {formatTimestamp(segment.startSeconds)}
            </span>
            {segment.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
