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

// A marketing section is one block of the card: generous vertical rhythm, a
// double rule on top when `bordered`, and a centred header set like the
// engraved name — eyebrow between two short hairlines, sentence-case title,
// muted lead. See docs/DESIGN.md §5.
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
    <section id={id} className={cn("w-full py-20 md:py-28", bordered && "rule-double", className)}>
      <div className={cn("mx-auto max-w-6xl px-6", containerClassName)}>
        {(eyebrow || title || description) && (
          <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
            {eyebrow && (
              <p className="eyebrow mb-4 flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']">
                {eyebrow}
              </p>
            )}
            {title && <h2 className="text-3xl font-medium md:text-4xl">{title}</h2>}
            {description && (
              <p className="mt-4 text-balance text-lg text-muted-foreground">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
