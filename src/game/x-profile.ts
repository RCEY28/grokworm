export type XProfile = {
  handle: string;
  name: string;
  avatar: string;
};

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export function cleanHandle(input: string) {
  return input.trim().replace(/^@+/, "");
}

export function validHandle(input: string) {
  return HANDLE.test(cleanHandle(input));
}

export async function loadXProfile(handle: string): Promise<XProfile> {
  const name = cleanHandle(handle);
  if (!HANDLE.test(name)) throw new Error("Enter an X handle. Letters, numbers, and underscores, up to 15.");
  const urls = [
    `/api/x-profile?handle=${encodeURIComponent(name)}`,
    `https://www.grokworm.com/api/x-profile?handle=${encodeURIComponent(name)}`,
  ];
  let last = "That X profile did not load. Try again.";
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
      const data = (await res.json().catch(() => null)) as (XProfile & { error?: string }) | null;
      if (res.ok && data?.avatar?.startsWith("data:image/") && data.handle && data.name) {
        return { handle: data.handle, name: data.name, avatar: data.avatar };
      }
      if (data?.error) last = data.error;
      if (url.startsWith("/") && data) break;
      if (res.status === 404 || res.status === 400) break;
    } catch {
      last = "The phone could not reach X. Try again.";
    }
  }
  throw new Error(last);
}
