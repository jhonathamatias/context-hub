import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export enum PageFrameWidth {
  Sm = 'sm',
  Md = 'md',
  Lg = 'lg',
  Xl = 'xl',
  Full = 'full',
}

const WIDTH_CLASS: Record<PageFrameWidth, string> = {
  [PageFrameWidth.Sm]: 'max-w-4xl',
  [PageFrameWidth.Md]: 'max-w-5xl',
  [PageFrameWidth.Lg]: 'max-w-6xl',
  [PageFrameWidth.Xl]: 'max-w-7xl',
  [PageFrameWidth.Full]: 'max-w-[90rem]',
};

type PageFrameProps = {
  width?: PageFrameWidth;
  className?: string;
  children: ReactNode;
};

/** Dense CapCut-like page chrome — wide stage, compact padding. */
export function PageFrame({
  width = PageFrameWidth.Xl,
  className,
  children,
}: PageFrameProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-4 sm:px-6 sm:py-5',
        WIDTH_CLASS[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
