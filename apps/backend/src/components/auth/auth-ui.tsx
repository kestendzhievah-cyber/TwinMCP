import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Small shared pieces of the auth forms (sign-in, sign-up, password screens,
// OAuth consent), so the four screens stay one family (docs/DESIGN.md, "Auth").

/** An inline text link: brand blue, underlined on hover. */
export const AUTH_LINK =
  "font-medium text-brand underline-offset-4 hover:underline focus-visible:underline";

/** A quiet secondary action under a form (method switch, start over…). */
export const AUTH_QUIET_ACTION =
  "inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/** The screen title. */
export const AUTH_TITLE = "font-display text-2xl font-bold tracking-tight sm:text-3xl";

const TONES = {
  neutral: "bg-secondary text-brand",
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
} as const;

/** The 48px icon circle above a status screen ("Check your email"…). */
export function AuthStatusIcon({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-12 w-12 place-items-center rounded-full [&_svg]:h-6 [&_svg]:w-6",
        TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

/** An error message: tinted box, icon and text (never colour alone). */
export function AuthError({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive",
        className
      )}
    >
      <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
