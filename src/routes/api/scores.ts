import { createFileRoute } from "@tanstack/react-router";
import { listBoard, saveBoard } from "@/game/scores.server";
import { cleanScore } from "@/game/scores.shared";

const ALLOWED = new Set(["https://grokworm.com", "https://www.grokworm.com"]);

function headers(request?: Request) {
  const origin = request?.headers.get("origin") ?? "";
  const allow = ALLOWED.has(origin) ? origin : "https://www.grokworm.com";
  return {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, accept",
    vary: "Origin",
  };
}

function json(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

export const Route = createFileRoute("/api/scores")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: headers(request) }),
      GET: async ({ request }) => {
        try {
          return json(await listBoard(), 200, request);
        } catch (error) {
          console.error("[scores] list failed", error);
          return json({ error: "The board did not load." }, 500, request);
        }
      },
      POST: async ({ request }) => {
        try {
          const data = cleanScore(await request.json());
          return json(await saveBoard(data), 200, request);
        } catch (error) {
          const message = error instanceof Error ? error.message : "The board did not save.";
          const status = message.includes("must be") || message.includes("out of range") ? 400 : 500;
          if (status === 500) console.error("[scores] save failed", error);
          return json({ error: message }, status, request);
        }
      },
    },
  },
});
