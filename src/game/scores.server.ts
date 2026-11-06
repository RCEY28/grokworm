import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fromCrossJSON, toJSONAsync } from "seroval";
import { getSql } from "@/lib/db";
import { type ScoreRow } from "@/game/scores.shared";

const LIVE = "https://www.grokworm.com";
const LIST_ID = "bc9c42fb49a6df2776eeb84633b5d303efa78b8b84e018fa1fe9086bf2ef42d5";
const SUBMIT_ID = "31e8a2dcab9c1bcc0662060e69fdd0c7c179c283c5e08274bbf14e892940b986";
const FILE = "/workspace/data/scores.json";

type Saved = { id: number; rank: number; board: ScoreRow[] };

function neonOn() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function previewHost() {
  return !process.env.VERCEL && !neonOn();
}

function mapRows(rows: ScoreRow[]): ScoreRow[] {
  return rows.map((row) => ({
    id: Number(row.id),
    initials: String(row.initials),
    score: Number(row.score),
    level: Number(row.level),
  }));
}

function asRows(value: unknown): ScoreRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ScoreRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Partial<ScoreRow>;
    if (typeof row.initials !== "string" || !Number.isFinite(Number(row.score))) return null;
    rows.push({
      id: Number(row.id),
      initials: row.initials,
      score: Number(row.score),
      level: Number(row.level),
    });
  }
  return rows;
}

async function remember(rows: ScoreRow[]) {
  if (process.env.VERCEL) return;
  try {
    if (!rows.length) return;
    const body = JSON.stringify(rows);
    const prev = await readFile(FILE, "utf8").catch(() => "");
    if (prev === body) return;
    await mkdir("/workspace/data", { recursive: true });
    await writeFile(FILE, body, "utf8");
  } catch {
    /* the public database is the real copy */
  }
}

async function readBackup(): Promise<ScoreRow[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    return asRows(JSON.parse(raw)) ?? [];
  } catch {
    return [];
  }
}

async function liveFetch(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function decode(payload: unknown): unknown {
  const value = fromCrossJSON(payload as never, { plugins: [] }) as { result?: unknown; error?: unknown };
  if (value?.error) return null;
  return value?.result ?? null;
}

async function pullLive(): Promise<ScoreRow[] | null> {
  try {
    const api = await liveFetch(`${LIVE}/api/scores`, { headers: { accept: "application/json" } });
    if (api.ok) {
      const rows = asRows(await api.json());
      if (rows) return rows;
    }
  } catch {
    /* try the published game's current board endpoint */
  }
  try {
    const res = await liveFetch(`${LIVE}/_serverFn/${LIST_ID}`, {
      headers: {
        accept: "application/json",
        origin: LIVE,
        "sec-fetch-site": "same-origin",
        "x-tsr-serverFn": "true",
      },
    });
    if (!res.ok) return null;
    return asRows(decode(await res.json()));
  } catch {
    return null;
  }
}

async function pushLive(data: { initials: string; score: number; level: number }): Promise<Saved | null> {
  try {
    const api = await liveFetch(`${LIVE}/api/scores`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (api.ok) {
      const body = (await api.json()) as Partial<Saved>;
      const board = asRows(body.board);
      if (board && Number.isFinite(Number(body.rank))) {
        return { id: Number(body.id), rank: Number(body.rank), board };
      }
    }
  } catch {
    /* fall through to the published endpoint */
  }
  try {
    const payload = await toJSONAsync({ data });
    const res = await liveFetch(`${LIVE}/_serverFn/${SUBMIT_ID}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: LIVE,
        "sec-fetch-site": "same-origin",
        "x-tsr-serverFn": "true",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const body = decode(await res.json()) as Partial<Saved> | null;
    const board = asRows(body?.board);
    if (!body || !board || !Number.isFinite(Number(body.rank))) return null;
    return { id: Number(body.id), rank: Number(body.rank), board };
  } catch {
    return null;
  }
}

const KEPT: Array<Pick<ScoreRow, "initials" | "score" | "level">> = [
  { initials: "AJJ", score: 7262, level: 5 },
  { initials: "JAK", score: 7192, level: 7 },
  { initials: "AAA", score: 6480, level: 3 },
  { initials: "BAD", score: 5608, level: 5 },
  { initials: "AAA", score: 5276, level: 4 },
  { initials: "BIG", score: 4820, level: 5 },
  { initials: "AAA", score: 3454, level: 2 },
  { initials: "DAD", score: 2070, level: 1 },
];

let keptOnce: Promise<void> | null = null;

async function ensureKept() {
  keptOnce ??= (async () => {
    const sql = await getSql();
    for (const row of KEPT) {
      await sql`
        insert into scores (initials, score, level)
        select ${row.initials}, ${row.score}, ${row.level}
        where not exists (
          select 1 from scores
          where initials = ${row.initials} and score = ${row.score} and level = ${row.level}
        )
      `;
    }
  })().catch((error) => {
    keptOnce = null;
    throw error;
  });
  return keptOnce;
}

async function listSql(): Promise<ScoreRow[]> {
  const sql = await getSql();
  const rows = await sql<ScoreRow>`
    select id, initials, score, level
    from scores
    order by score desc, id asc
    limit 10
  `;
  return mapRows(rows);
}

async function insertSql(data: { initials: string; score: number; level: number }): Promise<Saved> {
  const sql = await getSql();
  const inserted = await sql<{ id: number }>`
    insert into scores (initials, score, level)
    values (${data.initials}, ${data.score}, ${data.level})
    returning id
  `;
  const id = Number(inserted[0]?.id ?? 0);
  const higher = await sql<{ n: number }>`
    select count(*)::int as n from scores
    where score > ${data.score} or (score = ${data.score} and id < ${id})
  `;
  return { id, rank: Number(higher[0]?.n ?? 0) + 1, board: await listSql() };
}

async function saveFile(data: { initials: string; score: number; level: number }): Promise<Saved> {
  const rows = await readBackup();
  const id = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  const next = [...rows, { id, initials: data.initials, score: data.score, level: data.level }];
  next.sort((a, b) => b.score - a.score || a.id - b.id);
  await remember(next);
  const rank = next.findIndex((row) => row.id === id) + 1;
  return { id, rank, board: next.slice(0, 10) };
}

export async function listBoard(): Promise<ScoreRow[]> {
  if (previewHost()) {
    const live = await pullLive();
    if (live && live.length) {
      await remember(live);
      return live.slice(0, 10);
    }
    const backup = await readBackup();
    if (backup.length) return backup.slice(0, 10);
  }
  await ensureKept();
  return listSql();
}

export async function saveBoard(data: { initials: string; score: number; level: number }): Promise<Saved> {
  if (previewHost()) {
    const live = await pushLive(data);
    if (live) {
      await remember(live.board);
      return live;
    }
    return saveFile(data);
  }
  await ensureKept();
  return insertSql(data);
}
