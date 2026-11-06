import { createFileRoute } from "@tanstack/react-router";
import { saveCardLog } from "@/game/x-cards.server";

const ALLOWED = new Set(["https://grokworm.com", "https://www.grokworm.com"]);

function headers(request?: Request) {
  const origin = request?.headers.get("origin") ?? "";
  const allow = ALLOWED.has(origin) ? origin : "https://www.grokworm.com";
  return {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, accept",
    vary: "Origin",
  };
}

function json(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

export const Route = createFileRoute("/api/x-cards")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: headers(request) }),
      POST: async ({ request }) => {
        try {
          return json(await saveCardLog(await request.json()), 200, request);
        } catch (error) {
          const message = error instanceof Error ? error.message : "The brag log did not save.";
          const status = message.startsWith("Enter an") || message.includes("must be") || message.includes("cannot") ? 400 : 500;
          if (status === 500) console.error("[x-cards] log failed", error);
          return json({ error: message }, status, request);
        }
      },
    },
  },
});
