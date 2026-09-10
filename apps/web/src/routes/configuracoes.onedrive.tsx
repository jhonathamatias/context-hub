import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  KeyRound,
  Link2,
  Plug,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  feedbackFromError,
  type ImportFeedback,
} from '@/lib/import-feedback';
import { zodResolver } from '@/lib/zod-resolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { OneDriveIcon } from '@/components/onedrive-icon';
import { PageFrame, PageFrameWidth } from '@/components/page-frame';
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
import { FeedbackAlert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type SearchParams = {
  id?: string;
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
    body: 'Dê um nome (ex.: “Aulas guitarra”), cole o token e, se quiser, o link padrão da pasta. Ao salvar, validamos se o token consegue ler arquivos no OneDrive.',
  },
  {
    icon: Upload,
    title: 'Importe em Importar aula',
    body: 'Com a integração salva, abra Importar aula, escolha o OneDrive na lista de origens e listar/importar os vídeos.',
  },
] as const;

export const Route = createFileRoute('/configuracoes/onedrive')({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const id =
      typeof search['id'] === 'string' && search['id']
        ? search['id']
        : undefined;
    return {
      ...(id ? { id } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: 'OneDrive — Context Hub' },
      {
        name: 'description',
        content: 'Configure a integração OneDrive / SharePoint.',
      },
      { property: 'og:title', content: 'OneDrive — Context Hub' },
      {
        property: 'og:description',
        content: 'Configure a integração OneDrive / SharePoint.',
      },
    ],
  }),
  component: OneDriveIntegrationPage,
});

function OneDriveIntegrationPage() {
  const { id: selectedId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [configFeedback, setConfigFeedback] = useState<ImportFeedback | null>(
    null,
  );
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
      }
      return;
    }
    integrationForm.reset({
      name: selected.name,
      accessToken: tokenDraftsRef.current[selected.id] ?? '',
      shareUrl: selected.shareUrl ?? '',
    });
  }, [selected, selectedId, integrationForm]);

  const selectIntegration = (id?: string) => {
    tokenDraftsRef.current[draftKey] =
      integrationForm.getValues('accessToken') ?? '';
    setConfigFeedback(null);
    void navigate({
      to: '/configuracoes/onedrive',
      search: {
        ...(id ? { id } : {}),
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
        message: 'Agora você pode importar vídeos em Importar aula.',
      });
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      void navigate({
        to: '/configuracoes/onedrive',
        search: { id: item.id },
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
      void navigate({ to: '/configuracoes/onedrive', search: {} });
    },
    onError: (err: unknown) => {
      setConfigFeedback(feedbackFromError(err, 'Falha ao remover'));
    },
  });

  const busy = save.isPending || remove.isPending;

  const onSaveIntegration = integrationForm.handleSubmit((values) => {
    setConfigFeedback(null);
    save.mutate(values);
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
            Credenciais e link padrão — a importação fica em Importar aula.
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

      <div className="mt-5 space-y-4">
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
                <Button asChild type="button" variant="outline" disabled={busy}>
                  <Link
                    to="/importar"
                    search={{ fonte: 'onedrive', id: selectedId }}
                  >
                    Importar com esta integração
                  </Link>
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
      </div>
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
                Quatro passos — do link até Importar aula.
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
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-xs font-bold tabular-nums text-primary">
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
                      {index === 3 ? (
                        <Link
                          to="/importar"
                          className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
                        >
                          Abrir Importar aula →
                        </Link>
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
