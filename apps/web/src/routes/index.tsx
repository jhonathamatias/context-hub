import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LessonCard } from '@/components/lesson-card';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { PageFrame, PageFrameWidth } from '@/components/page-frame';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Context Hub' },
      {
        name: 'description',
        content:
          'Studio de aulas gravadas — busque trechos e pergunte ao seu acervo.',
      },
      { property: 'og:title', content: 'Context Hub' },
      {
        property: 'og:description',
        content:
          'Studio de aulas gravadas — busque trechos e pergunte ao seu acervo.',
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const lessons = useQuery({
    queryKey: ['lessons'],
    queryFn: api.listLessons,
    retry: false,
  });
  const all = lessons.data ?? [];
  const ready = all.filter((l) => l.status === 'READY');

  const goSearch = (q: string) => {
    if (!q.trim()) return;
    void navigate({ to: '/buscar', search: { q: q.trim() } });
  };

  return (
    <PageFrame width={PageFrameWidth.Lg}>
      <section>
        <p className="display-title text-3xl leading-[1.05] text-foreground sm:text-4xl">
          Context Hub
        </p>
        <h1 className="mt-2 max-w-xl text-base font-medium text-muted-foreground sm:text-lg">
          Encontre qualquer coisa que você já aprendeu nas suas aulas.
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            goSearch(query);
          }}
          className="mt-4"
        >
          <div className="panel flex items-center gap-2 px-4 py-3 focus-within:ring-glow">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busque por assunto, técnica ou conceito…"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="sm" className="shrink-0">
              Buscar
            </Button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link
            to="/perguntar"
            className="inline-flex items-center gap-1.5 font-medium text-primary"
          >
            <Sparkles className="size-3.5" />
            Usar IA nas aulas <ArrowRight className="size-3.5" />
          </Link>
          <Link
            to="/importar"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Adicionar aula
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 className="display-title text-lg text-foreground">Recentes</h2>
          <Link
            to="/biblioteca"
            className="text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            Biblioteca
          </Link>
        </div>

        {lessons.isLoading ? <LoadingSkeleton rows={3} /> : null}

        {!lessons.isLoading && ready.length === 0 ? (
          <EmptyState
            title="Nenhuma aula pronta"
            description="Envie um vídeo para montar seu studio."
          />
        ) : null}

        <div className="space-y-2">
          {ready.slice(0, 5).map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </section>
    </PageFrame>
  );
}
