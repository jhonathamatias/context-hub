import { createFileRoute } from "@tanstack/react-router";
import { API_BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Context Hub" },
      { name: "description", content: "Fontes de vídeo e preferências do Context Hub." },
      { property: "og:title", content: "Configurações — Context Hub" },
      { property: "og:description", content: "Fontes de vídeo e preferências do Context Hub." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="display-title text-3xl sm:text-4xl">Configurações</h1>

      <section className="mt-8">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Fontes de aulas
        </h2>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">Enviar vídeo</p>
              <p className="text-sm text-muted-foreground">Disponível</p>
            </div>
            <span className="shrink-0 rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              Ativo
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-card/40 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">OneDrive</p>
              <p className="text-sm text-muted-foreground">
                Em breve você poderá importar aulas direto da sua pasta.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              Em breve
            </span>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Detalhes técnicos
        </h2>
        <details className="mt-3 rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm">Ver detalhes técnicos</summary>
          <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
            API: {API_BASE_URL}
          </p>
        </details>
      </section>
    </div>
  );
}
