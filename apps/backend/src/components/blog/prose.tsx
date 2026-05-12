import { cn } from "@/lib/utils";

interface ProseProps {
  className?: string;
  children: React.ReactNode;
}

// Styled wrapper for long-form blog content. Targets descendant elements
// (h2, h3, p, ul, ol, code, pre, blockquote, a, table) so individual article
// pages can write semantic HTML without per-element classes.
export function Prose({ className, children }: ProseProps) {
  return (
    <div
      className={cn(
        // Base text
        "text-base leading-7 text-foreground",
        // Headings
        "[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground md:[&_h2]:text-3xl",
        "[&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-foreground",
        "[&_h4]:mt-6 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-foreground",
        // Paragraphs
        "[&_p]:mt-5 [&_p]:leading-7 [&_p]:text-foreground/90",
        // Links
        "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-foreground/70",
        // Lists
        "[&_ul]:mt-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
        "[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
        "[&_li]:leading-7 [&_li>p]:my-0",
        // Inline code
        "[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:text-foreground",
        // Code blocks
        "[&_pre]:mt-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-secondary/40 [&_pre]:p-4 [&_pre]:text-sm",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
        // Blockquote
        "[&_blockquote]:mt-6 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-foreground/80",
        // Strong / em
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        // Tables
        "[&_table]:mt-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border [&_th]:bg-secondary/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        // HR
        "[&_hr]:my-10 [&_hr]:border-border",
        className
      )}
    >
      {children}
    </div>
  );
}
