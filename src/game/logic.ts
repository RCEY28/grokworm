import { sfxBoom, sfxClear, sfxCountdown, sfxEat, sfxEnter, sfxGo, sfxHurt, sfxOver, sfxShot } from "@/game/audio";
import {
  BEST_KEY,
  Cell,
  RULES,
  type CellId,
  type GameState,
  type Particle,
  type Gem,
  type Snap,
  type World,
} from "@/game/types";

export function measureWorld(rect: { width: number; height: number }): World {
  const shortest = Math.min(Math.max(rect.width, 1), Math.max(rect.height, 1));
  const cell = shortest < 520 ? 22 : shortest < 900 ? 28 : 34;
  const cols = Math.max(14, Math.floor(rect.width / cell));
  const rows = Math.max(11, Math.floor(rect.height / cell));
  const surfaceRow = 2;
  return {
    cell,
    cols,
    rows,
    surfaceRow,
    w: cols * cell,
    h: rows * cell,
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadBest() {
  try {
    const n = Number(localStorage.getItem(BEST_KEY) || 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function awardLevelBall(state: GameState) {
  state.balls += 1;
  state.toast = "Cannonball earned";
  state.toastT = 2;
  state.ballNote = "CANNONBALL EARNED";
  state.ballFlash = 2;
}

function commitBest(state: GameState) {
  if (state.score > state.best) state.best = state.score;
  try {
    localStorage.setItem(BEST_KEY, String(state.best));
  } catch {
    /* private mode */
  }
}

export function levelTime(level: number) {
  return Math.max(RULES.minTime, RULES.baseTime - (level - 1) * RULES.timeStep);
}

function at(state: GameState, c: number, r: number) {
  return state.cells[r * state.world.cols + c] as CellId;
}

function setCell(state: GameState, c: number, r: number, id: CellId) {
  state.cells[r * state.world.cols + c] = id;
}

export function inside(world: World, c: number, r: number) {
  return c >= 0 && r >= 0 && c < world.cols && r < world.rows;
}

function isProtected(world: World, c: number, r: number, homeC: number) {
  if (r <= world.surfaceRow) return true;
  return c >= homeC - 2 && c <= homeC + 4 && r >= world.surfaceRow + 2 && r <= world.surfaceRow + 4;
}

function homeCol(world: World) {
  return Math.max(2, Math.min(world.cols - 8, Math.floor(world.cols * 0.2)));
}

let boreSerial = 1;

function resetBores(state: GameState) {
  state.boreX.length = 0;
  state.boreY.length = 0;
  state.boreGen = boreSerial++;
}

function stampBore(state: GameState, x: number, y: number) {
  const n = state.boreX.length;
  if (n > 0) {
    const dx = x - state.boreX[n - 1];
    const dy = y - state.boreY[n - 1];
    if (dx * dx + dy * dy < 9) return;
  }
  state.boreX.push(x);
  state.boreY.push(y);
}

function eatAt(state: GameState, c: number, r: number, award: boolean) {
  if (!inside(state.world, c, r)) return;
  if (r <= state.world.surfaceRow) return;
  const id = at(state, c, r);
  if (id !== Cell.Dirt && id !== Cell.Loose) return;
  setCell(state, c, r, Cell.Tunnel);
  if (!award) {
    if (id === Cell.Loose) scheduleCave(state, c, r);
    return;
  }
  state.eaten += 1;
  state.score += RULES.pointsPerDirt;
  state.segCount = Math.min(
    RULES.maxSegments,
    RULES.baseSegments + Math.floor(state.eaten / RULES.growEvery),
  );
  const { cell } = state.world;
  spawn(state, c * cell + cell / 2, r * cell + cell / 2, 0, 3);
  if (state.sfxEat <= 0) {
    sfxEat();
    state.sfxEat = 0.05;
  }
  if (id === Cell.Loose) scheduleCave(state, c, r);
}

function bite(state: GameState, x: number, y: number, award: boolean) {
  stampBore(state, x, y);
  const { cell } = state.world;
  const reach = RULES.bodyRadius + 3;
  const c0 = Math.floor(x / cell);
  const r0 = Math.floor(y / cell);
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (!inside(state.world, c, r)) continue;
      const x0 = c * cell;
      const y0 = r * cell;
      const nx = Math.max(x0, Math.min(x, x0 + cell));
      const ny = Math.max(y0, Math.min(y, y0 + cell));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy > reach * reach) continue;
      eatAt(state, c, r, award);
    }
  }
}

function exitZone(state: GameState, c: number, r: number) {
  return Math.abs(c - state.exitC) <= 1 && Math.abs(r - state.exitR) <= 1;
}

export function layTrail(state: GameState, count = state.segCount) {
  state.trailX.length = 0;
  state.trailY.length = 0;
  const back = state.facing + Math.PI;
  const n = Math.max(0, Math.min(state.segCount, count));
  for (let i = 0; i < n; i++) {
    const d = (i + 1) * RULES.spacing;
    state.trailX.push(state.x + Math.cos(back) * d);
    state.trailY.push(state.y + Math.sin(back) * d);
  }
}

function homePose(state: GameState) {
  const { cell, surfaceRow } = state.world;
  const x = homeCol(state.world) * cell + cell / 2;
  const y = Math.min((state.world.rows - 4) * cell, (surfaceRow + 10) * cell);
  const exitX = state.exitC * cell + cell / 2;
  const exitY = state.exitR * cell + cell / 2;
  return { x, y, facing: Math.atan2(exitY - y, exitX - x) };
}

function layEntryTrail(state: GameState, shown: number) {
  const home = homePose(state);
  const back = home.facing + Math.PI;
  state.trailX.length = 0;
  state.trailY.length = 0;
  const n = Math.max(1, Math.min(state.segCount, shown));
  for (let i = 0; i < n; i++) {
    const d = (i + 1) * RULES.spacing;
    const hx = home.x - state.x;
    const hy = home.y - state.y;
    const hlen = Math.hypot(hx, hy);
    if (d < hlen) {
      const t = d / hlen;
      state.trailX.push(state.x + hx * t);
      state.trailY.push(state.y + hy * t);
    } else {
      const rest = d - hlen;
      state.trailX.push(home.x + Math.cos(back) * rest);
      state.trailY.push(home.y + Math.sin(back) * rest);
    }
  }
}

function stickCovers(world: World, c: number, r: number) {
  const x = c * world.cell + world.cell / 2;
  const y = r * world.cell + world.cell / 2;
  return y > world.h - 190 && Math.abs(x - world.w / 2) < 108;
}

function clearObstacle(state: GameState, c: number, r: number) {
  if (!inside(state.world, c, r) || r <= state.world.surfaceRow) return;
  const id = at(state, c, r);
  if (
    id === Cell.Hazard ||
    id === Cell.Water ||
    id === Cell.Rock ||
    id === Cell.Loose ||
    id === Cell.Falling ||
    id === Cell.Wall
  ) {
    setCell(state, c, r, Cell.Dirt);
  }
}

function clearDisk(state: GameState, c: number, r: number, rad: number) {
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y > rad * rad + 0.2) continue;
      clearObstacle(state, c + x, r + y);
    }
  }
}

function clearSpawn(state: GameState) {
  const { cell } = state.world;
  const c = Math.floor(state.x / cell);
  const r = Math.floor(state.y / cell);
  clearDisk(state, c, r, 3);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const along = i * cell * 0.85;
    const fx = state.x + Math.cos(state.facing) * along;
    const fy = state.y + Math.sin(state.facing) * along;
    clearDisk(state, Math.floor(fx / cell), Math.floor(fy / cell), 2);
    clearDisk(state, c, Math.floor((state.y + along) / cell), 2);
  }
}

function clearOpening(state: GameState) {
  const { cell, surfaceRow, w } = state.world;
  const x = Math.max(cell * 1.4, w * 0.16);
  const y = (surfaceRow + 2.55) * cell;
  const c = Math.floor(x / cell);
  for (let i = 0; i <= 9; i++) {
    const rr = Math.floor((y + i * cell * 0.8) / cell);
    clearDisk(state, c, rr, 2);
    clearDisk(state, c - 1, rr, 1);
    clearDisk(state, c + 1, rr, 1);
  }
}

function sweepStick(state: GameState) {
  const { cols, rows } = state.world;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (stickCovers(state.world, c, r)) clearObstacle(state, c, r);
    }
  }
}

function placeWorm(state: GameState) {
  const { cell, surfaceRow } = state.world;
  const c = homeCol(state.world);
  state.x = c * cell + cell / 2;
  state.y = Math.min((state.world.rows - 4) * cell, (surfaceRow + 10) * cell);
  const exitX = state.exitC * cell + cell / 2;
  const exitY = state.exitR * cell + cell / 2;
  state.facing = Math.atan2(exitY - state.y, exitX - state.x);
  state.dirX = Math.cos(state.facing);
  state.dirY = Math.sin(state.facing);
  state.segCount = Math.min(
    RULES.maxSegments,
    RULES.baseSegments + Math.floor(state.eaten / RULES.growEvery),
  );
  layTrail(state);
  if (!state.intro) bite(state, state.x, state.y, false);
}

function paint(state: GameState, c: number, r: number, id: CellId, rad: number) {
  const world = state.world;
  const home = homeCol(world);
  let n = 0;
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y > rad * rad + 0.1) continue;
      const cc = c + x;
      const rr = r + y;
      if (!inside(world, cc, rr)) continue;
      if (isProtected(world, cc, rr, home)) continue;
      if (stickCovers(world, cc, rr)) continue;
      const cur = at(state, cc, rr);
      if (cur !== Cell.Dirt && cur !== Cell.Loose) continue;
      setCell(state, cc, rr, id);
      n++;
    }
  }
  return n;
}

function generate(state: GameState) {
  const world = state.world;
  const n = world.cols * world.rows;
  state.cells = new Uint8Array(n);
  state.crack = new Float32Array(n);
  state.fallT = new Float32Array(n);
  for (let r = 0; r < world.rows; r++) {
    for (let c = 0; c < world.cols; c++) {
      let id: CellId = Cell.Dirt;
      if (r < world.surfaceRow) id = Cell.Sky;
      else if (r === world.surfaceRow) id = Cell.Crust;
      state.cells[r * world.cols + c] = id;
    }
  }
  resetBores(state);

  const rng = mulberry32(9000 + state.level * 131);
  const spot = (fx: number, fy: number) => ({
    c: Math.floor(fx * (world.cols - 1)),
    r: Math.max(world.surfaceRow + 2, Math.floor(fy * (world.rows - 1))),
  });

  const lessons: Array<{ fx: number; fy: number; id: CellId; rad: number }> = [
    { fx: 0.72, fy: 0.42, id: Cell.Water, rad: 1 },
    { fx: 0.46, fy: 0.62, id: Cell.Rock, rad: 1 },
    { fx: 0.84, fy: 0.72, id: Cell.Hazard, rad: 0 },
  ];
  for (const lesson of lessons) {
    const p = spot(lesson.fx, lesson.fy);
    paint(state, p.c, p.r, lesson.id, lesson.rad);
  }

  const loose = spot(0.6, 0.36);
  for (let i = 0; i < 4; i++) {
    paint(state, loose.c, loose.r + i, Cell.Loose, 0);
  }

  const extra = state.level - 1;
  for (let i = 0; i < 2 + extra; i++) {
    paint(
      state,
      2 + Math.floor(rng() * (world.cols - 4)),
      world.surfaceRow + 2 + Math.floor(rng() * Math.max(1, world.rows - world.surfaceRow - 3)),
      Cell.Water,
      1,
    );
  }
  for (let i = 0; i < 3 + extra; i++) {
    paint(
      state,
      2 + Math.floor(rng() * (world.cols - 4)),
      world.surfaceRow + 3 + Math.floor(rng() * Math.max(1, world.rows - world.surfaceRow - 4)),
      Cell.Rock,
      rng() > 0.5 ? 1 : 0,
    );
  }
  for (let i = 0; i < 4 + extra * 2; i++) {
    paint(
      state,
      2 + Math.floor(rng() * (world.cols - 4)),
      world.surfaceRow + 2 + Math.floor(rng() * Math.max(1, world.rows - world.surfaceRow - 3)),
      Cell.Loose,
      0,
    );
  }
  for (let i = 0; i < 2 + extra; i++) {
    paint(
      state,
      2 + Math.floor(rng() * (world.cols - 4)),
      world.surfaceRow + 4 + Math.floor(rng() * Math.max(1, world.rows - world.surfaceRow - 5)),
      Cell.Hazard,
      0,
    );
  }

  placeExit(state);
  sweepStick(state);
  clearOpening(state);
  state.cloggerOn = false;
  state.cloggerEnter = Math.max(1.1, 2.4 - (state.level - 1) * 0.15);
  state.cloggerX = 0;
  state.cloggerY = 0;
  state.cloggerFacing = Math.PI;
  state.cloggerTurn = 0.5;
  state.timeLeft = levelTime(state.level);
}

function placeExit(state: GameState) {
  const world = state.world;
  const span = Math.max(1, world.rows - world.surfaceRow - 6);
  const r = world.surfaceRow + 4 + ((state.level * 3) % span);
  state.exitC = Math.max(homeCol(world) + 6, world.cols - 3);
  state.exitR = Math.min(world.rows - 2, r);
  setCell(state, state.exitC, state.exitR, Cell.Exit);
}

function spawn(state: GameState, x: number, y: number, kind: number, count: number) {
  for (let i = 0; i < count; i++) {
    let p: Particle | undefined = state.particles.find((q) => q.life <= 0);
    if (!p) {
      if (state.particles.length > 140) return;
      p = { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, kind: 0 };
      state.particles.push(p);
    }
    const a = Math.random() * Math.PI * 2;
    const s = 24 + Math.random() * 80;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s - 16;
    p.life = p.max = 0.28 + Math.random() * 0.28;
    p.size = 1.4 + Math.random() * 2;
    p.kind = kind;
  }
}

function scheduleCave(state: GameState, c: number, r: number) {
  const { cols, surfaceRow } = state.world;
  for (let rr = r; rr > surfaceRow; rr--) {
    const i = rr * cols + c;
    const id = state.cells[i];
    if (id === Cell.Rock || id === Cell.Wall || id === Cell.Water || id === Cell.Hazard || id === Cell.Crust || id === Cell.Sky || id === Cell.Exit) {
      break;
    }
    if (state.crack[i] <= 0) state.crack[i] = RULES.caveDelay;
  }
  if (!state.reduced) state.shake = Math.max(state.shake, 0.16);
}

function eatAround(state: GameState) {
  bite(state, state.x, state.y, true);
}

function cellAt(state: GameState, x: number, y: number): CellId | -1 {
  const { cell, cols, rows } = state.world;
  const c = Math.floor(x / cell);
  const r = Math.floor(y / cell);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
  return state.cells[r * cols + c] as CellId;
}

function hitsSolid(state: GameState, x: number, y: number) {
  const probe = 9;
  const pts = [
    [0, 0],
    [probe, 0],
    [-probe, 0],
    [0, probe],
    [0, -probe],
  ];
  for (const [ox, oy] of pts) {
    const px = x + ox;
    const py = y + oy;
    const id = cellAt(state, px, py);
    if (id === -1 || id === Cell.Sky || id === Cell.Crust || id === Cell.Rock || id === Cell.Wall) return true;
    if (cloggerBlocks(state, px, py)) return true;
  }
  return false;
}

function cloggerBlocks(state: GameState, x: number, y: number) {
  if (!state.cloggerOn) return false;
  const dx = x - state.cloggerX;
  const dy = y - state.cloggerY;
  return dx * dx + dy * dy < 15 * 15;
}

function deadlyReason(state: GameState, x: number, y: number) {
  const probe = 8;
  const pts = [
    [0, 0],
    [probe, 0],
    [-probe, 0],
    [0, probe],
    [0, -probe],
  ];
  for (const [ox, oy] of pts) {
    const id = cellAt(state, x + ox, y + oy);
    if (id === Cell.Water) return "Water flooded the bore.";
    if (id === Cell.Hazard) return "A buried obstacle crushed Grokworm.";
    if (id === Cell.Falling) return "The earth caved in.";
  }
  return "";
}

function hurtKind(reason: string): "water" | "cave" | "hit" {
  if (reason.startsWith("Water")) return "water";
  if (reason.startsWith("The earth")) return "cave";
  return "hit";
}

function findOpen(state: GameState) {
  const { cols, rows, surfaceRow, cell } = state.world;
  const preferC = homeCol(state.world);
  const preferR = surfaceRow + 3;
  if (inside(state.world, preferC, preferR) && at(state, preferC, preferR) === Cell.Tunnel) {
    return { x: preferC * cell + cell / 2, y: preferR * cell };
  }
  for (let r = surfaceRow + 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (at(state, c, r) === Cell.Tunnel) {
        return { x: c * cell + cell / 2, y: r * cell + cell / 2 };
      }
    }
  }
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const c = preferC + x;
      const r = preferR + y;
      if (!inside(state.world, c, r) || r <= surfaceRow) continue;
      setCell(state, c, r, Cell.Tunnel);
    }
  }
  return { x: preferC * cell + cell / 2, y: preferR * cell };
}

function respawn(state: GameState) {
  const p = findOpen(state);
  state.x = p.x;
  state.y = p.y;
  const { cell } = state.world;
  const exitX = state.exitC * cell + cell / 2;
  const exitY = state.exitR * cell + cell / 2;
  state.facing = Math.atan2(exitY - state.y, exitX - state.x);
  state.dirX = Math.cos(state.facing);
  state.dirY = Math.sin(state.facing);
  layTrail(state);
}

function hurt(state: GameState, reason: string) {
  if (state.invuln > 0 || state.mode !== "play") return;
  state.lives -= 1;
  state.invuln = RULES.invuln;
  state.toast = reason;
  state.toastT = 1.8;
  state.flash = 0.28;
  if (!state.reduced) state.shake = Math.max(state.shake, 0.42);
  sfxHurt(hurtKind(reason));
  if (state.lives <= 0) {
    state.mode = "over";
    state.overReason = reason;
    commitBest(state);
    sfxOver();
    return;
  }
  respawn(state);
  state.mode = "countdown";
  state.countdown = 3;
  state.countdownShown = 0;
}

function winLevel(state: GameState) {
  state.timeBonus = Math.ceil(state.timeLeft) * RULES.timeBonusPerSecond;
  state.score += state.timeBonus;
  awardLevelBall(state);
  state.mode = "clear";
  commitBest(state);
  sfxClear();
}

function timeout(state: GameState) {
  state.timeLeft = 0;
  state.mode = "over";
  state.overReason = "Time ran out before the exit.";
  commitBest(state);
  sfxOver();
}

export function exitToMenu(state: GameState) {
  state.level = 1;
  state.score = 0;
  state.eaten = 0;
  state.lives = RULES.lives;
  state.timeLeft = levelTime(1);
  state.invuln = 0;
  state.mode = "menu";
  state.toast = "";
  state.toastT = 0;
  state.overReason = "";
  state.countdown = 0;
  state.countdownShown = 0;
  state.timeBonus = 0;
  state.shake = 0;
  state.flash = 0;
  state.segCount = RULES.baseSegments;
  state.particles.length = 0;
  state.cloggerOn = false;
  state.intro = true;
  state.dive = 0;
  state.bonus = false;
  state.gems = [];
  state.gemsGot = 0;
  state.chain = 0;
  state.chainT = 0;
  state.balls = 1;
  state.ballsGranted = 0;
  state.ballFlash = 0;
  state.ballNote = "";
  state.shot = null;
  generate(state);
  placeWorm(state);
}

function pushTrail(state: GameState) {
  const lastX = state.trailX[0];
  const lastY = state.trailY[0];
  if (lastX === undefined || lastY === undefined) {
    layTrail(state);
    return;
  }
  const dx = state.x - lastX;
  const dy = state.y - lastY;
  if (dx * dx + dy * dy < RULES.spacing * RULES.spacing) return;
  state.trailX.unshift(state.x);
  state.trailY.unshift(state.y);
  while (state.trailX.length > state.segCount) {
    state.trailX.pop();
    state.trailY.pop();
  }
}

function updateParticles(state: GameState, dt: number) {
  for (const p of state.particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
  }
}

function updateGeology(state: GameState, dt: number) {
  const n = state.cells.length;
  for (let i = 0; i < n; i++) {
    if (state.crack[i] > 0) {
      state.crack[i] -= dt;
      if (state.crack[i] <= 0) {
        state.crack[i] = 0;
        const id = state.cells[i];
        if (id === Cell.Dirt || id === Cell.Loose || id === Cell.Tunnel) {
          state.cells[i] = Cell.Falling;
          state.fallT[i] = RULES.fallTime;
        }
      }
    }
    if (state.cells[i] === Cell.Falling) {
      state.fallT[i] -= dt;
      if (state.fallT[i] <= 0) {
        const { cell, cols } = state.world;
        const c = i % cols;
        const r = Math.floor(i / cols);
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        const dx = state.x - cx;
        const dy = state.y - cy;
        if (dx * dx + dy * dy < (cell * 0.55) * (cell * 0.55)) {
          hurt(state, "The earth caved in.");
        }
        state.cells[i] = Cell.Rock;
        state.fallT[i] = 0;
      }
    }
  }
}

export function createGame(world: World): GameState {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state: GameState = {
    world,
    dpr: 1,
    cells: new Uint8Array(world.cols * world.rows),
    crack: new Float32Array(world.cols * world.rows),
    fallT: new Float32Array(world.cols * world.rows),
    x: 0,
    y: 0,
    dirX: 1,
    dirY: 0,
    facing: 0,
    trailX: [],
    trailY: [],
    segCount: RULES.baseSegments,
    eaten: 0,
    score: 0,
    best: typeof window !== "undefined" ? loadBest() : 0,
    lives: RULES.lives,
    timeLeft: levelTime(1),
    level: 1,
    invuln: 0,
    mode: "menu",
    countdown: 0,
    countdownShown: 0,
    shake: 0,
    flash: 0,
    toast: "",
    toastT: 0,
    surfaceCd: 0,
    overReason: "",
    timeBonus: 0,
    clock: 0,
    sfxEat: 0,
    reduced,
    particles: [],
    exitC: 0,
    exitR: 0,
    cloggerOn: false,
    cloggerX: 0,
    cloggerY: 0,
    cloggerFacing: Math.PI,
    cloggerEnter: 2.4,
    cloggerTurn: 0.5,
    boreX: [],
    boreY: [],
    boreGen: 0,
    intro: true,
    dive: 0,
    bonus: false,
    gems: [],
    gemsGot: 0,
    chain: 0,
    chainT: 0,
    balls: 1,
    ballsGranted: 0,
    ballFlash: 0,
    ballNote: "",
    shot: null,
  };
  generate(state);
  placeWorm(state);
  return state;
}

export function startRun(state: GameState) {
  state.level = 1;
  state.score = 0;
  state.lives = RULES.lives;
  state.eaten = 0;
  state.invuln = 0;
  state.toast = "";
  state.toastT = 0;
  state.overReason = "";
  state.timeBonus = 0;
  state.shake = 0;
  state.flash = 0;
  state.segCount = RULES.baseSegments;
  state.intro = true;
  state.dive = 0;
  state.bonus = false;
  state.gems = [];
  state.gemsGot = 0;
  state.chain = 0;
  state.chainT = 0;
  state.balls = 1;
  state.ballsGranted = 0;
  state.ballFlash = 0;
  state.ballNote = "";
  state.shot = null;
  state.mode = "countdown";
  state.countdown = 3;
  state.countdownShown = 0;
  state.particles.length = 0;
  generate(state);
  placeWorm(state);
}

const GLEN: Array<[number, number]> = [
  [0.14, 0.58],
  [0.4, 0.62],
  [0.56, 0.54],
  [0.68, 0.4],
  [0.58, 0.3],
  [0.7, 0.2],
  [0.52, 0.1],
  [0.32, 0.08],
  [0.16, 0.16],
  [0.08, 0.3],
  [0.1, 0.44],
  [0.18, 0.5],
  [0.08, 0.64],
  [0.16, 0.8],
  [0.36, 0.86],
  [0.42, 0.7],
  [0.28, 0.56],
];

export function courseOf(state: GameState) {
  const { w, h, cell, surfaceRow } = state.world;
  const left = cell * 1.45;
  const right = w - cell * 1.45;
  const top = surfaceRow * cell + cell * 2.05;
  const bottom = Math.min(h - cell * 1.25, h - 188);
  const pts = GLEN.map(([nx, ny]) => ({
    x: left + nx * (right - left),
    y: top + ny * (bottom - top),
  }));
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    seg.push(d);
    total += d;
  }
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return { pts, seg, total, cx, cy };
}

export function trackFrame(state: GameState) {
  const course = courseOf(state);
  return {
    cx: course.cx,
    cy: course.cy,
    radius: 36,
    straight: course.total * 0.25,
    vertical: false,
  };
}

export function trackAt(state: GameState, turns: number) {
  const course = courseOf(state);
  let d = (((turns % 1) + 1) % 1) * course.total;
  for (let i = 0; i < course.pts.length; i++) {
    const span = course.seg[i] ?? 0;
    const a = course.pts[i];
    const b = course.pts[(i + 1) % course.pts.length];
    if (!a || !b) break;
    if (d > span && i < course.pts.length - 1) {
      d -= span;
      continue;
    }
    const t = span > 0 ? Math.min(1, d / span) : 0;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      facing: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
  const a = course.pts[0];
  return { x: a?.x ?? 0, y: a?.y ?? 0, facing: 0 };
}

function stampDisk(state: GameState, x: number, y: number, rad: number, id: CellId) {
  const { cell, cols, rows, surfaceRow } = state.world;
  const c0 = Math.floor((x - rad) / cell);
  const c1 = Math.floor((x + rad) / cell);
  const r0 = Math.floor((y - rad) / cell);
  const r1 = Math.floor((y + rad) / cell);
  const rad2 = rad * rad;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= cols || r <= surfaceRow || r >= rows) continue;
      const cx = c * cell + cell / 2;
      const cy = r * cell + cell / 2;
      const dx = cx - x;
      const dy = cy - y;
      if (dx * dx + dy * dy <= rad2) setCell(state, c, r, id);
    }
  }
}

function generateBonus(state: GameState) {
  const world = state.world;
  const n = world.cols * world.rows;
  state.cells = new Uint8Array(n);
  state.crack = new Float32Array(n);
  state.fallT = new Float32Array(n);
  for (let r = 0; r < world.rows; r++) {
    for (let c = 0; c < world.cols; c++) {
      let id: CellId = Cell.Rock;
      if (r < world.surfaceRow) id = Cell.Sky;
      else if (r === world.surfaceRow) id = Cell.Crust;
      state.cells[r * world.cols + c] = id;
    }
  }
  const lane = Math.max(36, world.cell * 1.65);
  const rad = lane * 0.48;
  for (let i = 0; i < 280; i++) {
    const p = trackAt(state, i / 180);
    stampDisk(state, p.x, p.y, rad, Cell.Tunnel);
  }
  const gems: Gem[] = [];
  const total = 12;
  for (let i = 0; i < total; i++) {
    const p = trackAt(state, (i + 0.42) / total);
    gems.push({ x: p.x, y: p.y, got: false, boost: i % 4 === 3 });
  }
  state.gems = gems;
  state.gemsGot = 0;
  state.exitC = 0;
  state.exitR = world.surfaceRow;
  resetBores(state);
  state.cloggerOn = false;
}

function placeOnTrack(state: GameState) {
  const start = trackAt(state, 0);
  state.x = start.x;
  state.y = start.y;
  state.facing = start.facing;
  state.dirX = Math.cos(start.facing);
  state.dirY = Math.sin(start.facing);
  state.segCount = RULES.baseSegments;
  state.trailX = [];
  state.trailY = [];
  const lap = Math.max(240, courseOf(state).total);
  for (let i = 1; i <= state.segCount; i++) {
    const q = trackAt(state, -(i * RULES.spacing) / Math.max(240, lap));
    state.trailX.push(q.x);
    state.trailY.push(q.y);
  }
}

function startBonus(state: GameState) {
  state.bonus = true;
  state.intro = false;
  state.dive = 0;
  state.invuln = 0;
  state.eaten = 0;
  state.toast = "Bonus Round. Stay on the track and grab the prizes.";
  state.toastT = 2.6;
  state.timeBonus = 0;
  state.shake = 0;
  state.flash = 0;
  state.chain = 0;
  state.chainT = 0;
  state.particles.length = 0;
  state.cloggerOn = false;
  generateBonus(state);
  placeOnTrack(state);
  state.timeLeft = 26;
  state.mode = "countdown";
  state.countdown = 3;
  state.countdownShown = 0;
}

function finishBonus(state: GameState) {
  if (state.mode !== "play") return;
  const total = state.gems.length;
  if (state.gemsGot >= total && total > 0) {
    state.score += 500;
    state.timeBonus = 500;
  } else {
    state.timeBonus = 0;
  }
  state.mode = "clear";
  commitBest(state);
  sfxClear();
}

function collectGems(state: GameState) {
  const reach = 20;
  for (const gem of state.gems) {
    if (gem.got) continue;
    const dx = gem.x - state.x;
    const dy = gem.y - state.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    gem.got = true;
    state.gemsGot += 1;
    state.chain = state.chainT > 0 ? Math.min(5, state.chain + 1) : 1;
    state.chainT = 1.35;
    const points = (gem.boost ? 250 : 100) * state.chain;
    state.score += points;
    state.toast = gem.boost ? `Boost x${state.chain}` : `Bonus x${state.chain}`;
    state.toastT = 0.8;
    spawn(state, gem.x, gem.y, 1, gem.boost ? 10 : 6);
    sfxEat();
  }
}

export function advanceLevel(state: GameState) {
  if (state.bonus) {
    state.bonus = false;
    state.gems = [];
    state.gemsGot = 0;
    state.chain = 0;
    state.chainT = 0;
  } else if (state.level % 5 === 0) {
    startBonus(state);
    return;
  }
  state.level += 1;
  state.eaten = 0;
  state.invuln = 0;
  state.toast = "";
  state.toastT = 0;
  state.timeBonus = 0;
  state.shake = 0;
  state.intro = false;
  state.dive = 0;
  state.mode = "countdown";
  state.countdown = 3;
  state.countdownShown = 0;
  state.segCount = RULES.baseSegments;
  state.particles.length = 0;
  generate(state);
  placeWorm(state);
}

function moveToward(current: number, target: number, dt: number) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * Math.min(1, dt * RULES.steer);
}

function steer(state: GameState, dt: number, stick: { x: number; y: number }) {
  const mag = Math.hypot(stick.x, stick.y);
  if (mag < 0.18) return;
  const aim = Math.atan2(stick.y, stick.x);
  state.facing = moveToward(state.facing, aim, dt * Math.min(1, mag) * (state.bonus ? 1.4 : 1));
  state.dirX = Math.cos(state.facing);
  state.dirY = Math.sin(state.facing);
}

function layWall(state: GameState) {
  const { cell, surfaceRow } = state.world;
  const c = Math.floor(state.cloggerX / cell);
  const r = Math.floor(state.cloggerY / cell);
  if (!inside(state.world, c, r) || r <= surfaceRow) return;
  if (stickCovers(state.world, c, r)) return;
  if (isProtected(state.world, c, r, homeCol(state.world))) return;
  if (exitZone(state, c, r)) return;
  const dx = state.x - (c * cell + cell / 2);
  const dy = state.y - (r * cell + cell / 2);
  if (dx * dx + dy * dy < cell * cell) return;
  const id = at(state, c, r);
  if (id === Cell.Dirt || id === Cell.Loose || id === Cell.Tunnel) setCell(state, c, r, Cell.Wall);
}

function updateClogger(state: GameState, dt: number) {
  if (!state.cloggerOn) {
    state.cloggerEnter -= dt;
    if (state.cloggerEnter > 0) return;
    const { cell, cols, surfaceRow, rows } = state.world;
    let c = Math.max(2, cols - 2);
    let r = Math.min(rows - 2, surfaceRow + 2);
    if (exitZone(state, c, r)) r = Math.min(rows - 2, state.exitR + 3);
    state.cloggerOn = true;
    state.cloggerX = c * cell + cell / 2;
    state.cloggerY = r * cell + cell / 2;
    state.cloggerFacing = Math.PI * 0.75;
    state.cloggerTurn = 0.35;
    state.toast = "A clogger broke through. The wall it lays is solid.";
    state.toastT = 2.4;
    sfxEnter();
    return;
  }

  const { cell, surfaceRow, w, h } = state.world;
  const exitX = state.exitC * cell + cell / 2;
  const exitY = state.exitR * cell + cell / 2;
  state.cloggerTurn -= dt;
  if (state.cloggerTurn <= 0) {
    state.cloggerTurn = 0.65 + Math.random() * 0.7;
    const midX = (state.x + exitX) / 2;
    const midY = (state.y + exitY) / 2;
    const awayX = state.cloggerX - state.x;
    const awayY = state.cloggerY - state.y;
    const near = awayX * awayX + awayY * awayY < cell * cell * 10;
    const aim = near
      ? Math.atan2(awayY, awayX)
      : Math.atan2(midY - state.cloggerY, midX - state.cloggerX);
    state.cloggerFacing = aim + (Math.random() - 0.5) * 0.9;
  }

  const speed = RULES.cloggerSpeed + (state.level - 1) * 8;
  let nx = state.cloggerX + Math.cos(state.cloggerFacing) * speed * dt;
  let ny = state.cloggerY + Math.sin(state.cloggerFacing) * speed * dt;
  const minY = (surfaceRow + 1) * cell + 12;
  const maxY = h - 12;
  const minX = 12;
  const maxX = w - 12;
  const nc = Math.floor(nx / cell);
  const nr = Math.floor(ny / cell);
  if (nx < minX || nx > maxX || exitZone(state, nc, nr)) {
    state.cloggerFacing = Math.PI - state.cloggerFacing;
    nx = state.cloggerX;
  }
  if (ny < minY || ny > maxY) {
    state.cloggerFacing = -state.cloggerFacing;
    ny = state.cloggerY;
  }
  const id = cellAt(state, nx, ny);
  if (id === Cell.Water || id === Cell.Hazard || id === Cell.Crust || id === Cell.Sky) {
    state.cloggerFacing += 1.3;
    return;
  }
  state.cloggerX = nx;
  state.cloggerY = ny;
  layWall(state);
}

function reachedExit(state: GameState) {
  const { cell } = state.world;
  const cx = state.exitC * cell + cell / 2;
  const cy = state.exitR * cell + cell / 2;
  const dx = state.x - cx;
  const dy = state.y - cy;
  return dx * dx + dy * dy < cell * 0.62 * (cell * 0.62);
}

function rectDist(x: number, y: number, rx: number, ry: number, rw: number, rh: number) {
  const cx = Math.max(rx, Math.min(x, rx + rw));
  const cy = Math.max(ry, Math.min(y, ry + rh));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy;
}

function openPath(state: GameState, c: number, r: number) {
  const { cols } = state.world;
  const i = r * cols + c;
  state.cells[i] = Cell.Tunnel;
  state.crack[i] = 0;
  state.fallT[i] = 0;
}

function carve(state: GameState, x0: number, y0: number, x1: number, y1: number) {
  const { cell, cols, rows, surfaceRow } = state.world;
  const radius = RULES.bodyRadius;
  const reach2 = radius * radius;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const c0 = Math.floor(x / cell);
    const r0 = Math.floor(y / cell);
    let blocked = false;
    for (let rr = r0 - 2; rr <= r0 + 2; rr++) {
      for (let cc = c0 - 2; cc <= c0 + 2; cc++) {
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        if (rectDist(x, y, cc * cell, rr * cell, cell, cell) > reach2) continue;
        if (rr <= surfaceRow) {
          blocked = true;
          continue;
        }
        const id = at(state, cc, rr);
        if (id === Cell.Rock) blocked = true;
        else if (
          id === Cell.Wall ||
          id === Cell.Water ||
          id === Cell.Hazard ||
          id === Cell.Falling ||
          id === Cell.Dirt ||
          id === Cell.Loose
        ) {
          openPath(state, cc, rr);
          spawn(state, cc * cell + cell / 2, rr * cell + cell / 2, 1, 3);
        }
      }
    }
    if (blocked) {
      spawn(state, x, y, 1, 8);
      sfxBoom();
      return true;
    }
  }
  return false;
}

function updateShot(state: GameState, dt: number) {
  const shot = state.shot;
  if (!shot) return;
  shot.life -= dt;
  const nx = shot.x + shot.vx * dt;
  const ny = shot.y + shot.vy * dt;
  shot.flown += Math.hypot(shot.vx * dt, shot.vy * dt);
  const { w, h } = state.world;
  if (carve(state, shot.x, shot.y, nx, ny)) {
    state.shot = null;
    return;
  }
  if (shot.life <= 0 || nx < 8 || ny < 8 || nx > w - 8 || ny > h - 8) {
    state.shot = null;
    return;
  }
  shot.x = nx;
  shot.y = ny;
}

export function fireCannon(state: GameState) {
  if (state.mode !== "play" || state.shot) return false;
  if (state.balls <= 0) {
    state.toast = "No cannonball";
    state.toastT = 1.2;
    state.ballNote = "NO CANNONBALL";
    state.ballFlash = 1.15;
    return false;
  }
  state.balls -= 1;
  const muzzle = RULES.bodyRadius + 10;
  const face = state.facing;
  state.shot = {
    x: state.x + Math.cos(face) * muzzle,
    y: state.y + Math.sin(face) * muzzle,
    vx: Math.cos(face) * RULES.ballSpeed,
    vy: Math.sin(face) * RULES.ballSpeed,
    life: 1.35,
    flown: 0,
  };
  sfxShot();
  return true;
}

export function step(state: GameState, dt: number, stick: { x: number; y: number }) {
  state.clock += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.5);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
  if (state.toastT > 0) state.toastT = Math.max(0, state.toastT - dt);
  if (state.ballFlash > 0) state.ballFlash = Math.max(0, state.ballFlash - dt);
  if (state.surfaceCd > 0) state.surfaceCd = Math.max(0, state.surfaceCd - dt);
  if (state.sfxEat > 0) state.sfxEat = Math.max(0, state.sfxEat - dt);
  updateParticles(state, dt);

  if (state.mode === "menu" || state.mode === "clear" || state.mode === "over") return;

  if (state.mode === "countdown") {
    const before = Math.ceil(state.countdown);
    state.countdown -= dt;
    const shown = Math.ceil(Math.max(0, state.countdown));
    if (shown !== state.countdownShown && shown > 0 && shown !== before) {
      state.countdownShown = shown;
      sfxCountdown();
    } else if (state.countdownShown === 0 && before > 0) {
      state.countdownShown = before;
      sfxCountdown();
    }
    if (!state.intro) steer(state, dt, stick);
    if (state.countdown <= 0) {
      state.countdown = 0;
      if (state.intro) {
        const { cell, surfaceRow, w } = state.world;
        state.x = Math.max(cell * 1.4, w * 0.16);
        state.y = (surfaceRow + 2.55) * cell;
        const mag = Math.hypot(stick.x, stick.y);
        state.facing = mag >= 0.18 ? Math.atan2(stick.y, stick.x) : Math.PI / 2;
        state.dirX = Math.cos(state.facing);
        state.dirY = Math.sin(state.facing);
        state.intro = false;
        state.dive = 0;
        clearSpawn(state);
        layTrail(state);
        bite(state, state.x, state.y, false);
        state.mode = "play";
      } else {
        state.mode = "play";
      }
      sfxGo();
    }
    return;
  }

  if (state.mode === "enter") {
    const home = homePose(state);
    const { cell, surfaceRow } = state.world;
    const duration = state.reduced ? 0.4 : RULES.diveTime;
    state.dive = Math.max(0, state.dive - dt);
    const p = 1 - state.dive / Math.max(0.01, duration);
    const startY = (surfaceRow + 2.55) * cell;
    state.x = home.x;
    state.y = startY + (home.y - startY) * p;
    state.facing = Math.PI / 2;
    state.dirX = 0;
    state.dirY = 1;
    layTrail(state, Math.max(2, Math.round(4 + (state.segCount - 4) * p)));
    if (p > 0.08) bite(state, state.x, state.y, false);
    if (state.dive <= 0) {
      state.intro = false;
      state.dive = 0;
      placeWorm(state);
      state.mode = "play";
    }
    return;
  }

  if (state.invuln > 0) state.invuln -= dt;
  steer(state, dt, stick);
  state.dirX = Math.cos(state.facing);
  state.dirY = Math.sin(state.facing);

  const { cell, surfaceRow, w, h } = state.world;
  const minY = (surfaceRow + 1) * cell + RULES.headClear;
  const pace = state.bonus ? RULES.speed * 1.65 : RULES.speed;
  let nx = state.x + state.dirX * pace * dt;
  let ny = state.y + state.dirY * pace * dt;
  nx = Math.max(RULES.headClear, Math.min(w - RULES.headClear, nx));
  const hitCeiling = ny < minY;
  if (hitCeiling) ny = minY;
  ny = Math.min(h - RULES.headClear, ny);

  if (hitCeiling && !state.bonus && state.dirY < 0 && state.surfaceCd <= 0) {
    state.toast = "The surface holds. Grokworm stays under.";
    state.toastT = 1.3;
    state.surfaceCd = 2.2;
  }

  if (!hitsSolid(state, nx, state.y)) state.x = nx;
  if (!hitsSolid(state, state.x, ny)) state.y = ny;
  pushTrail(state);

  if (state.mode !== "play") return;

  updateShot(state, dt);

  if (state.bonus) {
    if (state.chainT > 0) state.chainT = Math.max(0, state.chainT - dt);
    collectGems(state);
    state.timeLeft -= dt;
    if (state.gemsGot >= state.gems.length || state.timeLeft <= 0) finishBonus(state);
    return;
  }

  if (state.invuln <= 0) {
    const reason = deadlyReason(state, state.x, state.y);
    if (reason) hurt(state, reason);
  }

  if (state.mode === "play") eatAround(state);
  if (state.mode === "play" && reachedExit(state)) {
    winLevel(state);
    return;
  }
  if (state.mode === "play") updateGeology(state, dt);
  if (state.mode === "play") updateClogger(state, dt);
  if (state.mode === "play") {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) timeout(state);
  }
}

export function snapshot(state: GameState): Snap {
  const { cell, surfaceRow } = state.world;
  const exitX = state.exitC * cell + cell / 2;
  const exitY = state.exitR * cell + cell / 2;
  let walls = 0;
  for (let i = 0; i < state.cells.length; i++) if (state.cells[i] === Cell.Wall) walls++;
  return {
    mode: state.mode,
    x: state.x,
    y: state.y,
    score: state.score,
    best: state.best,
    eaten: state.eaten,
    lives: state.lives,
    timeLeft: state.timeLeft,
    level: state.level,
    surfaceY: surfaceRow * cell,
    minY: (surfaceRow + 1) * cell + RULES.headClear,
    dirX: state.dirX,
    dirY: state.dirY,
    facing: state.facing,
    exitX,
    exitY,
    exitDist: Math.hypot(state.x - exitX, state.y - exitY) / cell,
    cloggerOn: state.cloggerOn,
    cloggerX: state.cloggerX,
    cloggerY: state.cloggerY,
    walls,
  };
}

export function findCellCenter(state: GameState, name: "water" | "hazard" | "loose" | "rock") {
  const id =
    name === "water" ? Cell.Water : name === "hazard" ? Cell.Hazard : name === "loose" ? Cell.Loose : Cell.Rock;
  const { cols, rows, cell } = state.world;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (state.cells[r * cols + c] === id) {
        return { x: c * cell + cell / 2, y: r * cell + cell / 2 };
      }
    }
  }
  return null;
}

export function surfaceLine(state: GameState) {
  return state.world.surfaceRow * state.world.cell;
}
