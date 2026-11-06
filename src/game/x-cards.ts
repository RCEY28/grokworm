export type CardLog = {
  handle: string;
  name: string;
  initials: string;
  score: number;
  level: number;
  rank: number | null;
};

export async function logXCard(row: CardLog) {
  const urls = ["/api/x-cards", "https://www.grokworm.com/api/x-cards"];
  let last = "The brag log did not save.";
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(row),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) return;
      if (data?.error) last = data.error;
      if (url.startsWith("/")) break;
    } catch {
      last = "The brag log did not save.";
    }
  }
  throw new Error(last);
}
