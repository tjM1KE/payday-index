import forwardSeed from "../../data/forward-paper.json";

type RuntimeEnv = {
  DB?: D1Database;
  FORWARD_SYNC_TOKEN?: string;
};

type ForwardLedgerPayload = {
  version: 1;
  status: "forward";
  updatedAt: string | null;
  records: Array<{ signalMonth:string; [key:string]:unknown }>;
  current: unknown;
  [key:string]: unknown;
};

function runtimeEnv(): RuntimeEnv {
  return (globalThis as typeof globalThis & { __PAYDAY_RUNTIME_ENV__?:RuntimeEnv }).__PAYDAY_RUNTIME_ENV__ ?? {};
}

function validLedger(value: unknown): value is ForwardLedgerPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?:unknown; status?:unknown; records?:unknown; current?:unknown };
  return candidate.version === 1
    && candidate.status === "forward"
    && Array.isArray(candidate.records)
    && candidate.records.length > 0
    && candidate.current !== null;
}

export async function GET() {
  const { DB, FORWARD_SYNC_TOKEN } = runtimeEnv();
  const headers = {
    "X-Payday-Storage": DB ? "ready" : "missing",
    "X-Payday-Sync": FORWARD_SYNC_TOKEN ? "ready" : "missing",
  };
  if (!DB) return Response.json(forwardSeed, { headers });

  try {
    const row = await DB.prepare("SELECT payload FROM forward_paper WHERE id = 1").first<{ payload:string }>();
    return Response.json(row ? JSON.parse(row.payload) : forwardSeed, { headers });
  } catch {
    return Response.json(forwardSeed, { headers });
  }
}

export async function POST(request: Request) {
  const { DB, FORWARD_SYNC_TOKEN } = runtimeEnv();
  const syncToken = request.headers.get("x-forward-sync-token");
  if (!FORWARD_SYNC_TOKEN || syncToken !== FORWARD_SYNC_TOKEN) {
    return Response.json({ error:"Not allowed" }, { status:401 });
  }
  if (!DB) return Response.json({ error:"Paper ledger storage is unavailable" }, { status:503 });

  let ledger: unknown;
  try {
    ledger = await request.json();
  } catch {
    return Response.json({ error:"The paper ledger must be JSON" }, { status:400 });
  }
  if (!validLedger(ledger)) return Response.json({ error:"The paper ledger is invalid" }, { status:400 });

  const current = await DB.prepare("SELECT payload FROM forward_paper WHERE id = 1").first<{ payload:string }>();
  if (current) {
    const previous = JSON.parse(current.payload) as { records?:Array<Record<string,unknown>> };
    const previousRecords = previous.records ?? [];
    const nextPrefix = ledger.records.slice(0, previousRecords.length);
    if (JSON.stringify(nextPrefix) !== JSON.stringify(previousRecords)) {
      return Response.json({ error:"Existing forward history cannot be rewritten" }, { status:409 });
    }
  }

  const updatedAt = ledger.updatedAt ?? new Date().toISOString();
  await DB.prepare(`
    INSERT INTO forward_paper (id, payload, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).bind(JSON.stringify(ledger), updatedAt).run();

  return Response.json({ synced:true, records:ledger.records.length, updatedAt });
}
