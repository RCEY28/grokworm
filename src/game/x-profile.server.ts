const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

type Found = {
  handle: string;
  name: string;
  avatar: string;
};

function biggerAvatar(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "pbs.twimg.com") return null;
  if (!url.pathname.startsWith("/profile_images/")) return null;
  url.pathname = url.pathname.replace(/_(normal|bigger|mini|200x200|400x400)(?=\.[a-z0-9]+$)/i, "_400x400");
  if (!/_400x400\.[a-z0-9]+$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/(\.[a-z0-9]+)$/i, "_400x400$1");
  }
  url.search = "";
  return url.toString();
}

export async function lookupXProfile(input: string): Promise<Found> {
  const handle = input.trim().replace(/^@+/, "");
  if (!HANDLE.test(handle)) throw new Error("Enter an X handle. Letters, numbers, and underscores, up to 15.");

  type Lookup = { user?: { screen_name?: string; name?: string; avatar_url?: string } };
  let lookup: Response | null = null;
  let body: Lookup | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      lookup = await fetch(`https://api.fxtwitter.com/${handle}`, {
        headers: { accept: "application/json", "user-agent": "Grokworm/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      body = (await lookup.json().catch(() => null)) as Lookup | null;
      if (lookup.ok && body?.user?.avatar_url) break;
    } catch {
      lookup = null;
    }
  }
  const user = body?.user;
  if (!lookup?.ok || !user?.screen_name || !user.avatar_url) {
    throw new Error(lookup ? "No X profile for that handle." : "X did not answer. Try again.");
  }
  const picture = biggerAvatar(user.avatar_url);
  if (!picture) throw new Error("That profile picture did not load. Try again.");

  let image: Response;
  try {
    image = await fetch(picture, {
      headers: { accept: "image/jpeg,image/png,image/webp" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
  } catch {
    throw new Error("That profile picture did not load. Try again.");
  }
  const finalHost = (() => {
    try {
      return new URL(image.url).hostname;
    } catch {
      return "";
    }
  })();
  const type = (image.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() || "";
  if (!image.ok || finalHost !== "pbs.twimg.com" || !["image/jpeg", "image/png", "image/webp"].includes(type)) {
    throw new Error("That profile picture did not load. Try again.");
  }
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (bytes.byteLength < 64 || bytes.byteLength > 1_500_000) {
    throw new Error("That profile picture did not load. Try again.");
  }
  const name = String(user.name || user.screen_name).replace(/\s+/g, " ").trim().slice(0, 50);
  return {
    handle: user.screen_name.replace(/^@+/, "").slice(0, 15),
    name: name || user.screen_name,
    avatar: `data:${type};base64,${Buffer.from(bytes).toString("base64")}`,
  };
}
