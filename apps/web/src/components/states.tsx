import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center",
        className,
      )}
    >
      <h3 className="display-title text-xl">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-3 w-1/4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ProcessingIndicator({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-accent/40",
        compact ? "px-4 py-3" : "px-5 py-4",
      )}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className="size-2 animate-pulse rounded-full bg-primary" />
        Estamos preparando esta aula para pesquisa.
      </p>
      <p className="mt-1 pl-4 text-sm text-muted-foreground">
        Você poderá pesquisar e fazer perguntas assim que terminar.
      </p>
    </div>
  );
}

export function SoftError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
