import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground [&>svg]:text-foreground",
        info: "border-sky-500/40 bg-sky-500/10 text-sky-50 [&>svg]:text-sky-300",
        success:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-50 [&>svg]:text-emerald-300",
        warning:
          "border-amber-500/40 bg-amber-500/10 text-amber-50 [&>svg]:text-amber-300",
        destructive:
          "border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role={variant === "destructive" || variant === "warning" ? "alert" : "status"}
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

const ALERT_ICONS = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
} as const;

type FeedbackTone = keyof typeof ALERT_ICONS;

function FeedbackAlert({
  tone,
  title,
  children,
  className,
}: {
  tone: FeedbackTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = ALERT_ICONS[tone];
  return (
    <Alert variant={tone === "default" ? "info" : tone} className={className}>
      <Icon className="size-4" />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export { Alert, AlertTitle, AlertDescription, FeedbackAlert, alertVariants };
export type { FeedbackTone };
