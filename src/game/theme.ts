export type Palette = {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  primary: string;
  border: string;
  wormHi: string;
  worm: string;
  wormDeep: string;
  wormGlow: string;
  glow: string;
  dirt: string[];
  crust: string;
  tunnel: string;
};

const EARTH: Omit<Palette, "wormHi" | "worm" | "wormDeep" | "wormGlow"> = {
  bg: "#070b14",
  surface: "#101820",
  fg: "#e7fbff",
  muted: "#8eb4c4",
  primary: "#3ef0ff",
  border: "#1d3c4a",
  glow: "#9af6ff",
  dirt: ["#4a3424", "#5c4030", "#3a2a1e", "#6a4a2e"],
  crust: "#2a2118",
  tunnel: "#061018",
};

const WORMS = [
  { wormHi: "#e8fdff", worm: "#3ef0ff", wormDeep: "#067a9a", wormGlow: "#9af6ff" },
  { wormHi: "#ffe6fb", worm: "#ff4ad8", wormDeep: "#9a1468", wormGlow: "#ff9ae6" },
  { wormHi: "#f4ffd2", worm: "#c6ff4a", wormDeep: "#3d7a00", wormGlow: "#e4ff8a" },
  { wormHi: "#fff6d2", worm: "#ffc14a", wormDeep: "#a85a00", wormGlow: "#ffe08a" },
  { wormHi: "#ffe2de", worm: "#ff5a4a", wormDeep: "#8a1010", wormGlow: "#ff9a8a" },
  { wormHi: "#f6e8ff", worm: "#c084ff", wormDeep: "#5b21b6", wormGlow: "#e0c2ff" },
];

export function paletteFor(level: number) {
  const index = ((Math.max(1, level) - 1) % WORMS.length + WORMS.length) % WORMS.length;
  return { ...EARTH, ...WORMS[index] };
}
