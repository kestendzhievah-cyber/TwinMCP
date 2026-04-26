import OpenAI from "openai";

let _client: OpenAI | null = null;
const MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const BATCH = 96;

function client(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  _client = new OpenAI({ apiKey });
  return _client;
}

export async function embedBatch(inputs: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH).map((s) => s.slice(0, 8000));
    const res = await client().embeddings.create({ model: MODEL, input: slice });
    for (const item of res.data) out.push(item.embedding);
  }
  return out;
}
