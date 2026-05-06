import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  bordered?: boolean;
  children: React.ReactNode;
}

export function Section({
  id,
  eyebrow,
  title,
  description,
  className,
  containerClassName,
  bordered = false,
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn("w-full py-20 md:py-28", bordered && "border-t border-border/60", className)}
    >
      <div className={cn("mx-auto max-w-6xl px-6", containerClassName)}>
        {(eyebrow || title || description) && (
          <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
            {eyebrow && (
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-4 text-balance text-base text-muted-foreground md:text-lg">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
