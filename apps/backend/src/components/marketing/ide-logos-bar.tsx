const ides = [
  { name: "Cursor", wordmark: "Cursor" },
  { name: "Claude Code", wordmark: "Claude Code" },
  { name: "Windsurf", wordmark: "Windsurf" },
  { name: "Cline", wordmark: "Cline" },
  { name: "Zed", wordmark: "Zed" },
];

// The "clients" line of the card: an eyebrow between two hairlines, then the
// IDE names set as letterspaced small capitals on one rule-bound band.
export function IdeLogosBar() {
  return (
    <div className="border-y border-border">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="eyebrow flex items-center justify-center gap-4 text-center before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']">
          Works with your existing AI coding stack
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 md:gap-x-14">
          {ides.map((ide) => (
            <li
              key={ide.name}
              className="smallcaps tracking-sc text-base font-medium text-muted-foreground transition-colors hover:text-foreground md:text-lg"
              aria-label={ide.name}
            >
              {ide.wordmark}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
