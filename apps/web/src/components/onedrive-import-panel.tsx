import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Download, Film, LoaderCircle, Play } from 'lucide-react';
import { api, type Integration, type OneDriveListedVideo } from '@/lib/api';
import {
  feedbackFromError,
  formatBytes,
  type ImportFeedback,
} from '@/lib/import-feedback';
import { zodResolver } from '@/lib/zod-resolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FeedbackAlert } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';

const importFormSchema = z.object({
  shareUrl: z
    .string()
    .trim()
    .min(1, 'Cole o link do arquivo ou pasta')
    .refine((value) => URL.canParse(value), 'Informe um link válido (https://…)'),
});

type ImportFormValues = z.infer<typeof importFormSchema>;

type ListedRow = OneDriveListedVideo & {
  importName: string;
};

export function OneDriveImportPanel({
  integration,
}: {
  integration: Integration;
}) {
  const [videos, setVideos] = useState<ListedRow[]>([]);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<ListedRow | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: { shareUrl: integration.shareUrl ?? '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    form.reset({ shareUrl: integration.shareUrl ?? '' });
    setVideos([]);
    setFeedback(null);
    setImportingId(null);
    setPreviewVideo(null);
  }, [integration.id, integration.shareUrl, form]);

  const preview = useMutation({
    mutationFn: (shareUrl: string) =>
      api.previewOneDrive({
        url: shareUrl,
        integrationId: integration.id,
      }),
    onSuccess: (items) => {
      setVideos(
        items.map((item) => ({
          ...item,
          importName: stripExtension(item.name) || item.name,
        })),
      );
      if (items.length === 0) {
        setFeedback({
          tone: 'warning',
          title: 'Nenhum vídeo neste link',
          message:
            'O link abriu, mas não há arquivos de vídeo suportados (mp4, mov, webm, mkv).',
        });
        return;
      }
      setFeedback({
        tone: 'success',
        title: `${items.length} vídeo(s) encontrado(s)`,
        message: 'Pré-visualize, ajuste o nome e importe com o ícone à direita.',
      });
    },
    onError: (err: unknown) => {
      setVideos([]);
      setFeedback(feedbackFromError(err, 'Falha ao listar OneDrive'));
    },
  });

  const importOne = useMutation({
    mutationFn: (input: {
      shareUrl: string;
      itemId: string;
      originalName: string;
    }) =>
      api.importFromOneDrive({
        url: input.shareUrl,
        integrationId: integration.id,
        itemId: input.itemId,
        originalName: input.originalName,
      }),
    onSuccess: async (result) => {
      setImportingId(null);
      setPreviewVideo(null);
      await queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setFeedback({
        tone: 'success',
        title: 'Importação iniciada',
        message: `${result.count} aula(s) na biblioteca — acompanhe o progresso lá.`,
      });
      void navigate({ to: '/biblioteca' });
    },
    onError: (err: unknown) => {
      setImportingId(null);
      setFeedback(feedbackFromError(err, 'Falha ao importar'));
    },
  });

  const importAll = useMutation({
    mutationFn: (shareUrl: string) =>
      api.importFromOneDrive({
        url: shareUrl,
        integrationId: integration.id,
        importAll: true,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setFeedback({
        tone: 'success',
        title: 'Importação iniciada',
        message: `${result.count} aula(s) na biblioteca — acompanhe o progresso lá.`,
      });
      void navigate({ to: '/biblioteca' });
    },
    onError: (err: unknown) => {
      setFeedback(feedbackFromError(err, 'Falha ao importar pasta'));
    },
  });

  const busy =
    preview.isPending || importOne.isPending || importAll.isPending;

  const updateImportName = (id: string, importName: string) => {
    setVideos((rows) =>
      rows.map((row) => (row.id === id ? { ...row, importName } : row)),
    );
    setPreviewVideo((current) =>
      current?.id === id ? { ...current, importName } : current,
    );
  };

  const startImport = (video: ListedRow) => {
    if (!video.id || !video.importName.trim()) return;
    setImportingId(video.id);
    importOne.mutate({
      shareUrl: form.getValues('shareUrl'),
      itemId: video.id,
      originalName: video.importName.trim(),
    });
  };

  const streamUrl =
    previewVideo && form.getValues('shareUrl')
      ? api.oneDriveStreamUrl({
          url: form.getValues('shareUrl'),
          integrationId: integration.id,
          itemId: previewVideo.id,
        })
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {integration.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {integration.hasAccessToken
              ? 'Integração com token — pastas privadas ok.'
              : 'Sem token — use links “qualquer pessoa com o link”.'}
          </p>
        </div>
        <Link
          to="/configuracoes/onedrive"
          search={{ id: integration.id }}
          className="text-xs font-medium text-primary hover:underline"
        >
          Editar integração
        </Link>
      </div>

      <Form {...form}>
        <form className="space-y-3" noValidate>
          <FormField
            control={form.control}
            name="shareUrl"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs text-muted-foreground">
                  Link do arquivo ou pasta
                </FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="https://1drv.ms/… ou sharepoint.com/…"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setFeedback(null);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setFeedback(null);
                void form.handleSubmit((values) =>
                  preview.mutate(values.shareUrl),
                )();
              }}
            >
              {preview.isPending ? 'Listando…' : 'Listar vídeos'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setFeedback(null);
                void form.handleSubmit((values) =>
                  importAll.mutate(values.shareUrl),
                )();
              }}
            >
              {importAll.isPending ? 'Importando…' : 'Importar pasta inteira'}
            </Button>
          </div>
        </form>
      </Form>

      {importOne.isPending || importAll.isPending ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm font-medium">Preparando importação…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Em seguida acompanhe o download na Biblioteca.
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div className="processing-bar-fill h-full w-1/3 rounded-full" />
          </div>
        </div>
      ) : null}

      {feedback ? (
        <FeedbackAlert tone={feedback.tone} title={feedback.title}>
          {feedback.message}
        </FeedbackAlert>
      ) : null}

      {videos.length > 0 ? (
        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto border border-border">
          {videos.map((video) => {
            const isRowImporting = importingId === video.id && importOne.isPending;
            return (
              <li
                key={video.id || video.name}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5"
              >
                <VideoThumb
                  name={video.name}
                  thumbnailUrl={video.thumbnailUrl}
                  onPreview={() => setPreviewVideo(video)}
                />
                <div className="min-w-0 space-y-1">
                  <Input
                    value={video.importName}
                    onChange={(e) => updateImportName(video.id, e.target.value)}
                    aria-label={`Nome para importar ${video.name}`}
                    className="h-8 text-sm"
                    disabled={busy}
                  />
                  <p className="truncate text-[11px] text-muted-foreground">
                    {video.name}
                    {' · '}
                    {formatBytes(video.size)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    disabled={!video.id}
                    title="Pré-visualizar"
                    aria-label={`Pré-visualizar ${video.importName || video.name}`}
                    onClick={() => setPreviewVideo(video)}
                  >
                    <Play className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-9"
                    disabled={busy || !video.id || !video.importName.trim()}
                    title="Importar vídeo"
                    aria-label={`Importar ${video.importName || video.name}`}
                    onClick={() => startImport(video)}
                  >
                    {isRowImporting ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog
        open={Boolean(previewVideo)}
        onOpenChange={(open) => {
          if (!open) setPreviewVideo(null);
        }}
      >
        <DialogContent className="max-w-3xl gap-4 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">
              {previewVideo?.importName || previewVideo?.name || 'Prévia'}
            </DialogTitle>
            <DialogDescription>
              Confira se é o vídeo certo antes de importar para o studio.
            </DialogDescription>
          </DialogHeader>

          {previewVideo ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-border bg-black">
                {streamUrl ? (
                  <video
                    key={streamUrl}
                    src={streamUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video max-h-[60vh] w-full bg-black"
                  />
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Nome ao importar
                </label>
                <Input
                  value={previewVideo.importName}
                  onChange={(e) =>
                    updateImportName(previewVideo.id, e.target.value)
                  }
                  disabled={busy}
                />
                <p className="text-[11px] text-muted-foreground">
                  Original: {previewVideo.name}
                  {' · '}
                  {formatBytes(previewVideo.size)}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewVideo(null)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                !previewVideo?.id ||
                !previewVideo.importName.trim()
              }
              onClick={() => {
                if (previewVideo) startImport(previewVideo);
              }}
            >
              {importingId === previewVideo?.id && importOne.isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Importando…
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Importar este vídeo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function VideoThumb({
  name,
  thumbnailUrl,
  onPreview,
}: {
  name: string;
  thumbnailUrl: string | null;
  onPreview: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(thumbnailUrl) && !failed;

  return (
    <button
      type="button"
      onClick={onPreview}
      className={cn(
        'group relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40 transition-colors hover:border-primary/50',
      )}
      title={`Pré-visualizar ${name}`}
      aria-label={`Pré-visualizar ${name}`}
    >
      {showImage ? (
        <img
          src={thumbnailUrl!}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Film className="size-5 text-muted-foreground" />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
        <Play className="size-4 fill-white text-white" />
      </span>
    </button>
  );
}
