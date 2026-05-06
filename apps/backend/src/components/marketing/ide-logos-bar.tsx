const ides = [
  { name: "Cursor", wordmark: "Cursor" },
  { name: "Claude Code", wordmark: "Claude Code" },
  { name: "Windsurf", wordmark: "Windsurf" },
  { name: "Cline", wordmark: "Cline" },
  { name: "Zed", wordmark: "Zed" },
];

export function IdeLogosBar() {
  return (
    <div className="border-y border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Works with your existing AI coding stack
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 md:gap-x-14">
          {ides.map((ide) => (
            <li
              key={ide.name}
              className="font-mono text-sm font-medium tracking-tight text-muted-foreground/80 grayscale transition hover:text-foreground hover:grayscale-0 md:text-base"
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
