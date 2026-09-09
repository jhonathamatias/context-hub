import { forwardRef, useImperativeHandle, useRef } from "react";
import { Film } from "lucide-react";

export type LessonPlayerHandle = {
  seekTo: (seconds: number) => void;
  currentTime: () => number;
};

/**
 * Architecture is ready to receive a real `videoUrl` later (OneDrive or upload
 * stream). Until then it renders a calm placeholder instead of a fake player.
 */
export const LessonPlayer = forwardRef<
  LessonPlayerHandle,
  { videoUrl?: string | null | undefined; onTimeUpdate?: ((seconds: number) => void) | undefined }
>(function LessonPlayer({ videoUrl, onTimeUpdate }, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      const el = videoRef.current;
      if (!el) return;
      el.currentTime = seconds;
      void el.play().catch(() => undefined);
    },
    currentTime: () => videoRef.current?.currentTime ?? 0,
  }));

  if (!videoUrl) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 text-center">
        <Film className="size-6 text-muted-foreground" />
        <p className="max-w-xs px-6 text-sm text-muted-foreground">
          Vídeo disponível quando a fonte original estiver conectada.
        </p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      controls
      onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
      className="aspect-video w-full rounded-xl bg-foreground/90"
    />
  );
});
