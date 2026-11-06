import { Cell, RULES, type GameState } from "@/game/types";
import { trackAt } from "@/game/logic";
import { paletteFor, type Palette } from "@/game/theme";

function hash(c: number, r: number) {
  let n = (c * 374761393 + r * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function dirtColor(c: number, r: number, surfaceRow: number, rows: number, dirt: string[]) {
  const depth = (r - surfaceRow) / Math.max(1, rows - surfaceRow);
  const base = dirt[Math.floor(hash(c, r) * dirt.length) % dirt.length];
  const dark = Math.min(0.45, depth * 0.4);
  const n = parseInt(base.slice(1), 16);
  const rr = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = 1 - dark;
  return `rgb(${(rr * f) | 0}, ${(g * f) | 0}, ${(b * f) | 0})`;
}

let plate: HTMLCanvasElement | null = null;
let plateCtx: CanvasRenderingContext2D | null = null;
let plateGen = -1;
let plateW = 0;
let plateH = 0;
let plateN = 0;

function paintPlate(ctx: CanvasRenderingContext2D, s: GameState, theme: Palette) {
  const { cell, cols, rows, surfaceRow, w, h } = s.world;
  ctx.clearRect(0, 0, w, h);
  for (let r = surfaceRow; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cell;
      const y = r * cell;
      ctx.fillStyle = r === surfaceRow ? theme.crust : dirtColor(c, r, surfaceRow, rows, theme.dirt);
      ctx.fillRect(x, y, cell, cell);
      if (r === surfaceRow) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x, y + cell - 4, cell, 4);
      } else if (hash(c + 3, r + 5) > 0.84) {
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(x + cell * 0.62, y + cell * 0.58, 2.2, 1.5, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function punchBores(ctx: CanvasRenderingContext2D, s: GameState, from: number, theme: Palette) {
  if (from >= s.boreX.length) return;
  const width = (RULES.bodyRadius + 3) * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#02060c";
  ctx.lineWidth = width + 3;
  ctx.beginPath();
  let open = false;
  const start = Math.max(0, from - 1);
  for (let i = start; i < s.boreX.length; i++) {
    const x = s.boreX[i];
    const y = s.boreY[i];
    if (!open) {
      ctx.moveTo(x, y);
      open = true;
      continue;
    }
    const dx = x - s.boreX[i - 1];
    const dy = y - s.boreY[i - 1];
    if (dx * dx + dy * dy > 20 * 20) {
      ctx.moveTo(x, y);
      continue;
    }
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = theme.tunnel;
  ctx.lineWidth = width;
  ctx.stroke();

  const rad = width / 2;
  ctx.fillStyle = theme.tunnel;
  for (let i = from; i < s.boreX.length; i++) {
    const prev = i - 1;
    const dx = prev >= 0 ? s.boreX[i] - s.boreX[prev] : 99;
    const dy = prev >= 0 ? s.boreY[i] - s.boreY[prev] : 99;
    if (prev >= 0 && dx * dx + dy * dy <= 20 * 20) continue;
    ctx.beginPath();
    ctx.arc(s.boreX[i], s.boreY[i], rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

function syncPlate(s: GameState, theme: Palette) {
  const { w, h } = s.world;
  if (!plate || plateW !== w || plateH !== h || plateGen !== s.boreGen) {
    plate = document.createElement("canvas");
    plate.width = Math.max(1, w);
    plate.height = Math.max(1, h);
    plateCtx = plate.getContext("2d");
    plateW = w;
    plateH = h;
    plateGen = s.boreGen;
    plateN = 0;
    if (plateCtx) paintPlate(plateCtx, s, theme);
  }
  if (plateCtx && plateN < s.boreX.length) {
    punchBores(plateCtx, s, plateN, theme);
    plateN = s.boreX.length;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCracks(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, seed: number) {
  ctx.strokeStyle = "rgba(8, 6, 4, 0.8)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const x0 = x + cell * (0.2 + seed * 0.2);
  ctx.moveTo(x0, y + 2);
  ctx.lineTo(x0 + cell * 0.15, y + cell * 0.45);
  ctx.lineTo(x0 - cell * 0.08, y + cell - 2);
  ctx.moveTo(x + cell * 0.65, y + 3);
  ctx.lineTo(x + cell * 0.5, y + cell * 0.7);
  ctx.stroke();
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, glow: string) {
  const pulse = 0.78 + Math.sin(clock * 4) * 0.22;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14 * pulse;
  ctx.fillStyle = "#041018";
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.1, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(0, 0.2, 3.3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-0.7, -1.5, 1.25, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function eyeOpen(clock: number, reduced: boolean) {
  if (reduced) return 1;
  const period = 3.1;
  const t = clock % period;
  const start = period - 0.36;
  if (t < start) return 1;
  const u = (t - start) / 0.36;
  if (u < 0.38) return 1 - u / 0.38;
  if (u < 0.58) return 0.06;
  return 0.06 + ((u - 0.58) / 0.42) * 0.94;
}

function drawAlmondEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  open: number,
  glow: string,
  tilt: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(1, Math.max(0.07, open));
  const ew = r * 0.34;
  const eh = r * 0.24;
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 0.22;
  ctx.fillStyle = "#021018";
  ctx.beginPath();
  ctx.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, ew * 0.7, eh * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f7feff";
  ctx.beginPath();
  ctx.ellipse(-ew * 0.16, -eh * 0.12, ew * 0.2, eh * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#041018";
  const slit = Math.max(0.45, r * 0.045);
  ctx.fillRect(-slit / 2, -eh * 0.9, slit, eh * 1.8);
  ctx.restore();
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  clock: number,
  reduced: boolean,
  glow: string,
) {
  const open = eyeOpen(clock, reduced);
  const look = reduced ? 0 : Math.sin(clock * 0.9) * r * 0.04;
  const bob = reduced ? 0 : Math.sin(clock * 2.2) * Math.min(3, r * 0.03);
  ctx.save();
  ctx.translate(x, y + bob);

  const body = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.08, 0, 0, r);
  body.addColorStop(0, "#4a5563");
  body.addColorStop(0.28, "#232a33");
  body.addColorStop(0.72, "#12161c");
  body.addColorStop(1, "#05070a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  drawAlmondEye(ctx, -r * 0.28 + look, -r * 0.02, r, open, glow, -0.38);
  drawAlmondEye(ctx, r * 0.28 + look, -r * 0.02, r, open, glow, 0.38);

  ctx.strokeStyle = glow;
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 0.12;
  ctx.lineWidth = Math.max(0.45, r * 0.05);
  const xx = -r * 0.68;
  const xy = r * 0.02;
  const s = r * 0.09;
  ctx.beginPath();
  ctx.moveTo(xx - s, xy - s);
  ctx.lineTo(xx + s, xy + s);
  ctx.moveTo(xx + s, xy - s);
  ctx.lineTo(xx - s, xy + s);
  ctx.stroke();

  ctx.lineWidth = Math.max(0.6, r * 0.07);
  ctx.beginPath();
  ctx.arc(0, r * 0.16, r * 0.34, 0.25, Math.PI - 0.25);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#04060a";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.28, r * 0.22, r * 0.1, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = glow;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = Math.max(0.4, r * 0.04);
  ctx.beginPath();
  ctx.arc(0, r * 0.2, r * 0.16, 0.45, Math.PI - 0.45);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawReadyWorm(ctx: CanvasRenderingContext2D, s: GameState, theme: Palette, face: number) {
  const { w, cell, surfaceRow, rows } = s.world;
  const heroR = Math.min(36, Math.max(26, w * 0.082));
  const headR = RULES.bodyRadius + (heroR - RULES.bodyRadius) * face;
  const x0 = Math.max(cell * 1.4, w * 0.16);
  const y0 = surfaceRow * cell + cell * 2.55;
  const destY = Math.min((rows - 4) * cell, (surfaceRow + 10) * cell);
  const u = 1 - face;
  const x = x0 + (s.x - x0) * u;
  const y = y0 + (destY - y0) * u;
  drawPortrait(ctx, x, y, headR, s.clock, s.reduced, theme.wormGlow);
}

function faceAmount(s: GameState) {
  if (!s.intro) return 0;
  if (s.mode === "menu" || s.mode === "countdown") return 1;
  if (s.mode === "enter") {
    const duration = s.reduced ? 0.4 : RULES.diveTime;
    return Math.max(0, Math.min(1, s.dive / duration));
  }
  return 0;
}
function drawWorm(ctx: CanvasRenderingContext2D, s: GameState, theme: Palette) {
  if (s.invuln > 0 && Math.sin(s.clock * 28) > 0.15 && s.mode === "play") return;

  const bob = s.mode === "menu" && !s.reduced ? Math.sin(s.clock * 2.2) * 1.3 : 0;
  const pts: { x: number; y: number }[] = [{ x: s.x, y: s.y + bob }];
  for (let i = 0; i < s.trailX.length; i++) {
    const fade = 1 - i / Math.max(1, s.trailX.length);
    pts.push({ x: s.trailX[i], y: s.trailY[i] + bob * fade * 0.4 });
  }
  if (pts.length < 2) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#10151c";
  ctx.lineWidth = RULES.bodyRadius * 2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  const rad = RULES.bodyRadius;
  for (let i = pts.length - 1; i >= 1; i--) {
    const p = pts[i];
    const q = pts[i - 1];
    const g = ctx.createRadialGradient(p.x - rad * 0.3, p.y - rad * 0.35, rad * 0.1, p.x, p.y, rad);
    g.addColorStop(0, theme.wormHi);
    g.addColorStop(0.45, theme.worm);
    g.addColorStop(1, theme.wormDeep);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.fill();

    const ang = Math.atan2(q.y - p.y, q.x - p.x);
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    const ring = ctx.createLinearGradient(0, -rad, 0, rad);
    ring.addColorStop(0, "#6a7380");
    ring.addColorStop(0.35, "#e6edf5");
    ring.addColorStop(0.5, "#9aa6b5");
    ring.addColorStop(1, "#4c5562");
    ctx.fillStyle = ring;
    ctx.fillRect(-2.1, -rad * 0.92, 4.2, rad * 1.84);
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.shadowColor = theme.wormGlow;
    ctx.shadowBlur = 6;
    ctx.fillStyle = theme.wormGlow;
    ctx.fillRect(rad * 0.05, -1.15, Math.max(3, rad * 0.55), 2.3);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  const head = pts[0];
  const neck = pts[1];
  const facing =
    s.dirX !== 0 || s.dirY !== 0 ? s.facing : Math.atan2(head.y - neck.y, head.x - neck.x);

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(facing);

  const collar = ctx.createLinearGradient(0, -RULES.bodyRadius, 0, RULES.bodyRadius);
  collar.addColorStop(0, "#5c6674");
  collar.addColorStop(0.4, "#f2f6fb");
  collar.addColorStop(1, "#6d7786");
  ctx.fillStyle = collar;
  roundRect(ctx, -RULES.bodyRadius - 6, -RULES.bodyRadius, 7, RULES.bodyRadius * 2, 2);
  ctx.fill();

  const hg = ctx.createRadialGradient(-5, -5, 2, 1, 0, RULES.bodyRadius);
  hg.addColorStop(0, theme.wormHi);
  hg.addColorStop(0.42, theme.worm);
  hg.addColorStop(1, theme.wormDeep);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, 0, RULES.bodyRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = theme.wormGlow;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(1, 0, 11.5, 0.7, 2.5);
  ctx.stroke();

  ctx.strokeStyle = theme.wormGlow;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(-8, -3.5);
  ctx.lineTo(-4.2, -7.2);
  ctx.moveTo(-8, -7.2);
  ctx.lineTo(-4.2, -3.5);
  ctx.stroke();

  drawEye(ctx, 6.6, -6.3, s.clock, theme.wormGlow);
  drawEye(ctx, 6.6, 6.3, s.clock, theme.wormGlow);

  ctx.strokeStyle = theme.wormHi;
  ctx.lineWidth = 1.7;
  ctx.shadowColor = theme.wormGlow;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(7, 1.5, 5.5, 0.35, Math.PI - 0.35);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const lg = ctx.createRadialGradient(head.x, head.y, 4, head.x, head.y, 78);
  lg.addColorStop(0, theme.wormGlow);
  lg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBonus(ctx: CanvasRenderingContext2D, s: GameState) {
  if (!s.bonus) return;
  const { cell, surfaceRow, w, h } = s.world;
  const count = 160;
  const mid: { x: number; y: number; facing: number }[] = [];
  for (let i = 0; i < count; i++) mid.push(trackAt(s, i / count));
  const loop = () => {
    ctx.beginPath();
    ctx.moveTo(mid[0].x, mid[0].y);
    for (let i = 1; i < mid.length; i++) ctx.lineTo(mid[i].x, mid[i].y);
    ctx.closePath();
  };

  ctx.save();
  ctx.fillStyle = "#24160f";
  ctx.fillRect(0, surfaceRow * cell, w, h - surfaceRow * cell);
  loop();
  ctx.fillStyle = "#14361f";
  ctx.fill();

  const lane = Math.max(34, cell * 1.55);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  loop();
  ctx.strokeStyle = "#f4f4f4";
  ctx.lineWidth = lane + 8;
  ctx.stroke();
  ctx.strokeStyle = "#e10600";
  ctx.lineWidth = lane + 4;
  ctx.setLineDash([14, 16]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#2a3036";
  ctx.lineWidth = lane;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 14]);
  ctx.lineDashOffset = -s.clock * 36;
  ctx.stroke();
  ctx.setLineDash([]);

  const start = mid[0];
  const standX = start.x + Math.cos(start.facing + Math.PI / 2) * (lane * 0.72);
  const standY = start.y + Math.sin(start.facing + Math.PI / 2) * (lane * 0.72);
  ctx.save();
  ctx.translate(standX, standY);
  ctx.rotate(start.facing);
  ctx.fillStyle = "#9aa3ad";
  ctx.fillRect(-54, -14, 108, 8);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? "#8d1d2d" : "#d7dde4";
    ctx.fillRect(-48 + i * 16, -6, 14, 14);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(start.x, start.y);
  ctx.rotate(start.facing + Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? "#111" : "#f4f4f4";
    ctx.fillRect(-lane * 0.4 + (i * lane * 0.8) / 8, -4, (lane * 0.8) / 8 + 0.4, 8);
  }
  ctx.restore();

  for (const gem of s.gems) {
    if (gem.got) continue;
    const pulse = 0.85 + Math.sin(s.clock * 6 + gem.x) * 0.15;
    const r = (gem.boost ? 10 : 8) * pulse;
    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.rotate(s.clock * (gem.boost ? 2.4 : 1.4));
    ctx.shadowColor = gem.boost ? "#ffe36a" : "#3ef0ff";
    ctx.shadowBlur = 14;
    ctx.fillStyle = gem.boost ? "#ffe36a" : "#7af6ff";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.72, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.72, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawShot(ctx: CanvasRenderingContext2D, s: GameState) {
  const shot = s.shot;
  if (!shot) return;
  const ang = Math.atan2(shot.vy, shot.vx);
  ctx.save();
  ctx.translate(shot.x, shot.y);
  ctx.rotate(ang);
  const rad = RULES.bodyRadius;
  ctx.strokeStyle = "rgba(255, 236, 140, 0.95)";
  ctx.lineWidth = Math.max(4, rad * 0.45);
  ctx.beginPath();
  ctx.moveTo(-rad * 2.6, 0);
  ctx.lineTo(-rad * 0.85, 0);
  ctx.stroke();
  ctx.shadowColor = "#ffe36a";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#fff6c8";
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1a120c";
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff5a1f";
  ctx.beginPath();
  ctx.arc(rad * 0.22, -rad * 0.22, Math.max(2, rad * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClogger(ctx: CanvasRenderingContext2D, s: GameState) {
  if (!s.cloggerOn) return;
  const ang = s.cloggerFacing;
  ctx.save();
  ctx.translate(s.cloggerX, s.cloggerY);
  ctx.rotate(ang);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(0, -12, 0, 12);
  body.addColorStop(0, "#e0a36a");
  body.addColorStop(0.45, "#8a4b22");
  body.addColorStop(1, "#3a2416");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 18, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c9844a";
  ctx.fillRect(-6, -12, 4, 24);
  ctx.fillRect(4, -11, 3, 22);

  ctx.fillStyle = "#2a180e";
  ctx.beginPath();
  ctx.moveTo(10, -8);
  ctx.lineTo(22, 0);
  ctx.lineTo(10, 8);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "#ff9a3c";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#ffb15a";
  ctx.beginPath();
  ctx.arc(6, -4, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, s: GameState) {
  const theme = paletteFor(s.level);
  const { w, h, cell, cols, rows, surfaceRow } = s.world;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (!s.reduced && s.shake > 0) {
    const m = s.shake * 8;
    const jx = Math.sin(s.clock * 47) * m;
    const jy = Math.cos(s.clock * 39) * m;
    ctx.translate(jx, jy);
  }

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);
  syncPlate(s, theme);
  if (plate) ctx.drawImage(plate, 0, 0);

  for (let i = 0; i < 36; i++) {
    const sx = hash(i, 2) * w;
    const sy = hash(i, 9) * surfaceRow * cell * 0.92;
    const tw = 0.35 + Math.sin(s.clock * 2 + i) * 0.25;
    ctx.globalAlpha = Math.max(0.15, tw);
    ctx.fillStyle = theme.glow;
    ctx.fillRect(sx, sy, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;

  const surfaceY = surfaceRow * cell;

  for (let r = surfaceRow; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const id = s.cells[i];
      const x = c * cell;
      const y = r * cell;
      if (id === Cell.Sky || id === Cell.Crust) continue;

      if (id === Cell.Dirt || id === Cell.Tunnel || id === Cell.Loose) {
        if (id === Cell.Loose || s.crack[i] > 0) drawCracks(ctx, x, y, cell, hash(c, r));
        continue;
      }

      if (id === Cell.Water) {
        const wave = Math.sin(s.clock * 3 + c * 0.7 + r) * 2;
        const g = ctx.createLinearGradient(x, y, x, y + cell);
        g.addColorStop(0, "#083044");
        g.addColorStop(1, "#0a6a8a");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cell, cell);
        ctx.fillStyle = "rgba(126, 230, 255, 0.35)";
        ctx.fillRect(x, y + cell * 0.35 + wave, cell, 3);
      } else if (id === Cell.Rock || id === Cell.Wall) {
        const built = id === Cell.Wall;
        ctx.fillStyle = built ? "#1a120c" : "#2c333c";
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        if (built) {
          ctx.fillStyle = "#8a5a32";
          ctx.fillRect(x + 2, y + cell * 0.22, cell - 4, 3);
          ctx.fillRect(x + 2, y + cell * 0.62, cell - 4, 3);
          ctx.fillStyle = "#c9844a";
          ctx.fillRect(x + 3, y + 3, 4, 4);
        } else {
          ctx.fillStyle = "#8b97a8";
          ctx.beginPath();
          ctx.moveTo(x + 4, y + cell - 5);
          ctx.lineTo(x + cell * 0.45, y + 5);
          ctx.lineTo(x + cell - 5, y + cell * 0.42);
          ctx.closePath();
          ctx.fill();
        }
      } else if (id === Cell.Exit) {
        if (s.intro && (s.mode === "menu" || s.mode === "countdown")) continue;
        const pulse = 0.55 + Math.sin(s.clock * 5) * 0.45;
        const g = ctx.createRadialGradient(x + cell / 2, y + cell / 2, 2, x + cell / 2, y + cell / 2, cell * 0.7);
        g.addColorStop(0, `rgba(186, 246, 255, ${0.85 * pulse})`);
        g.addColorStop(1, "rgba(62, 203, 255, 0.05)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else if (id === Cell.Hazard) {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const s = cell * 0.4;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = "#ff1a1a";
        ctx.strokeStyle = "#fff6f6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.92, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.92, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillRect(-1.7, -s * 0.48, 3.4, s * 0.52);
        ctx.beginPath();
        ctx.arc(0, s * 0.28, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (id === Cell.Falling) {
        const drop = (1 - Math.max(0, s.fallT[i]) / 0.32) * cell * 0.45;
        ctx.fillStyle = "#3a2e24";
        ctx.fillRect(x + 2, y + drop, cell - 4, cell * 0.55);
        ctx.fillStyle = "#6a5848";
        ctx.fillRect(x + 6, y + drop + 4, cell * 0.3, 4);
      }

      if (s.crack[i] > 0 && id !== Cell.Loose && id !== Cell.Dirt && id !== Cell.Tunnel) {
        drawCracks(ctx, x, y, cell, hash(c, r));
      }
    }
  }

  ctx.fillStyle = theme.glow;
  ctx.fillRect(0, surfaceY, w, 2);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, surfaceY + 2, w, 5);
  ctx.globalAlpha = 1;

  for (const p of s.particles) {
    if (p.life <= 0) continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.kind === 1 ? "#7ae7ff" : "#8a5a32";
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  drawBonus(ctx, s);

  const face = faceAmount(s);
  if (face < 0.22) {
    ctx.save();
    ctx.globalAlpha = 1 - face / 0.22;
    drawWorm(ctx, s, theme);
    ctx.restore();
  }
  if (face > 0.02) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, face + 0.15);
    drawReadyWorm(ctx, s, theme, face);
    ctx.restore();
  }
  drawClogger(ctx, s);
  drawShot(ctx, s);

  if (s.ballFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.ballFlash);
    ctx.fillStyle = "#1a120c";
    ctx.fillRect(w * 0.12, surfaceRow * cell + cell * 3.2, w * 0.76, 36);
    ctx.strokeStyle = "#ffe36a";
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.12, surfaceRow * cell + cell * 3.2, w * 0.76, 36);
    ctx.fillStyle = "#ffe36a";
    ctx.font = "700 15px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.ballNote || "CANNONBALL EARNED", w / 2, surfaceRow * cell + cell * 3.2 + 18);
    ctx.restore();
  }

  const opening = s.intro && (s.mode === "menu" || s.mode === "countdown");
  if (!opening && !s.bonus) {
  const ex = s.exitC * cell + cell / 2;
  const ey = s.exitR * cell + cell / 2;
  const pulse = 0.55 + Math.sin(s.clock * 4) * 0.45;
  ctx.save();
  ctx.strokeStyle = theme.glow;
  ctx.globalAlpha = 0.75 + pulse * 0.25;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ex, ey, cell * (1.05 + pulse * 0.25), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = theme.glow;
  ctx.globalAlpha = 0.2;
  ctx.fillRect(ex - 2, s.world.surfaceRow * cell, 4, ey - s.world.surfaceRow * cell);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.wormHi;
  ctx.font = "700 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("EXIT", ex, ey - cell * 1.25);
  ctx.restore();
  }

  if (s.flash > 0) {
    ctx.fillStyle = `rgba(62, 203, 255, ${s.flash * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}
