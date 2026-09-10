import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Download,
  KeyRound,
  Link2,
  Plug,
  Trash2,
  Upload,
} from 'lucide-react';
import { ApiError, api, type OneDriveListedVideo } from '@/lib/api';
import { zodResolver } from '@/lib/zod-resolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { OneDriveIcon } from '@/components/onedrive-icon';
import { PageFrame, PageFrameWidth } from '@/components/page-frame';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  FeedbackAlert,
  type FeedbackTone,
} from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const OneDriveTab = {
  Integration: 'integracao',
  Import: 'importar',
} as const;

type OneDriveTab = (typeof OneDriveTab)[keyof typeof OneDriveTab];

type SearchParams = {
  id?: string;
  tab?: OneDriveTab;
};

const TAB_FROM_SEARCH: Record<string, OneDriveTab> = {
  integracao: OneDriveTab.Integration,
  importar: OneDriveTab.Import,
};

const integrationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe um nome para a integração')
    .max(256, 'Nome muito longo (máx. 256)'),
  accessToken: z.string().optional().default(''),
  shareUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || URL.canParse(value),
      'Informe um link válido (https://1drv.ms/…)',
    ),
});

type IntegrationFormValues = z.infer<typeof integrationFormSchema>;

const importFormSchema = z.object({
  shareUrl: z
    .string()
    .trim()
    .min(1, 'Cole o link do arquivo ou pasta')
    .refine((value) => URL.canParse(value), 'Informe um link válido (https://…)'),
});

type ImportFormValues = z.infer<typeof importFormSchema>;

const TUTORIAL_STEPS = [
  {
    icon: Link2,
    title: 'Crie um link de compartilhamento',
    body: 'No OneDrive ou SharePoint, clique com o botão direito no vídeo ou pasta → Compartilhar. Prefira “Qualquer pessoa com o link” para testes rápidos.',
  },
  {
    icon: KeyRound,
    title: 'Gere um access token (pastas privadas)',
    body: 'Abra o Graph Explorer, faça login na mesma conta Microsoft, clique em Modify permissions e marque Files.Read e Files.Read.All (só User.Read não basta). Consent → copie o Access token novo. Links “qualquer pessoa com o link” podem funcionar sem token.',
  },
  {
    icon: Plug,
    title: 'Salve a integração aqui',
    body: 'Dê um nome (ex.: “Aulas guitarra”), cole o token e, se quiser, o link padrão da pasta. Ao salvar, validamos se o token consegue ler arquivos no OneDrive. Você pode ter várias integrações.',
  },
  {
    icon: Upload,
    title: 'Importe na aba Importar',
    body: 'Selecione a integração salva, confirme o link e liste os vídeos. Importe um a um ou a pasta inteira — eles entram no pipeline do studio.',
  },
] as const;

export const Route = createFileRoute('/configuracoes/onedrive')({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const id =
      typeof search['id'] === 'string' && search['id']
        ? search['id']
        : undefined;
    const rawTab =
      typeof search['tab'] === 'string' ? search['tab'].toLowerCase() : '';
    const tab = TAB_FROM_SEARCH[rawTab];
    return {
      ...(id ? { id } : {}),
      ...(tab ? { tab } : {}),
    };
  },
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

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

type Feedback = {
  tone: FeedbackTone;
  title: string;
  message: string;
};

function feedbackFromError(err: unknown, fallbackTitle: string): Feedback {
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

function OneDriveIntegrationPage() {
  const { id: selectedId, tab: tabParam } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeTab = tabParam ?? OneDriveTab.Integration;

  const [videos, setVideos] = useState<OneDriveListedVideo[]>([]);
  const [configFeedback, setConfigFeedback] = useState<Feedback | null>(null);
  const [importFeedback, setImportFeedback] = useState<Feedback | null>(null);
  /** Session-only drafts — API never returns the raw token. */
  const tokenDraftsRef = useRef<Record<string, string>>({});
  const draftKey = selectedId ?? '__new__';

  const integrations = useQuery({
    queryKey: ['integrations', 'ONEDRIVE'],
    queryFn: () => api.listIntegrations('ONEDRIVE'),
    retry: false,
  });

  const selected = (integrations.data ?? []).find((i) => i.id === selectedId);
  const savedList = integrations.data ?? [];

  const integrationForm = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: { name: '', accessToken: '', shareUrl: '' },
    mode: 'onTouched',
  });

  const importForm = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: { shareUrl: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    return () => {
      tokenDraftsRef.current[draftKey] =
        integrationForm.getValues('accessToken') ?? '';
    };
  }, [draftKey, integrationForm]);

  useEffect(() => {
    if (!selected) {
      if (!selectedId) {
        integrationForm.reset({
          name: '',
          accessToken: tokenDraftsRef.current['__new__'] ?? '',
          shareUrl: '',
        });
        importForm.reset({ shareUrl: '' });
      }
      return;
    }
    integrationForm.reset({
      name: selected.name,
      accessToken: tokenDraftsRef.current[selected.id] ?? '',
      shareUrl: selected.shareUrl ?? '',
    });
    importForm.reset({ shareUrl: selected.shareUrl ?? '' });
  }, [selected, selectedId, integrationForm, importForm]);

  const setTab = (tab: OneDriveTab) => {
    void navigate({
      to: '/configuracoes/onedrive',
      search: {
        ...(selectedId ? { id: selectedId } : {}),
        tab,
      },
    });
  };

  const selectIntegration = (id?: string) => {
    tokenDraftsRef.current[draftKey] =
      integrationForm.getValues('accessToken') ?? '';
    setVideos([]);
    setConfigFeedback(null);
    setImportFeedback(null);
    void navigate({
      to: '/configuracoes/onedrive',
      search: {
        ...(id ? { id } : {}),
        tab: activeTab,
      },
    });
  };

  const save = useMutation({
    mutationFn: async (values: IntegrationFormValues) => {
      const token = values.accessToken?.trim();
      if (selectedId) {
        return api.updateIntegration(selectedId, {
          name: values.name.trim(),
          ...(token ? { accessToken: token } : {}),
          shareUrl: values.shareUrl.trim() || null,
        });
      }
      return api.createIntegration({
        kind: 'ONEDRIVE',
        name: values.name.trim(),
        ...(token ? { accessToken: token } : {}),
        ...(values.shareUrl.trim() ? { shareUrl: values.shareUrl.trim() } : {}),
      });
    },
    onSuccess: async (item, values) => {
      const token = values.accessToken?.trim() ?? '';
      if (token) {
        tokenDraftsRef.current[item.id] = values.accessToken ?? token;
      }
      delete tokenDraftsRef.current['__new__'];
      setConfigFeedback({
        tone: 'success',
        title: 'Integração salva',
        message: 'Você já pode ir para a aba Importar e listar os vídeos.',
      });
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      void navigate({
        to: '/configuracoes/onedrive',
        search: { id: item.id, tab: OneDriveTab.Integration },
      });
    },
    onError: (err: unknown) => {
      setConfigFeedback(feedbackFromError(err, 'Falha ao salvar a integração'));
    },
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error('Nenhuma integração selecionada');
      return api.deleteIntegration(selectedId);
    },
    onSuccess: async () => {
      if (selectedId) {
        delete tokenDraftsRef.current[selectedId];
      }
      setConfigFeedback({
        tone: 'info',
        title: 'Integração removida',
        message: 'Você pode criar outra integração quando quiser.',
      });
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      void navigate({
        to: '/configuracoes/onedrive',
        search: { tab: OneDriveTab.Integration },
      });
    },
    onError: (err: unknown) => {
      setConfigFeedback(feedbackFromError(err, 'Falha ao remover'));
    },
  });

  const preview = useMutation({
    mutationFn: (shareUrl: string) =>
      api.previewOneDrive({
        url: shareUrl,
        integrationId: selectedId,
      }),
    onSuccess: (items) => {
      setVideos(items);
      if (items.length === 0) {
        setImportFeedback({
          tone: 'warning',
          title: 'Nenhum vídeo neste link',
          message:
            'O link abriu, mas não há arquivos de vídeo suportados (mp4, mov, webm, mkv).',
        });
        return;
      }
      setImportFeedback({
        tone: 'success',
        title: `${items.length} vídeo(s) encontrado(s)`,
        message: 'Importe um a um ou use “Importar pasta inteira”.',
      });
    },
    onError: (err: unknown) => {
      setVideos([]);
      setImportFeedback(feedbackFromError(err, 'Falha ao listar OneDrive'));
    },
  });

  const importOne = useMutation({
    mutationFn: (input: { shareUrl: string; itemId?: string }) =>
      api.importFromOneDrive({
        url: input.shareUrl,
        integrationId: selectedId,
        ...(input.itemId ? { itemId: input.itemId } : {}),
      }),
    onSuccess: (result) => {
      setImportFeedback({
        tone: 'success',
        title: 'Importação iniciada',
        message: `${result.count} aula(s) enfileirada(s) para processamento.`,
      });
      void navigate({ to: '/biblioteca' });
    },
    onError: (err: unknown) => {
      setImportFeedback(feedbackFromError(err, 'Falha ao importar'));
    },
  });

  const importAll = useMutation({
    mutationFn: (shareUrl: string) =>
      api.importFromOneDrive({
        url: shareUrl,
        integrationId: selectedId,
        importAll: true,
      }),
    onSuccess: (result) => {
      setImportFeedback({
        tone: 'success',
        title: 'Importação iniciada',
        message: `${result.count} aula(s) enfileirada(s) para processamento.`,
      });
      void navigate({ to: '/biblioteca' });
    },
    onError: (err: unknown) => {
      setImportFeedback(feedbackFromError(err, 'Falha ao importar pasta'));
    },
  });

  const busy =
    save.isPending ||
    remove.isPending ||
    preview.isPending ||
    importOne.isPending ||
    importAll.isPending;

  const onSaveIntegration = integrationForm.handleSubmit((values) => {
    setConfigFeedback(null);
    save.mutate(values);
  });

  const onPreview = importForm.handleSubmit((values) => {
    setImportFeedback(null);
    preview.mutate(values.shareUrl);
  });

  const onImportAll = importForm.handleSubmit((values) => {
    setImportFeedback(null);
    importAll.mutate(values.shareUrl);
  });

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
            Configure a conexão e importe aulas direto do OneDrive / SharePoint.
          </p>
        </div>
      </header>

      {savedList.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={!selectedId ? 'default' : 'outline'}
            onClick={() => selectIntegration(undefined)}
          >
            Nova
          </Button>
          {savedList.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={selectedId === item.id ? 'default' : 'outline'}
              onClick={() => selectIntegration(item.id)}
            >
              {item.name}
            </Button>
          ))}
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = TAB_FROM_SEARCH[value];
          if (next) setTab(next);
        }}
        className="mt-5"
      >
        <TabsList className="h-10 w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value={OneDriveTab.Integration}
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Plug className="size-4" />
            Integração
          </TabsTrigger>
          <TabsTrigger
            value={OneDriveTab.Import}
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Download className="size-4" />
            Importar
          </TabsTrigger>
        </TabsList>

        <TabsContent value={OneDriveTab.Integration} className="mt-4 space-y-4">
          <TutorialCard />

          <Form {...integrationForm}>
            <form
              onSubmit={onSaveIntegration}
              className="panel space-y-3 px-3 py-3"
              noValidate
            >
              <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {selectedId ? 'Editar integração' : 'Nova integração'}
              </h2>

              <FormField
                control={integrationForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs text-muted-foreground">
                      Nome
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Aulas guitarra / OneDrive pessoal"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={integrationForm.control}
                name="accessToken"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs text-muted-foreground">
                      Access token (Graph)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Cole o access token do Microsoft Graph"
                        autoComplete="off"
                        spellCheck={false}
                        rows={5}
                        className="min-h-[7.5rem] resize-y font-mono text-xs leading-relaxed"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {selected?.hasAccessToken
                        ? 'Já existe um token salvo — cole um novo só se quiser trocar (precisa de Files.Read no Graph Explorer).'
                        : 'Para pastas privadas: Graph Explorer → Modify permissions → Files.Read + Files.Read.All → Consent. Links públicos podem omitir o token.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={integrationForm.control}
                name="shareUrl"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs text-muted-foreground">
                      Link padrão (opcional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://1drv.ms/… ou sharepoint.com/…"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" disabled={busy}>
                  {save.isPending ? 'Salvando…' : 'Salvar integração'}
                </Button>
                {selectedId ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setTab(OneDriveTab.Import)}
                  >
                    Ir para Importar
                  </Button>
                ) : null}
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

              {configFeedback ? (
                <FeedbackAlert
                  tone={configFeedback.tone}
                  title={configFeedback.title}
                >
                  {configFeedback.message}
                </FeedbackAlert>
              ) : null}
            </form>
          </Form>
        </TabsContent>

        <TabsContent value={OneDriveTab.Import} className="mt-4 space-y-4">
          {!selectedId && savedList.length === 0 ? (
            <div className="panel px-4 py-6 text-center">
              <BookOpen className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                Salve uma integração primeiro
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Vá na aba Integração, siga o tutorial e salve nome + token (ou
                link público).
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={() => setTab(OneDriveTab.Integration)}
              >
                Abrir Integração
              </Button>
            </div>
          ) : (
            <Form {...importForm}>
              <form className="panel space-y-3 px-3 py-3" noValidate>
                <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Importar vídeos
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selected
                    ? `Usando “${selected.name}”${selected.hasAccessToken ? ' (com token)' : ' (sem token)'}.`
                    : 'Nenhuma integração selecionada — links públicos ainda funcionam se você colar a URL.'}
                </p>

                <FormField
                  control={importForm.control}
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
                            setImportFeedback(null);
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
                    onClick={() => void onPreview()}
                  >
                    {preview.isPending ? 'Listando…' : 'Listar vídeos'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void onImportAll()}
                  >
                    {importAll.isPending
                      ? 'Importando…'
                      : 'Importar pasta inteira'}
                  </Button>
                </div>

                {importFeedback ? (
                  <FeedbackAlert
                    tone={importFeedback.tone}
                    title={importFeedback.title}
                  >
                    {importFeedback.message}
                  </FeedbackAlert>
                ) : null}

                {videos.length > 0 ? (
                  <ul className="divide-y divide-border border border-border">
                    {videos.map((video) => (
                      <li
                        key={video.id || video.name}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {video.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(video.size)}
                            {video.mimeType ? ` · ${video.mimeType}` : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || !video.id}
                          onClick={() => {
                            const shareUrl = importForm.getValues('shareUrl');
                            importOne.mutate({
                              shareUrl,
                              itemId: video.id,
                            });
                          }}
                        >
                          Importar
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </form>
            </Form>
          )}
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
}

function TutorialCard() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/30"
          >
            <BookOpen className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Como integrar o OneDrive</h2>
              <p className="text-xs text-muted-foreground">
                Quatro passos rápidos — do link ao import no studio.
              </p>
            </div>
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ol className="divide-y divide-border border-t border-border">
            {TUTORIAL_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3.5 sm:gap-4"
              >
                <div className="flex flex-col items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold tabular-nums',
                      'border-primary/40 bg-primary/10 text-primary',
                    )}
                  >
                    {index + 1}
                  </span>
                  {index < TUTORIAL_STEPS.length - 1 ? (
                    <span className="hidden h-full min-h-4 w-px bg-border sm:block" />
                  ) : null}
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="flex items-start gap-2">
                    <step.icon className="mt-0.5 size-4 shrink-0 text-[#28a8ea]" />
                    <div>
                      <p className="text-sm font-medium leading-snug">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {step.body}
                      </p>
                      {index === 1 ? (
                        <a
                          href="https://developer.microsoft.com/graph/graph-explorer"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
                        >
                          Abrir Graph Explorer ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function formatBytes(size: number | null): string {
  if (size == null || size <= 0) return 'tamanho desconhecido';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
