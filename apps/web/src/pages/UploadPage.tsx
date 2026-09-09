import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Selecione um arquivo de vídeo.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.uploadVideo(file);
      navigate(`/sources/${result.sourceId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload falhou');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Upload de aula</h1>
      <p className="text-sm text-stone-600">
        O upload responde rápido. Extração de áudio e demais etapas rodam em
        background — acompanhe o status na página da fonte.
      </p>

      <form
        onSubmit={onSubmit}
        className="space-y-4 border border-stone-200 bg-white p-4"
      >
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Arquivo (mp4, mov, webm, mkv)</span>
          <input
            type="file"
            accept="video/*,.mp4,.mov,.webm,.mkv"
            className="block w-full text-sm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        {error && <p className="text-sm text-rose-700">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {busy ? 'Enviando…' : 'Enviar e acompanhar'}
        </button>
      </form>
    </section>
  );
}
