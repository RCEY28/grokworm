import { mkdir, readFile, writeFile } from "node:fs/promises";
import { getSql } from "@/lib/db";

const FILE = "/workspace/data/x-cards.json";
const SHEET = "/workspace/artifacts/grokworm/X-CARD-LOG.csv";

export type CardLog = {
  handle: string;
  name: string;
  initials: string;
  score: number;
  level: number;
  rank: number | null;
};

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export function cleanCardLog(input: unknown): CardLog {
  const data = (input ?? {}) as Partial<CardLog>;
  const handle = String(data.handle ?? "").trim().replace(/^@+/, "");
  const name = String(data.name ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
  const initials = String(data.initials ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  const score = Math.floor(Number(data.score));
  const level = Math.floor(Number(data.level));
  const rank = Number.isFinite(Number(data.rank)) ? Math.floor(Number(data.rank)) : null;
  if (!HANDLE.test(handle)) throw new Error("Enter an X handle. Letters, numbers, and underscores, up to 15.");
  if (!name) throw new Error("That X profile did not load.");
  if (initials.length !== 3) throw new Error("Initials must be three letters.");
  if (!Number.isFinite(score) || score < 0 || score > 99999999) throw new Error("That score cannot be logged.");
  if (!Number.isFinite(level) || level < 1 || level > 999) throw new Error("That level cannot be logged.");
  return { handle, name, score, level, initials, rank };
}

async function remember(row: CardLog & { at: string }) {
  if (process.env.VERCEL) return;
  const prev = await readFile(FILE, "utf8").catch(() => "[]");
  let rows: unknown[] = [];
  try {
    const parsed = JSON.parse(prev);
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    rows = [];
  }
  rows.push(row);
  await mkdir("/workspace/data", { recursive: true });
  await writeFile(FILE, JSON.stringify(rows), "utf8");
  const lines = ["When,Handle,Name,Initials,Score,Level,Rank"];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Partial<CardLog & { at: string }>;
    const cells = [entry.at, entry.handle, entry.name, entry.initials, entry.score, entry.level, entry.rank ?? ""].map((value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`,
    );
    lines.push(cells.join(","));
  }
  await mkdir("/workspace/artifacts/grokworm", { recursive: true });
  await writeFile(SHEET, `${lines.join("\n")}\n`, "utf8");
}

export async function saveCardLog(input: unknown) {
  const row = cleanCardLog(input);
  const at = new Date().toISOString();
  if (process.env.VERCEL || process.env.DATABASE_URL?.trim()) {
    const sql = await getSql();
    await sql`
      insert into x_cards (handle, name, initials, score, level, rank)
      values (${row.handle}, ${row.name}, ${row.initials}, ${row.score}, ${row.level}, ${row.rank})
    `;
  }
  await remember({ ...row, at });
  return { ok: true, handle: row.handle, at };
}
