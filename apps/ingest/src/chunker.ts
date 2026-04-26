import matter from "gray-matter";
import { encode } from "gpt-tokenizer";

export interface Chunk {
  content: string;
  tokenCount: number;
  position: number;
  metadata: {
    path: string;
    title?: string;
    headings: string[];
  };
}

const TARGET_TOKENS = 500;
const OVERLAP_TOKENS = 50;

function splitByHeadings(md: string): Array<{ heading: string; body: string }> {
  const lines = md.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let cur = { heading: "", body: "" };
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      if (cur.body || cur.heading) sections.push(cur);
      cur = { heading: line.replace(/^#+\s+/, "").trim(), body: "" };
    } else {
      cur.body += line + "\n";
    }
  }
  if (cur.body || cur.heading) sections.push(cur);
  return sections;
}

function packTokens(text: string, pos: number, base: Chunk["metadata"]): Chunk[] {
  const tokens = encode(text);
  if (tokens.length <= TARGET_TOKENS) {
    return text.trim()
      ? [{ content: text.trim(), tokenCount: tokens.length, position: pos, metadata: base }]
      : [];
  }
  const chunks: Chunk[] = [];
  const step = TARGET_TOKENS - OVERLAP_TOKENS;
  for (let i = 0, p = pos; i < tokens.length; i += step, p++) {
    const slice = tokens.slice(i, i + TARGET_TOKENS);
    if (slice.length === 0) break;
    // Approximate reverse: use character-based reconstruction from encoded text
    // gpt-tokenizer's decode is not exposed across all builds — fall back to
    // char-based slicing proportional to token ratio.
    const ratio = slice.length / tokens.length;
    const startChar = Math.floor((i / tokens.length) * text.length);
    const endChar = Math.min(text.length, startChar + Math.ceil(ratio * text.length) + 200);
    const content = text.slice(startChar, endChar).trim();
    if (content) {
      chunks.push({ content, tokenCount: slice.length, position: p, metadata: base });
    }
  }
  return chunks;
}

export function chunkMarkdown(path: string, raw: string): Chunk[] {
  const { data, content } = matter(raw);
  const title = typeof data.title === "string" ? data.title : undefined;
  const sections = splitByHeadings(content);
  const out: Chunk[] = [];
  let pos = 0;
  const headingStack: string[] = [];
  for (const s of sections) {
    if (s.heading) {
      headingStack.length = Math.min(headingStack.length, 0);
      headingStack.push(s.heading);
    }
    const text = (s.heading ? `# ${s.heading}\n\n` : "") + s.body;
    const chunks = packTokens(text, pos, {
      path,
      title,
      headings: [...headingStack],
    });
    out.push(...chunks);
    pos += chunks.length;
  }
  return out;
}
