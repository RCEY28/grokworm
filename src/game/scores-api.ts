import type { ScoreRow } from "@/game/scores.shared";

type Saved = { id: number; rank: number; board: ScoreRow[] };

const ENDPOINTS = ["/api/scores", "https://www.grokworm.com/api/scores"];

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function attempt(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, cache: "no-store" });
}

export async function loadScores(): Promise<ScoreRow[]> {
  let last = "The board did not load.";
  for (const url of ENDPOINTS) {
    try {
      const res = await attempt(url, { headers: { accept: "application/json" } });
      const data = await readBody(res);
      if (res.ok && Array.isArray(data)) return data as ScoreRow[];
      last = `The board did not load (${res.status}).`;
    } catch {
      last = "The network blocked the board.";
    }
  }
  throw new Error(last);
}

export async function postScore(data: { initials: string; score: number; level: number }) {
  let last = "The board did not save. Try again.";
  for (let tryNo = 0; tryNo < 2; tryNo += 1) {
    for (const url of ENDPOINTS) {
      try {
        const res = await attempt(url, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(data),
        });
        const body = (await readBody(res)) as Partial<Saved> & { error?: string } | null;
        if (res.ok && body && Array.isArray(body.board) && Number.isFinite(Number(body.rank))) {
          return body as Saved;
        }
        last = body?.error || `The board did not save (${res.status}). Try again.`;
      } catch {
        last = "The phone blocked the save. Try again.";
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(last);
}
