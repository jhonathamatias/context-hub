import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api, type OneDriveListedVideo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { OneDriveIcon } from '@/components/onedrive-icon';
import { PageFrame, PageFrameWidth } from '@/components/page-frame';

type SearchParams = { id?: string };

export const Route = createFileRoute('/configuracoes/onedrive')({
  validateSearch: (search: Record<string, unknown>): SearchParams =>
    typeof search['id'] === 'string' && search['id']
      ? { id: search['id'] }
      : {},
  head: () => ({
    meta: [
      { title: 'OneDrive — Context Hub' },
      {
        name: 'description',
        content: 'Configure token e importe vídeos do OneDrive.',
      },
      { property: 'og:title', content: 'OneDrive — Context Hub' },
      {
        property: 'og:description',
        content: 'Configure token e importe vídeos do OneDrive.',
      },
    ],
  }),
  component: OneDriveIntegrationPage,
});

function OneDriveIntegrationPage() {
  const { id: selectedId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [videos, setVideos] = useState<OneDriveListedVideo[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const integrations = useQuery({
    queryKey: ['integrations', 'ONEDRIVE'],
    queryFn: () => api.listIntegrations('ONEDRIVE'),
    retry: false,
  });

  const selected = (integrations.data ?? []).find((i) => i.id === selectedId);

  useEffect(() => {
    if (!selected) {
      if (!selectedId) {
        setName('');
        setAccessToken('');
        setShareUrl('');
      }
      return;
    }
    setName(selected.name);
    setShareUrl(selected.shareUrl ?? '');
    setAccessToken('');
    setVideos([]);
    setMessage(null);
  }, [selected, selectedId]);

  const save = useMutation({
    mutationFn: async () => {
      if (selectedId) {
        return api.updateIntegration(selectedId, {
          name: name.trim(),
          ...(accessToken.trim()
            ? { accessToken: accessToken.trim() }
            : {}),
          shareUrl: shareUrl.trim() || null,
        });
      }
      return api.createIntegration({
        kind: 'ONEDRIVE',
        name: name.trim() || 'OneDrive',
        ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
        ...(shareUrl.trim() ? { shareUrl: shareUrl.trim() } : {}),
      });
    },
    onSuccess: async (item) => {
      setMessage('Integração salva.');
      setAccessToken('');
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      void navigate({
        to: '/configuracoes/onedrive',
        search: { id: item.id },
      });
    },
    onError: (err: unknown) => {
      setMessage(err instanceof Error ? err.message : 'Falha ao salvar');
    },
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error('Nenhuma integração selecionada');
      return api.deleteIntegration(selectedId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setMessage('Integração removida.');
      void navigate({ to: '/configuracoes/onedrive', search: {} });
    },
    onError: (err: unknown) => {
      setMessage(err instanceof Error ? err.message : 'Falha ao remover');
    },
  });

  const preview = useMutation({
    mutationFn: () =>
      api.previewOneDrive({
        url: shareUrl.trim() || undefined,
        integrationId: selectedId,
      }),
    onSuccess: (items) => {
      setVideos(items);
      setMessage(
        items.length === 0
          ? 'Nenhum vídeo encontrado nesse link.'
          : `${items.length} vídeo(s) encontrado(s).`,
      );
    },
    onError: (err: unknown) => {
      setVideos([]);
      setMessage(err instanceof Error ? err.message : 'Falha ao listar OneDrive');
    },
  });

  const importOne = useMutation({
    mutationFn: (itemId?: string) =>
      api.importFromOneDrive({
        url: shareUrl.trim() || undefined,
        integrationId: selectedId,
        ...(itemId ? { itemId } : {}),
      }),
    onSuccess: (result) => {
      setMessage(`${result.count} aula(s) enfileirada(s) para processamento.`);
      void navigate({ to: '/biblioteca' });
    },
    onError: (err: unknown) => {
      setMessage(err instanceof Error ? err.message : 'Falha ao importar');
    },
  });

  const importAll = useMutation({
    mutationFn: () =>
      api.importFromOneDrive({
        url: shareUrl.trim() || undefined,
        integrationId: selectedId,
        importAll: true,
      }),
    onSuccess: (result) => {
      setMessage(`${result.count} aula(s) enfileirada(s) para processamento.`);
      void navigate({ to: '/biblioteca' });
    },
    onError: (err: unknown) => {
      setMessage(err instanceof Error ? err.message : 'Falha ao importar pasta');
    },
  });

  const busy =
    save.isPending ||
    remove.isPending ||
    preview.isPending ||
    importOne.isPending ||
    importAll.isPending;

  const canPreview = Boolean(shareUrl.trim() || selected?.shareUrl);

  return (
    <PageFrame width={PageFrameWidth.Lg}>
      <Link
        to="/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Configurações
      </Link>

      <header className="mt-3 flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-[#28a8ea]">
          <OneDriveIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="display-title text-2xl sm:text-3xl">OneDrive</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Salve várias contas/pastas com nome e access token do Microsoft
            Graph. Depois importe pelos links.
          </p>
        </div>
      </header>

      {(integrations.data ?? []).length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={!selectedId ? 'default' : 'outline'}
            onClick={() =>
              void navigate({ to: '/configuracoes/onedrive', search: {} })
            }
          >
            Nova
          </Button>
          {(integrations.data ?? []).map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={selectedId === item.id ? 'default' : 'outline'}
              onClick={() =>
                void navigate({
                  to: '/configuracoes/onedrive',
                  search: { id: item.id },
                })
              }
            >
              {item.name}
            </Button>
          ))}
        </div>
      ) : null}

      <section className="panel mt-4 space-y-3 px-3 py-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          {selectedId ? 'Editar integração' : 'Nova integração'}
        </h2>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Aulas guitarra / OneDrive pessoal"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-glow"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            Access token (Graph)
            {selected?.hasAccessToken
              ? ' — já salvo; preencha só para trocar'
              : ''}
          </span>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Bearer token do Microsoft Graph"
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-glow"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            Link padrão (opcional)
          </span>
          <input
            type="url"
            value={shareUrl}
            onChange={(e) => {
              setShareUrl(e.target.value);
              setMessage(null);
            }}
            placeholder="https://1drv.ms/… ou sharepoint.com/…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-glow"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!name.trim() || busy}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Salvando…' : 'Salvar integração'}
          </Button>
          {selectedId ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => remove.mutate()}
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          ) : null}
        </div>
      </section>

      <section className="panel mt-4 space-y-3 px-3 py-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Importar vídeos
        </h2>
        <p className="text-xs text-muted-foreground">
          Use o link acima (ou o padrão salvo). Com token na integração, pastas
          privadas também funcionam.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canPreview || busy}
            onClick={() => preview.mutate()}
          >
            {preview.isPending ? 'Listando…' : 'Listar vídeos'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canPreview || busy}
            onClick={() => importAll.mutate()}
          >
            {importAll.isPending ? 'Importando…' : 'Importar pasta inteira'}
          </Button>
        </div>

        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}

        {videos.length > 0 ? (
          <ul className="divide-y divide-border border border-border">
            {videos.map((video) => (
              <li
                key={video.id || video.name}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{video.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(video.size)}
                    {video.mimeType ? ` · ${video.mimeType}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !video.id}
                  onClick={() => importOne.mutate(video.id)}
                >
                  Importar
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </PageFrame>
  );
}

function formatBytes(size: number | null): string {
  if (size == null || size <= 0) return 'tamanho desconhecido';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
