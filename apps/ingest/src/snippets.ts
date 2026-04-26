const FENCE_RE = /```[a-zA-Z0-9_+-]*\n[\s\S]*?```/g;

export function countCodeSnippets(markdown: string): number {
  return (markdown.match(FENCE_RE) ?? []).length;
}
