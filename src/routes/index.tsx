import { createFileRoute } from "@tanstack/react-router";
import { GrokwormGame } from "@/components/grokworm-game";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <GrokwormGame />;
}
