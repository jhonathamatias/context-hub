import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Check, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddLessonDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: (f: File) => api.uploadVideo(f),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFile(null);
          upload.reset();
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="display-title text-2xl">Adicionar aula</DialogTitle>
          <DialogDescription>
            O envio é rápido. Depois preparamos a aula para pesquisa em segundo plano.
          </DialogDescription>
        </DialogHeader>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${
            dragging ? "border-primary bg-accent/50" : "border-border bg-muted/30 hover:bg-muted/60"
          }`}
        >
          <UploadCloud className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">Arraste seu vídeo aqui</span>
          <span className="text-sm text-muted-foreground">ou clique para selecionar</span>
          <input
            type="file"
            accept="video/*,.mp4,.mov,.webm,.mkv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <span className="min-w-0 truncate">{file.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {upload.isPending ? (
                "Enviando…"
              ) : upload.isSuccess ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <Check className="size-3.5" /> Processando…
                </span>
              ) : upload.isError ? (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-3.5" /> Não foi possível enviar
                </span>
              ) : (
                "Pronto para enviar"
              )}
            </span>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {upload.isSuccess ? "Fechar" : "Cancelar"}
          </Button>
          <Button
            disabled={!file || upload.isPending || upload.isSuccess}
            onClick={() => file && upload.mutate(file)}
          >
            {upload.isPending ? "Enviando…" : "Adicionar aula"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
