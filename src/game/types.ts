export const BEST_KEY = "grokworm-best-v1";

export const RULES = {
  pointsPerDirt: 10,
  timeBonusPerSecond: 2,
  baseTime: 90,
  timeStep: 6,
  minTime: 50,
  lives: 3,
  speed: 168,
  growEvery: 6,
  baseSegments: 12,
  maxSegments: 28,
  spacing: 11,
  bodyRadius: 11,
  invuln: 1.7,
  diveTime: 1.7,
  caveDelay: 0.85,
  fallTime: 0.32,
  headClear: 18,
  cloggerSpeed: 74,
  steer: 16,
  ballSpeed: 520,
} as const;

export const Cell = {
  Sky: 0,
  Crust: 1,
  Dirt: 2,
  Tunnel: 3,
  Rock: 4,
  Water: 5,
  Loose: 6,
  Hazard: 7,
  Falling: 8,
  Exit: 9,
  Wall: 10,
} as const;

export type CellId = (typeof Cell)[keyof typeof Cell];

export type Mode = "menu" | "countdown" | "play" | "clear" | "over" | "enter";

export type World = {
  cell: number;
  cols: number;
  rows: number;
  surfaceRow: number;
  w: number;
  h: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: number;
};

export type Gem = {
  x: number;
  y: number;
  got: boolean;
  boost: boolean;
};

export type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  flown: number;
};

export type GameState = {
  world: World;
  dpr: number;
  cells: Uint8Array;
  crack: Float32Array;
  fallT: Float32Array;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  facing: number;
  trailX: number[];
  trailY: number[];
  segCount: number;
  eaten: number;
  score: number;
  best: number;
  lives: number;
  timeLeft: number;
  level: number;
  invuln: number;
  mode: Mode;
  countdown: number;
  countdownShown: number;
  shake: number;
  flash: number;
  toast: string;
  toastT: number;
  surfaceCd: number;
  overReason: string;
  timeBonus: number;
  clock: number;
  sfxEat: number;
  reduced: boolean;
  particles: Particle[];
  exitC: number;
  exitR: number;
  cloggerOn: boolean;
  cloggerX: number;
  cloggerY: number;
  cloggerFacing: number;
  cloggerEnter: number;
  cloggerTurn: number;
  boreX: number[];
  boreY: number[];
  boreGen: number;
  intro: boolean;
  dive: number;
  bonus: boolean;
  gems: Gem[];
  gemsGot: number;
  chain: number;
  chainT: number;
  balls: number;
  ballsGranted: number;
  ballFlash: number;
  ballNote: string;
  shot: Shot | null;
};

export type Snap = {
  mode: Mode;
  x: number;
  y: number;
  score: number;
  best: number;
  eaten: number;
  lives: number;
  timeLeft: number;
  level: number;
  surfaceY: number;
  minY: number;
  dirX: number;
  dirY: number;
  facing: number;
  exitX: number;
  exitY: number;
  exitDist: number;
  cloggerOn: boolean;
  cloggerX: number;
  cloggerY: number;
  walls: number;
};
