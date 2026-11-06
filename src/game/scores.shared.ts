export type ScoreRow = {
  id: number;
  initials: string;
  score: number;
  level: number;
};

const LETTERS = /^[A-Z]{3}$/;

function cleanInt(value: unknown, min: number, max: number, label: string) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} is out of range.`);
  return n;
}

export function cleanScore(input: unknown) {
  const data = (input ?? {}) as { initials?: unknown; score?: unknown; level?: unknown };
  const initials = String(data.initials ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!LETTERS.test(initials)) throw new Error("Initials must be three letters.");
  return {
    initials,
    score: cleanInt(data.score, 0, 999999, "Score"),
    level: cleanInt(data.level, 1, 99, "Level"),
  };
}
