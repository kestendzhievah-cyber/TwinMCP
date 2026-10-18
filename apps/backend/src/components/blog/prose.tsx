import { cn } from "@/lib/utils";

interface ProseProps {
  className?: string;
  children: React.ReactNode;
}

// Styled wrapper for long-form blog content. Targets descendant elements
// (h2, h3, p, ul, ol, code, pre, blockquote, a, table) so individual article
// pages can write semantic HTML without per-element classes.
// Typeset like the card (DESIGN.md §5 "Blog Prose"): Garamond at the reading
// size, sentence-case serif headings, pinstripe links, typewriter code and
// tables set as ledgers.
export function Prose({ className, children }: ProseProps) {
  return (
    <div
      className={cn(
        // Base text: ink on bone at the reading size
        "text-lg leading-8 text-foreground",
        // Headings: sentence case, no small caps, no negative tracking
        "[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-3xl [&_h2]:font-medium [&_h2]:text-foreground",
        "[&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:text-2xl [&_h3]:font-medium [&_h3]:text-foreground",
        "[&_h4]:mt-6 [&_h4]:text-xl [&_h4]:font-medium [&_h4]:text-foreground",
        // Paragraphs
        "[&_p]:mt-5",
        // Links: pinstripe navy on a hairline underline
        "[&_a]:text-brand [&_a]:underline [&_a]:decoration-brand/40 [&_a]:underline-offset-4 [&_a:hover]:decoration-brand",
        // Lists: muted markers
        "[&_ul]:mt-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
        "[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
        "[&_li>p]:my-0 [&_li::marker]:text-muted-foreground",
        // Inline code: typewriter on a shade of bone
        "[&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-foreground",
        // Code blocks: the typewriter block
        "[&_pre]:mt-6 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border [&_pre]:bg-secondary/60 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-relaxed",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[1em]",
        // Blockquote: an ink hairline in the margin, set in italic
        "[&_blockquote]:mt-6 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/40 [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-foreground/80",
        // Strong / em
        "[&_strong]:font-medium [&_strong]:text-foreground",
        // Tables: ledgers — small-caps header on a firmer rule, hairline rows, no cell borders
        "[&_table]:mt-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_thead_tr]:border-b [&_thead_tr]:border-foreground/50",
        "[&_th]:tracking-sc [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-bottom [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:[font-variant-caps:small-caps]",
        "[&_tbody_tr]:border-b [&_tbody_tr]:border-border",
        "[&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        // HR: the double rule
        "[&_hr]:my-10 [&_hr]:border-t-[3px] [&_hr]:border-border [&_hr]:[border-top-style:double]",
        className
      )}
    >
      {children}
    </div>
  );
}
