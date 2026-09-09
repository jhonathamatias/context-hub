import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SearchResult } from "@/components/search-result";
import { EmptyState, LoadingSkeleton, SoftError } from "@/components/states";
import { PageFrame, PageFrameWidth } from "@/components/page-frame";

type SearchParams = { q?: string };

export const Route = createFileRoute("/buscar")({
  validateSearch: (search: Record<string, unknown>): SearchParams =>
    typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {},
  head: () => ({
    meta: [
      { title: "Buscar nas aulas — Context Hub" },
      { name: "description", content: "Encontre o trecho exato de qualquer aula." },
      { property: "og:title", content: "Buscar nas aulas — Context Hub" },
      { property: "og:description", content: "Encontre o trecho exato de qualquer aula." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q ?? "");

  useEffect(() => {
    setTerm(q ?? "");
  }, [q]);

  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q ?? ""),
    enabled: Boolean(q),
    retry: false,
  });

  return (
    <PageFrame width={PageFrameWidth.Lg}>
      <h1 className="display-title text-2xl sm:text-3xl">Buscar nas aulas</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Encontre o trecho exato, com o momento do vídeo.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (term.trim()) void navigate({ to: "/buscar", search: { q: term.trim() } });
        }}
        className="mt-4"
      >
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-primary/50">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ex: onde ele explicou tríades sobre acorde maior?"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="sm" className="shrink-0">
            Buscar
          </Button>
        </div>
      </form>

      <div className="mt-4 space-y-2">
        {!q ? (
          <EmptyState
            title="O que você quer rever?"
            description="Escreva um assunto, técnica ou conceito e mostramos os trechos das aulas onde isso aparece."
          />
        ) : results.isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : results.isError ? (
          <SoftError message="A busca não está disponível agora. Tente novamente em instantes." />
        ) : (results.data ?? []).length === 0 ? (
          <EmptyState
            title="Nada encontrado"
            description="Não achamos esse assunto nas suas aulas. Tente outras palavras."
          />
        ) : (
          results.data?.map((hit, i) => <SearchResult key={`${hit.lessonId}-${i}`} hit={hit} />)
        )}
      </div>
    </PageFrame>
  );
}
