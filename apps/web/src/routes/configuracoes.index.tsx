import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, HardDriveUpload, Plus } from 'lucide-react';
import { API_BASE_URL, api } from '@/lib/api';
import { OneDriveIcon } from '@/components/onedrive-icon';
import { PageFrame, PageFrameWidth } from '@/components/page-frame';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export const Route = createFileRoute('/configuracoes/')({
  head: () => ({
    meta: [
      { title: 'Configurações — Context Hub' },
      {
        name: 'description',
        content: 'Preferências e integrações do Context Hub.',
      },
      { property: 'og:title', content: 'Configurações — Context Hub' },
      {
        property: 'og:description',
        content: 'Preferências e integrações do Context Hub.',
      },
    ],
  }),
  component: SettingsPage,
});

enum CatalogStatus {
  Available = 'available',
  Connected = 'connected',
}

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  status: CatalogStatus;
  icon: ReactNode;
  to?: '/configuracoes/onedrive';
};

const STATUS_LABEL: Record<CatalogStatus, string> = {
  [CatalogStatus.Available]: 'Disponível',
  [CatalogStatus.Connected]: 'Ativa',
};

const STATUS_CLASS: Record<CatalogStatus, string> = {
  [CatalogStatus.Available]: 'border-primary/35 bg-primary/10 text-primary',
  [CatalogStatus.Connected]:
    'border-emerald-500/35 bg-emerald-500/10 text-emerald-400',
};

const CATALOG: CatalogItem[] = [
  {
    id: 'onedrive',
    name: 'OneDrive',
    description: 'Configurar chave e importar vídeos por link',
    status: CatalogStatus.Available,
    icon: <OneDriveIcon className="size-5 text-[#28a8ea]" />,
    to: '/configuracoes/onedrive',
  },
  {
    id: 'local-upload',
    name: 'Upload local',
    description: 'Enviar arquivos pelo navegador (biblioteca)',
    status: CatalogStatus.Connected,
    icon: <HardDriveUpload className="size-5 text-muted-foreground" />,
  },
];

function SettingsPage() {
  const saved = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.listIntegrations(),
    retry: false,
  });

  const onedriveSaved = (saved.data ?? []).filter((i) => i.kind === 'ONEDRIVE');

  return (
    <PageFrame width={PageFrameWidth.Lg}>
      <h1 className="display-title text-2xl sm:text-3xl">Configurações</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Preferências e fontes do studio.
      </p>

      <h2 className="mt-5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Integrações salvas
      </h2>

      {saved.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
      ) : onedriveSaved.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhuma integração salva ainda. Abra o OneDrive abaixo para adicionar
          nome e token.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border border border-border">
          {onedriveSaved.map((item) => (
            <li key={item.id}>
              <Link
                to="/configuracoes/onedrive"
                search={{ id: item.id }}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                  <OneDriveIcon className="size-5 text-[#28a8ea]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <span
                      className={cn(
                        'rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                        item.hasAccessToken
                          ? STATUS_CLASS[CatalogStatus.Connected]
                          : STATUS_CLASS[CatalogStatus.Available],
                      )}
                    >
                      {item.hasAccessToken ? 'Com token' : 'Sem token'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.shareUrl ?? 'Sem link padrão'}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <Link
          to="/configuracoes/onedrive"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Plus className="size-4" /> Nova integração OneDrive
        </Link>
      </div>

      <h2 className="mt-6 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Disponíveis
      </h2>

      <ul className="mt-2 divide-y divide-border border border-border">
        {CATALOG.map((item) => {
          const body = (
            <>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <span
                    className={cn(
                      'rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                      STATUS_CLASS[item.status],
                    )}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              {item.to ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              ) : null}
            </>
          );

          return (
            <li key={item.id}>
              {item.to ? (
                <Link
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <details className="mt-4 px-0.5">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Detalhes técnicos
        </summary>
        <p className="mt-1.5 font-mono text-[11px] break-all text-muted-foreground">
          API: {API_BASE_URL || '(mesmo origin / proxy Vite)'}
        </p>
      </details>
    </PageFrame>
  );
}
