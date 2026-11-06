export type ShareCard = {
  initials: string;
  score: number;
  rank: number;
  level: number;
  handle?: string;
  name?: string;
  avatar?: string;
};

const W = 1080;
const H = 1350;

function metal(rank: number) {
  if (rank === 1) return { hi: "#ffe7a3", mid: "#e2b03a", deep: "#8a6412", ink: "#2a1c04" };
  if (rank === 2) return { hi: "#f4f7fb", mid: "#b7c3d1", deep: "#5d6b7a", ink: "#1a222c" };
  if (rank === 3) return { hi: "#f3c7a0", mid: "#c4844e", deep: "#6e4124", ink: "#2a160c" };
  return { hi: "#d8fff8", mid: "#3ecbff", deep: "#0e6d86", ink: "#041820" };
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The profile picture did not draw."));
    img.src = src;
  });
}

export async function drawShareCard(data: ShareCard): Promise<HTMLCanvasElement> {
  try {
    await document.fonts.load('42px "Press Start 2P"');
    await document.fonts.load('700 64px Oxanium');
  } catch {
    /* the card still draws if a face is missing */
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The card could not be drawn.");
  const tone = metal(data.rank);
  const photo = data.avatar ? await loadImage(data.avatar) : null;
  const handle = (data.handle || "").replace(/^@+/, "").slice(0, 15);

  ctx.fillStyle = "#07040f";
  ctx.fillRect(0, 0, W, H);

  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, "#14081a");
  wash.addColorStop(0.55, "#07040f");
  wash.addColorStop(1, "#071018");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ff4ad8";
  for (let y = 0; y < H; y += 5) ctx.fillRect(0, y, W, 1);
  ctx.restore();

  round(ctx, 48, 48, W - 96, H - 96, 48);
  ctx.strokeStyle = "#ff4ad8";
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#7dfff6";
  ctx.font = '28px "Press Start 2P", monospace';
  ctx.fillText("GROKWORM", W / 2, 150);

  ctx.fillStyle = "#ff4ad8";
  ctx.font = '42px "Press Start 2P", monospace';
  ctx.fillText(data.rank >= 1 && data.rank <= 10 ? "TOP 10" : "MY SCORE", W / 2, 240);

  const cx = W / 2;
  const cy = 500;
  const ring = ctx.createRadialGradient(cx - 40, cy - 50, 40, cx, cy, 230);
  ring.addColorStop(0, tone.hi);
  ring.addColorStop(0.55, tone.mid);
  ring.addColorStop(1, tone.deep);
  ctx.beginPath();
  ctx.arc(cx, cy, 210, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 168, 0, Math.PI * 2);
  ctx.fillStyle = "#120818";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = tone.hi;
  ctx.stroke();

  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 158, 0, Math.PI * 2);
    ctx.clip();
    const side = Math.min(photo.naturalWidth || photo.width, photo.naturalHeight || photo.height);
    const sx = ((photo.naturalWidth || photo.width) - side) / 2;
    const sy = ((photo.naturalHeight || photo.height) - side) / 2;
    ctx.drawImage(photo, sx, sy, side, side, cx - 158, cy - 158, 316, 316);
    ctx.restore();
    const label = String(data.rank).padStart(2, "0");
    ctx.font = '34px "Press Start 2P", monospace';
    const chipW = ctx.measureText(label).width + 40;
    const chipH = 56;
    const chipX = cx - chipW / 2;
    const chipY = cy + 150;
    round(ctx, chipX, chipY, chipW, chipH, 14);
    ctx.fillStyle = tone.mid;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = tone.hi;
    ctx.stroke();
    ctx.fillStyle = tone.ink;
    ctx.textAlign = "center";
    ctx.fillText(label, cx, chipY + 40);
  } else {
    ctx.fillStyle = tone.hi;
    ctx.font = '92px "Press Start 2P", monospace';
    ctx.fillText(String(data.rank).padStart(2, "0"), cx, cy + 34);
  }

  if (handle) {
    ctx.fillStyle = "#3ecbff";
    ctx.font = '22px "Press Start 2P", monospace';
    ctx.fillText(`@${handle}`, cx, 760);
  }

  const initialsY = handle ? 860 : 820;
  const scoreY = handle ? 940 : 900;
  const levelY = handle ? 1000 : 960;

  ctx.fillStyle = "#7dfff6";
  ctx.font = '64px "Press Start 2P", monospace';
  ctx.fillText(data.initials.slice(0, 3).toUpperCase(), cx, initialsY);

  ctx.fillStyle = "#fff36a";
  ctx.font = '40px "Press Start 2P", monospace';
  ctx.fillText(String(Math.max(0, Math.floor(data.score))).padStart(6, "0"), cx, scoreY);

  ctx.fillStyle = "#8b97a8";
  ctx.font = "700 36px Oxanium, sans-serif";
  ctx.fillText(`Level ${data.level}`, cx, levelY);

  ctx.strokeStyle = "#243041";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, handle ? 1070 : 1040);
  ctx.lineTo(W - 140, handle ? 1070 : 1040);
  ctx.stroke();

  ctx.fillStyle = "#e7eef6";
  ctx.font = "700 40px Oxanium, sans-serif";
  ctx.fillText("Create your own high score", cx, 1130);
  ctx.fillText("on grokworm today!", cx, 1188);

  ctx.fillStyle = "#3ecbff";
  ctx.font = "700 36px Oxanium, sans-serif";
  ctx.fillText("grokworm.com", cx, 1260);

  return canvas;
}

export async function shareCardFile(data: ShareCard): Promise<File> {
  const canvas = await drawShareCard(data);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The card could not be saved.");
  return new File([blob], "grokworm-top10.png", { type: "image/png" });
}

export function shareText(data: ShareCard) {
  const score = Math.max(0, Math.floor(data.score)).toLocaleString("en-US");
  const handle = (data.handle || "").replace(/^@+/, "");
  const who = handle ? `${data.name ? `${data.name} ` : ""}(@${handle})` : data.initials.toUpperCase();
  const place = data.rank >= 1 && data.rank <= 10 ? `is number ${data.rank} on Grokworm with ${score}` : `scored ${score} on Grokworm`;
  return `${who} ${place}.\n\nCreate your own high score on grokworm today!\nhttps://www.grokworm.com`;
}

export async function openScorePost(data: ShareCard): Promise<"shared" | "composer"> {
  const file = await shareCardFile(data);
  const text = shareText(data);
  const payload: ShareData = { title: "Grokworm top 10", text, files: [file] };
  if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share(payload);
    return "shared";
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  return "composer";
}
