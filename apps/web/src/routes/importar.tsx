import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { HardDriveUpload, Plus, Settings } from 'lucide-react';
import { api } from '@/lib/api';
import { OneDriveIcon } from '@/components/onedrive-icon';
import { LocalUploadPanel } from '@/components/local-upload-panel';
import { OneDriveImportPanel } from '@/components/onedrive-import-panel';
import { PageFrame, PageFrameWidth } from '@/components/page-frame';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SearchParams = {
  fonte?: 'local' | 'onedrive';
  id?: string;
};

export const Route = createFileRoute('/importar')({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const fonte =
      search['fonte'] === 'onedrive' || search['fonte'] === 'local'
        ? search['fonte']
        : undefined;
    const id =
      typeof search['id'] === 'string' && search['id']
        ? search['id']
        : undefined;
    return {
      ...(fonte ? { fonte } : {}),
      ...(id ? { id } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: 'Importar — Context Hub' },
      {
        name: 'description',
        content: 'Importe aulas do computador ou de uma integração configurada.',
      },
      { property: 'og:title', content: 'Importar — Context Hub' },
      {
        property: 'og:description',
        content: 'Importe aulas do computador ou de uma integração configurada.',
      },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { fonte, id } = Route.useSearch();
  const navigate = useNavigate();

  const integrations = useQuery({
    queryKey: ['integrations', 'ONEDRIVE'],
    queryFn: () => api.listIntegrations('ONEDRIVE'),
    retry: false,
  });

  const onedriveList = integrations.data ?? [];
  const selectedOnedrive =
    onedriveList.find((item) => item.id === id) ?? onedriveList[0] ?? null;

  const activeFonte: 'local' | 'onedrive' =
    fonte === 'onedrive' || (fonte !== 'local' && Boolean(id))
      ? 'onedrive'
      : fonte === 'local'
        ? 'local'
        : 'local';

  const selectLocal = () => {
    void navigate({ to: '/importar', search: { fonte: 'local' } });
  };

  const selectOnedrive = (integrationId: string) => {
    void navigate({
      to: '/importar',
      search: { fonte: 'onedrive', id: integrationId },
    });
  };

  return (
    <PageFrame width={PageFrameWidth.Xl}>
      <header>
        <h1 className="display-title text-2xl sm:text-3xl">Importar aula</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Escolha a origem do vídeo — computador ou uma integração já configurada.
        </p>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="space-y-1 lg:border-r lg:border-border lg:pr-4">
          <p className="mb-2 px-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Origem
          </p>

          <button
            type="button"
            onClick={selectLocal}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
              activeFonte === 'local'
                ? 'bg-primary/15 text-foreground'
                : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
            )}
          >
            <HardDriveUpload className="size-4 shrink-0" />
            Este computador
          </button>

          <div className="pt-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                Integrações
              </p>
              <Link
                to="/configuracoes"
                className="text-muted-foreground hover:text-foreground"
                title="Configurar integrações"
              >
                <Settings className="size-3.5" />
              </Link>
            </div>

            {integrations.isLoading ? (
              <p className="px-2 text-xs text-muted-foreground">Carregando…</p>
            ) : onedriveList.length === 0 ? (
              <div className="space-y-2 px-2 py-1">
                <p className="text-xs text-muted-foreground">
                  Nenhuma integração salva.
                </p>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to="/configuracoes/onedrive">
                    <Plus className="size-3.5" /> Configurar OneDrive
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {onedriveList.map((item) => {
                  const active =
                    activeFonte === 'onedrive' &&
                    selectedOnedrive?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectOnedrive(item.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                          active
                            ? 'bg-primary/15 text-foreground'
                            : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
                        )}
                      >
                        <OneDriveIcon className="size-4 shrink-0 text-[#28a8ea]" />
                        <span className="min-w-0 truncate">{item.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border border-border bg-card/40 px-4 py-5 sm:px-5">
          {activeFonte === 'local' ? (
            <LocalUploadPanel />
          ) : selectedOnedrive ? (
            <OneDriveImportPanel integration={selectedOnedrive} />
          ) : (
            <div className="py-10 text-center">
              <OneDriveIcon className="mx-auto size-8 text-[#28a8ea]" />
              <p className="mt-3 text-sm font-medium">Configure o OneDrive primeiro</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Salve nome e token em Configurações; depois volte para importar.
              </p>
              <Button asChild className="mt-4">
                <Link to="/configuracoes/onedrive">Abrir configuração</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
