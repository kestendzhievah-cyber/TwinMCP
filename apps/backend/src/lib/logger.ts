type Level = "info" | "warn" | "error";

interface LogEntry {
  level: Level;
  message: string;
  [key: string]: unknown;
}

const AXIOM_TOKEN = process.env.AXIOM_TOKEN;
const AXIOM_DATASET = process.env.AXIOM_DATASET ?? "twinmcp";
const AXIOM_URL = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`;

async function sendToAxiom(entries: LogEntry[]) {
  if (!AXIOM_TOKEN) return;
  try {
    await fetch(AXIOM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AXIOM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entries.map((e) => ({ ...e, _time: new Date().toISOString() }))),
    });
  } catch {
    // Swallow — logging should never crash the app
  }
}

export function log(level: Level, message: string, data: Record<string, unknown> = {}) {
  const entry: LogEntry = { level, message, ...data };
  if (level === "error") console.error(`[${level}]`, message, data);
  else console.log(`[${level}]`, message, data);
  sendToAxiom([entry]);
}

export const logger = {
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
