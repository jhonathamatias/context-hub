import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { SourceSummary } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';

export function LibraryPage() {
  const [items, setItems] = useState<SourceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listSources(1, 50)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Falha ao listar fontes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
          <p className="mt-1 text-sm text-stone-600">
            {total} aula{total === 1 ? '' : 's'} indexada{total === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          to="/upload"
          className="rounded bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-800"
        >
          Enviar vídeo
        </Link>
      </div>

      {loading && <p className="text-sm text-stone-500">Carregando…</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-stone-600">
          Nenhuma fonte ainda. Faça o upload de uma aula para começar.
        </p>
      )}

      <ul className="divide-y divide-stone-200 border border-stone-200 bg-white">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={`/sources/${item.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.originalName}</p>
                <p className="text-xs text-stone-500">
                  {formatDate(item.createdAt)}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
