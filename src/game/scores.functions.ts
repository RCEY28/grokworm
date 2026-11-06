import { createServerFn } from "@tanstack/react-start";
import { cleanScore, type ScoreRow } from "@/game/scores.shared";

export type { ScoreRow };

export const listScores = createServerFn({ method: "GET" }).handler(async () => {
  const { listBoard } = await import("@/game/scores.server");
  return listBoard();
});

export const submitScore = createServerFn({ method: "POST" })
  .validator((data: { initials: string; score: number; level: number }) => cleanScore(data))
  .handler(async ({ data }) => {
    const { saveBoard } = await import("@/game/scores.server");
    return saveBoard(data);
  });
