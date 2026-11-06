import { createFileRoute } from "@tanstack/react-router";
import { lookupXProfile } from "@/game/x-profile.server";

const ALLOWED = new Set(["https://grokworm.com", "https://www.grokworm.com"]);

function headers(request?: Request) {
  const origin = request?.headers.get("origin") ?? "";
  const allow = ALLOWED.has(origin) ? origin : "https://www.grokworm.com";
  return {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type, accept",
    vary: "Origin",
  };
}

function json(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

export const Route = createFileRoute("/api/x-profile")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: headers(request) }),
      GET: async ({ request }) => {
        const handle = new URL(request.url).searchParams.get("handle") ?? "";
        try {
          return json(await lookupXProfile(handle), 200, request);
        } catch (error) {
          const message = error instanceof Error ? error.message : "That X profile did not load.";
          const status = message.startsWith("Enter an") ? 400 : message.startsWith("No X profile") ? 404 : 502;
          if (status === 502) console.error("[x-profile] lookup failed", error);
          return json({ error: message }, status, request);
        }
      },
    },
  },
});
