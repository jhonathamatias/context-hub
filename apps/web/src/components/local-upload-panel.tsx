import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertCircle, Check, UploadCloud } from 'lucide-react';
import { API_BASE_URL, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

async function uploadVideoWithProgress(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ id?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/sources/videos`);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = (xhr.response ?? {}) as Record<string, unknown>;
        resolve({
          id:
            typeof data.sourceId === 'string'
              ? data.sourceId
              : typeof data.id === 'string'
                ? data.id
                : undefined,
        });
        return;
      }
      const message =
        (xhr.response as { message?: string } | null)?.message ??
        `Upload failed (${xhr.status})`;
      reject(new ApiError(message, xhr.status));
    };

    xhr.onerror = () => reject(new ApiError('Falha de rede no upload', 0));
    xhr.onabort = () => reject(new ApiError('Upload cancelado', 0));

    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

export function LocalUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const upload = useMutation({
    mutationFn: (f: File) =>
      uploadVideoWithProgress(f, (percent) => setUploadPercent(percent)),
    onSuccess: async () => {
      setUploadPercent(100);
      await queryClient.invalidateQueries({ queryKey: ['lessons'] });
      void navigate({ to: '/biblioteca' });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Este computador</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie um vídeo do disco. Depois acompanhe o processamento na Biblioteca.
        </p>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) {
            setFile(dropped);
            upload.reset();
            setUploadPercent(null);
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center transition-colors ${
          dragging
            ? 'border-primary bg-accent/50'
            : 'border-border bg-muted/20 hover:bg-muted/40'
        }`}
      >
        <UploadCloud className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">Arraste o vídeo aqui</span>
        <span className="text-sm text-muted-foreground">
          ou clique para selecionar · mp4, mov, webm, mkv
        </span>
        <input
          type="file"
          accept="video/*,.mp4,.mov,.webm,.mkv"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            upload.reset();
            setUploadPercent(null);
          }}
        />
      </label>

      {file ? (
        <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{file.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {upload.isPending ? (
                uploadPercent != null ? `Enviando ${uploadPercent}%` : 'Enviando…'
              ) : upload.isSuccess ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <Check className="size-3.5" /> Enviado
                </span>
              ) : upload.isError ? (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-3.5" /> Falhou
                </span>
              ) : (
                'Pronto para enviar'
              )}
            </span>
          </div>
          {upload.isPending || upload.isSuccess ? (
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="processing-bar-fill h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.max(uploadPercent ?? (upload.isSuccess ? 100 : 3), 3)}%`,
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          disabled={!file || upload.isPending || upload.isSuccess}
          onClick={() => {
            if (!file) return;
            setUploadPercent(0);
            upload.mutate(file);
          }}
        >
          {upload.isPending ? 'Enviando…' : 'Enviar aula'}
        </Button>
      </div>
    </div>
  );
}
