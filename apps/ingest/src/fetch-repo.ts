import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { mkdir, rm, readFile, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { x as tarExtract } from "tar";
import { downloadTarball } from "./github";

const DOC_EXT = new Set([".md", ".mdx", ".markdown"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", ".next", ".turbo"]);
const MAX_FILE_BYTES = 512 * 1024; // 512 KB per doc file

export interface ExtractedFile {
  path: string;
  content: string;
  bytes: number;
}

async function walk(root: string, base = root, acc: string[] = []): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(root, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const abs = join(root, e.name);
    if (e.isDirectory()) await walk(abs, base, acc);
    else if (e.isFile() && DOC_EXT.has(extname(e.name).toLowerCase())) acc.push(abs);
  }
  return acc;
}

export async function fetchRepoDocs(
  owner: string,
  repo: string,
  ref: string
): Promise<ExtractedFile[]> {
  const tmp = join(tmpdir(), `twinmcp-${randomUUID()}`);
  await mkdir(tmp, { recursive: true });
  try {
    const buf = await downloadTarball(owner, repo, ref);
    const nodeStream = Readable.from(Buffer.from(buf));
    await pipeline(nodeStream, createGunzip(), tarExtract({ cwd: tmp, strip: 1 }));

    const paths = await walk(tmp);
    const files: ExtractedFile[] = [];
    for (const abs of paths) {
      const s = await stat(abs);
      if (s.size > MAX_FILE_BYTES) continue;
      const content = await readFile(abs, "utf-8");
      files.push({ path: relative(tmp, abs).replaceAll("\\", "/"), content, bytes: s.size });
    }
    return files;
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
