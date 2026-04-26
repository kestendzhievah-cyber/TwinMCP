import { nanoid } from "nanoid";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { fetchRepoMeta } from "./github";
import { fetchRepoDocs } from "./fetch-repo";
import { chunkMarkdown } from "./chunker";
import { embedBatch } from "./embeddings";
import { computeTrustScore } from "./trust-score";
import { countCodeSnippets } from "./snippets";

export interface IngestOptions {
  owner: string;
  repo: string;
  ref?: string;
  libraryId?: string; // defaults to `/{owner}/{repo}`
}

export interface IngestResult {
  libraryId: string;
  documents: number;
  chunks: number;
  snippets: number;
  trustScore: number;
  durationMs: number;
}

export async function ingestRepo(opts: IngestOptions): Promise<IngestResult> {
  const start = Date.now();
  const libraryId = opts.libraryId ?? `/${opts.owner}/${opts.repo}`.toLowerCase();
  console.log(`[ingest] ${libraryId}: fetching repo meta…`);
  const meta = await fetchRepoMeta(opts.owner, opts.repo);
  const ref = opts.ref ?? meta.defaultBranch;
  const trustScore = computeTrustScore(meta);

  await db
    .insert(schema.libraries)
    .values({
      id: libraryId,
      title: `${opts.owner}/${opts.repo}`,
      description: meta.description,
      repoUrl: `https://github.com/${opts.owner}/${opts.repo}`,
      sourceUrl: meta.homepage ?? `https://github.com/${opts.owner}/${opts.repo}`,
      trustScore,
      status: "indexing",
    })
    .onConflictDoUpdate({
      target: schema.libraries.id,
      set: {
        description: meta.description,
        trustScore,
        status: "indexing",
      },
    });

  console.log(`[ingest] ${libraryId}: downloading ${ref} tarball…`);
  const files = await fetchRepoDocs(opts.owner, opts.repo, ref);
  console.log(`[ingest] ${libraryId}: ${files.length} markdown files found`);

  // Purge existing documents+chunks for re-ingestion
  await db.delete(schema.documents).where(eq(schema.documents.libraryId, libraryId));

  let totalChunks = 0;
  let totalSnippets = 0;

  for (const file of files) {
    const docId = nanoid();
    await db.insert(schema.documents).values({
      id: docId,
      libraryId,
      version: "latest",
      path: file.path,
      rawContent: file.content,
    });

    totalSnippets += countCodeSnippets(file.content);
    const chunks = chunkMarkdown(file.path, file.content);
    if (chunks.length === 0) continue;

    const embeddings = await embedBatch(chunks.map((c) => c.content));
    const rows = chunks.map((c, i) => ({
      id: nanoid(),
      documentId: docId,
      libraryId,
      content: c.content,
      tokenCount: c.tokenCount,
      position: c.position,
      embedding: embeddings[i],
      metadata: c.metadata as unknown as Record<string, unknown>,
    }));

    // Batch insert in chunks of 100 to stay below Postgres param limit
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(schema.chunks).values(rows.slice(i, i + 100));
    }
    totalChunks += rows.length;
  }

  await db
    .update(schema.libraries)
    .set({
      status: "ready",
      totalSnippets,
      lastIndexedAt: new Date(),
    })
    .where(eq(schema.libraries.id, libraryId));

  const durationMs = Date.now() - start;
  console.log(
    `[ingest] ${libraryId}: done — ${files.length} docs, ${totalChunks} chunks, ${totalSnippets} snippets (${durationMs}ms)`
  );
  return {
    libraryId,
    documents: files.length,
    chunks: totalChunks,
    snippets: totalSnippets,
    trustScore,
    durationMs,
  };
}

// Silence unused warnings for and/sql — reserved for future incremental ingestion.
export const _reserved = { and, sql };
