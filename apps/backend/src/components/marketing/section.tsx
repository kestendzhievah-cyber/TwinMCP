import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  /** A 1px hairline on top of the section. */
  bordered?: boolean;
  /**
   * Section ground: `default` is the page's light blue, `alt` the alternate
   * band (spec §3.6: alternate the two between sections), `band` the strong
   * band. Never put small rose text on `band` (contrast 4.46).
   */
  tone?: "default" | "alt" | "band";
  children: React.ReactNode;
}

const TONES: Record<NonNullable<SectionProps["tone"]>, string> = {
  default: "",
  alt: "bg-surface-alt",
  band: "bg-surface-band",
};

// A marketing section ("Clear sky", docs/DESIGN.md): `py-16 md:py-24` rhythm,
// the 16px phone gutter, and a centred header: a blue eyebrow, a display H2 and
// a muted lead.
export function Section({
  id,
  eyebrow,
  title,
  description,
  className,
  containerClassName,
  bordered = false,
  tone = "default",
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "w-full py-16 md:py-24",
        TONES[tone],
        bordered && "border-t border-border",
        className
      )}
    >
      <div className={cn("mx-auto max-w-6xl px-4 sm:px-6", containerClassName)}>
        {(eyebrow || title || description) && (
          <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            {title && (
              <h2 className="text-balance font-display text-3xl font-bold tracking-tight md:text-4xl">
                {title}
              </h2>
            )}
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
