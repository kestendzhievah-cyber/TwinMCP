import { cn } from "@/lib/utils";

interface ProseProps {
  className?: string;
  children: React.ReactNode;
}

// Styled wrapper for long-form blog content. Targets descendant elements
// (h2, h3, p, ul, ol, code, pre, blockquote, a, table) so individual article
// pages can write semantic HTML without per-element classes.
// "Clear sky" reading style (docs/DESIGN.md): Inter at the reading size,
// Plus Jakarta headings, blue underlined links, mono code on a quiet fill and
// tables in a rounded frame that scrolls sideways inside itself on phones.
export function Prose({ className, children }: ProseProps) {
  return (
    <div
      className={cn(
        // Base text: navy ink at the reading size
        "text-base leading-7 text-foreground sm:text-lg sm:leading-8",
        // Headings: display face, sentence case
        "[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground sm:[&_h2]:text-3xl",
        "[&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-foreground sm:[&_h3]:text-2xl",
        "[&_h4]:mt-6 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-foreground",
        // Paragraphs
        "[&_p]:mt-5",
        // Links: brand blue, underlined so they never rely on colour alone
        "[&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:decoration-2",
        // Lists: muted markers
        "[&_ul]:mt-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
        "[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
        "[&_li>p]:my-0 [&_li::marker]:text-muted-foreground",
        // Inline code: mono on a quiet fill
        "[&_code]:rounded-md [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:text-foreground",
        // Code blocks
        "[&_pre]:mt-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-surface-alt [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-relaxed",
        "[&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[1em]",
        // Blockquote: a blue bar in the margin; italic is kept for quotes
        "[&_blockquote]:mt-6 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-brand/40 [&_blockquote]:bg-surface-alt [&_blockquote]:py-3 [&_blockquote]:pl-5 [&_blockquote]:pr-4 [&_blockquote]:italic [&_blockquote]:text-foreground",
        "[&_blockquote>p:first-child]:mt-0",
        // Strong / em
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        // Tables: a rounded frame that scrolls inside itself, header row on surface-alt
        "[&_table]:mt-6 [&_table]:block [&_table]:w-full [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:rounded-xl [&_table]:border [&_table]:border-border [&_table]:bg-card [&_table]:text-sm",
        "[&_thead]:bg-surface-alt [&_thead_tr]:border-b [&_thead_tr]:border-border",
        "[&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:align-bottom [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground",
        "[&_tbody_tr:not(:last-child)]:border-b [&_tbody_tr]:border-border",
        "[&_td]:px-4 [&_td]:py-3 [&_td]:align-top",
        // HR: one hairline
        "[&_hr]:my-10 [&_hr]:border-t [&_hr]:border-border",
        className
      )}
    >
      {children}
    </div>
  );
}
