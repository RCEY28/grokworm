let actx: AudioContext | null = null;
let enabled = true;
let musicTimer = 0;
let stepIndex = 0;
let nextTime = 0;

const live: { stop: () => void }[] = [];

const STEP = 0.17;
const BASS = [110, 110, 164.81, 110, 196, 164.81, 146.83, 130.81];
const LEAD = [0, 523.25, 0, 659.25, 0, 783.99, 659.25, 523.25];

export function isSoundEnabled() {
  return enabled;
}

function context() {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!actx) actx = new AC();
    if (actx.state === "suspended") void actx.resume();
    return actx;
  } catch {
    actx = null;
    return null;
  }
}

function toneAt(when: number, freq: number, dur: number, type: OscillatorType, peak: number) {
  const ctx = actx;
  if (!ctx || !enabled || freq <= 0) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(ctx.destination);
  const node = {
    stop() {
      try {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        o.stop();
      } catch {
        /* already stopped */
      }
    },
  };
  live.push(node);
  o.onended = () => {
    const i = live.indexOf(node);
    if (i >= 0) live.splice(i, 1);
  };
  o.start(when);
  o.stop(when + dur + 0.02);
}

function silence() {
  for (const node of live) node.stop();
  live.length = 0;
}

function scheduleMusic() {
  const ctx = actx;
  if (!ctx || !enabled) return;
  const now = ctx.currentTime;
  if (nextTime < now) nextTime = now + 0.02;
  while (nextTime < now + 0.4) {
    const i = stepIndex % BASS.length;
    toneAt(nextTime, BASS[i], 0.13, "square", 0.028);
    if (LEAD[i]) toneAt(nextTime, LEAD[i], 0.09, "square", 0.016);
    stepIndex += 1;
    nextTime += STEP;
  }
}

export function startMusic() {
  const ctx = context();
  if (!ctx || !enabled || musicTimer) return;
  nextTime = ctx.currentTime + 0.05;
  scheduleMusic();
  musicTimer = window.setInterval(scheduleMusic, 90);
}

export function stopMusic() {
  if (musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = 0;
  }
  silence();
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem("grokworm-sound", on ? "1" : "0");
  } catch {
    /* private mode */
  }
  if (!on) stopMusic();
  else startMusic();
}

export function unlockAudio() {
  context();
  if (enabled) startMusic();
}

export function sfxShot() {
  if (!actx) return;
  const now = actx.currentTime;
  toneAt(now, 196, 0.04, "square", 0.06);
  toneAt(now + 0.04, 98, 0.08, "square", 0.045);
}

export function sfxBoom() {
  if (!actx) return;
  const now = actx.currentTime;
  toneAt(now, 140, 0.06, "square", 0.06);
  toneAt(now + 0.05, 70, 0.12, "sawtooth", 0.04);
}

export function sfxCountdown() {
  if (!actx) return;
  toneAt(actx.currentTime, 440, 0.07, "square", 0.05);
}

export function sfxGo() {
  if (!actx) return;
  const now = actx.currentTime;
  toneAt(now, 523, 0.06, "square", 0.05);
  toneAt(now + 0.07, 784, 0.12, "square", 0.055);
}

export function sfxEat() {
  if (!actx) return;
  toneAt(actx.currentTime, 180 + Math.random() * 40, 0.04, "square", 0.03);
}

export function sfxHurt(kind: "water" | "cave" | "hit") {
  if (!actx) return;
  const now = actx.currentTime;
  if (kind === "water") {
    toneAt(now, 220, 0.08, "square", 0.05);
    toneAt(now + 0.08, 110, 0.16, "square", 0.05);
  } else if (kind === "cave") {
    toneAt(now, 160, 0.08, "square", 0.05);
    toneAt(now + 0.09, 80, 0.18, "sawtooth", 0.04);
  } else {
    toneAt(now, 300, 0.06, "square", 0.05);
    toneAt(now + 0.06, 140, 0.12, "square", 0.05);
  }
}

export function sfxOver() {
  if (!actx) return;
  const now = actx.currentTime;
  toneAt(now, 440, 0.1, "square", 0.05);
  toneAt(now + 0.12, 349, 0.1, "square", 0.05);
  toneAt(now + 0.24, 262, 0.1, "square", 0.05);
  toneAt(now + 0.36, 196, 0.22, "square", 0.055);
}

export function sfxClear() {
  if (!actx) return;
  const now = actx.currentTime;
  toneAt(now, 523, 0.08, "square", 0.045);
  toneAt(now + 0.09, 659, 0.08, "square", 0.045);
  toneAt(now + 0.18, 784, 0.08, "square", 0.05);
  toneAt(now + 0.27, 1046, 0.18, "square", 0.05);
}

export function sfxEnter() {
  if (!actx) return;
  const now = actx.currentTime;
  toneAt(now, 196, 0.08, "square", 0.045);
  toneAt(now + 0.1, 98, 0.16, "square", 0.05);
}
