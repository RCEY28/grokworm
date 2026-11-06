import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { render } from "@/game/draw";
import {
  advanceLevel,
  createGame,
  exitToMenu,
  findCellCenter,
  fireCannon,
  layTrail,
  measureWorld,
  snapshot,
  startRun,
  step,
} from "@/game/logic";
import { setSoundEnabled, unlockAudio } from "@/game/audio";
import { loadScores, postScore } from "@/game/scores-api";
import { drawShareCard, openScorePost } from "@/game/share-card";
import { loadXProfile, type XProfile } from "@/game/x-profile";
import { logXCard } from "@/game/x-cards";
import type { ScoreRow } from "@/game/scores.shared";
import { paletteFor } from "@/game/theme";
import { RulesCard } from "@/components/rules-card";
import type { GameState, Mode } from "@/game/types";

type Hud = {
  key: string;
  mode: Mode;
  level: number;
  score: number;
  best: number;
  eaten: number;
  lives: number;
  time: number;
  toast: string;
  toastOn: boolean;
  overReason: string;
  timeBonus: number;
  count: number;
  exitDist: number;
  bonus: boolean;
  gemsGot: number;
  gemsTotal: number;
  balls: number;
};

type Stick = { x: number; y: number };

const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function padScore(score: number) {
  return String(Math.max(0, Math.floor(score))).padStart(6, "0");
}

function pickHud(s: GameState): Hud {
  const time = Math.max(0, Math.ceil(s.timeLeft));
  const count = s.mode === "countdown" ? Math.max(1, Math.ceil(s.countdown)) : 0;
  const toastOn = s.toastT > 0 && s.toast.length > 0;
  const cell = s.world.cell;
  const exitX = s.exitC * cell + cell / 2;
  const exitY = s.exitR * cell + cell / 2;
  const exitDist = Math.round(Math.hypot(s.x - exitX, s.y - exitY) / cell);
  return {
    key: `${s.mode}|${s.level}|${s.score}|${s.best}|${s.eaten}|${s.lives}|${time}|${count}|${exitDist}|${toastOn ? s.toast : ""}|${s.overReason}|${s.timeBonus}|${s.bonus ? 1 : 0}|${s.gemsGot}|${s.gems.length}|${s.balls}|${s.ballFlash > 0 ? 1 : 0}`,
    mode: s.mode,
    level: s.level,
    score: s.score,
    best: s.best,
    eaten: s.eaten,
    lives: s.lives,
    time,
    toast: s.toast,
    toastOn,
    overReason: s.overReason,
    timeBonus: s.timeBonus,
    count,
    exitDist,
    bonus: s.bonus,
    gemsGot: s.gemsGot,
    gemsTotal: s.gems.length,
    balls: s.balls,
  };
}

function ScoreBoard({ rows, limit }: { rows: ScoreRow[]; limit: number }) {
  const lines = Array.from({ length: limit }, (_, i) => rows[i]);
  return (
    <div className="cabinet relative z-10 px-3 py-3">
      <p className="relative text-center text-[11px] text-[#ff4ad8]">HIGH SCORES</p>
      <ol className="relative mt-2">
        {lines.map((row, i) => (
          <li key={row?.id ?? `empty-${i}`} className="cabinet-row">
            <span>{String(i + 1).padStart(2, "0")}</span>
            <span>{row?.initials ?? "---"}</span>
            <span className="text-right text-[#fff36a]">{padScore(row?.score ?? 0)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GrokwormGame() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const stickRef = useRef<Stick>({ x: 0, y: 0 });
  const joyRef = useRef<HTMLDivElement>(null);
  const keysOnRef = useRef(false);
  const heldRef = useRef({ ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false });
  const enteringRef = useRef(false);
  const savedRef = useRef(false);
  const overStampRef = useRef("");
  const celebrateRef = useRef(false);
  const cardHoldRef = useRef(0);
  const rulesOpenRef = useRef(false);
  const joyTapRef = useRef(0);
  const joyUpRef = useRef(0);
  const arrowTapRef = useRef({ key: "", t: 0 });
  const [keysOn, setKeysOn] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [board, setBoard] = useState<ScoreRow[]>([]);
  const [letters, setLetters] = useState(["A", "A", "A"]);
  const [slot, setSlot] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [postNote, setPostNote] = useState("");
  const [handle, setHandle] = useState("");
  const [profile, setProfile] = useState<XProfile | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [cardPreview, setCardPreview] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [donateOpen, setDonateOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const boot = (rect: DOMRect) => {
      if (rect.width < 40 || rect.height < 40) return;
      const prevBest = stateRef.current?.best;
      const next = createGame(measureWorld(rect));
      if (prevBest && prevBest > next.best) next.best = prevBest;
      stateRef.current = next;
      setHud(pickHud(next));
    };

    boot(stage.getBoundingClientRect());

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudKey = stateRef.current ? pickHud(stateRef.current).key : "";

    const applyHeldStick = () => {
      const held = heldRef.current;
      let x = (held.ArrowRight ? 1 : 0) - (held.ArrowLeft ? 1 : 0);
      let y = (held.ArrowDown ? 1 : 0) - (held.ArrowUp ? 1 : 0);
      const mag = Math.hypot(x, y);
      if (mag > 1) {
        x /= mag;
        y /= mag;
      }
      stickRef.current = { x, y };
    };

    const frame = (now: number) => {
      const current = stateRef.current;
      if (!current) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (rulesOpenRef.current) {
        acc = 0;
      } else {
        acc += dt;
      }
      let steps = 0;
      const stick = stickRef.current;
      while (!rulesOpenRef.current && acc >= 1 / 60 && steps < 5) {
        step(current, 1 / 60, current.mode === "play" || current.mode === "countdown" ? stick : { x: 0, y: 0 });
        acc -= 1 / 60;
        steps++;
      }

      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const needW = Math.max(1, Math.floor(rect.width * dpr));
      const needH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW;
        canvas.height = needH;
      }
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const scale = Math.min(rect.width / current.world.w, rect.height / current.world.h);
      const ox = (rect.width - current.world.w * scale) / 2;
      const oy = (rect.height - current.world.h * scale) / 2;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, ox * dpr, oy * dpr);
      render(ctx, current);

      const nextHud = pickHud(current);
      if (nextHud.key !== hudKey) {
        hudKey = nextHud.key;
        setHud(nextHud);
      }
      if (current.mode === "over") {
        const stamp = `${current.score}|${current.level}|${current.eaten}|${current.overReason}`;
        if (overStampRef.current !== stamp) {
          const sameRun = savedRef.current && overStampRef.current !== "";
          overStampRef.current = stamp;
          if (!sameRun) {
            savedRef.current = false;
            enteringRef.current = true;
            setLetters(["A", "A", "A"]);
            setSlot(0);
            setSaved(false);
            setRank(null);
            setSaveError("");
            setCelebrate(false);
            celebrateRef.current = false;
            cardHoldRef.current = 0;
            setPostNote("");
          }
        }
      } else {
        enteringRef.current = false;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s) return;
      if (rulesOpenRef.current) {
        if (e.key === "Escape") {
          rulesOpenRef.current = false;
          setRulesOpen(false);
        }
        return;
      }
      if (Object.hasOwn(heldRef.current, e.key)) {
        if (!e.repeat) {
          const now = performance.now();
          if (arrowTapRef.current.key === e.key && now - arrowTapRef.current.t < 480) {
            fireCannon(s);
            arrowTapRef.current = { key: "", t: 0 };
          } else {
            arrowTapRef.current = { key: e.key, t: now };
          }
        }
        if (!keysOnRef.current || enteringRef.current) return;
        e.preventDefault();
        heldRef.current[e.key as keyof typeof heldRef.current] = true;
        applyHeldStick();
        return;
      }
      if (e.key !== "Enter" || enteringRef.current || celebrateRef.current || s.mode === "over") return;
      if (s.mode === "menu") {
        unlockAudio();
        stickRef.current = { x: 0, y: 0 };
        startRun(s);
      } else if (s.mode === "clear") {
        unlockAudio();
        stickRef.current = { x: 0, y: 0 };
        advanceLevel(s);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!Object.hasOwn(heldRef.current, e.key)) return;
      heldRef.current[e.key as keyof typeof heldRef.current] = false;
      if (keysOnRef.current) applyHeldStick();
    };
    const onBlur = () => {
      heldRef.current = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
      stickRef.current = { x: 0, y: 0 };
      setKnob({ x: 0, y: 0 });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const api = {
      ready: true,
      snap: () => (stateRef.current ? snapshot(stateRef.current) : null),
      steer(x: number, y: number) {
        stickRef.current = { x, y };
      },
      teleport(x: number, y: number) {
        const s = stateRef.current;
        if (!s) return;
        s.x = x;
        s.y = y;
        layTrail(s);
      },
      find: (name: "water" | "hazard" | "loose" | "rock") =>
        stateRef.current ? findCellCenter(stateRef.current, name) : null,
    };
    (window as unknown as { __grokworm: typeof api }).__grokworm = api;

    const ro = new ResizeObserver(() => {
      const rect = stage.getBoundingClientRect();
      const s = stateRef.current;
      if (!s || s.mode === "menu") boot(rect);
    });
    ro.observe(stage);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem("grokworm-sound") === "0") {
        setSoundOn(false);
        setSoundEnabled(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const theme = paletteFor(hud?.level ?? 1);
    const root = document.documentElement;
    root.style.setProperty("--color-bg", theme.bg);
    root.style.setProperty("--color-surface", theme.surface);
    root.style.setProperty("--color-fg", theme.fg);
    root.style.setProperty("--color-muted", theme.muted);
    root.style.setProperty("--color-primary", theme.primary);
    root.style.setProperty("--color-border", theme.border);
  }, [hud?.level]);

  useEffect(() => {
    let live = true;
    (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const rows = await loadScores();
          if (!live) return;
          if (rows.length) {
            setBoard(rows);
            return;
          }
        } catch {
          /* try the board again before leaving it blank */
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const postRecord = async () => {
    const s = stateRef.current;
    if (!s || !profile) return;
    setPostNote("");
    try {
      const how = await openScorePost({
        initials: letters.join(""),
        score: s.score,
        rank: rank ?? 0,
        level: s.level,
        handle: profile.handle,
        name: profile.name,
        avatar: profile.avatar,
      });
      try {
        await logXCard({
          handle: profile.handle,
          name: profile.name,
          initials: letters.join(""),
          score: s.score,
          level: s.level,
          rank,
        });
      } catch {
        /* the post still went out */
      }
      if (how === "composer") {
        setPostNote("X is open. The card downloaded. Attach it if it is not already on the post.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setPostNote("The post did not open. Try again.");
    }
  };

  const topTen = saved && rank !== null && rank >= 1 && rank <= 10;
  const badge =
    rank === 1 ? "#e2b03a" : rank === 2 ? "#c5d0dc" : rank === 3 ? "#c4844e" : "#3ecbff";
  const mode = hud?.mode ?? "menu";
  const ready = hud !== null;
  const showStick = !keysOn && mode !== "menu" && mode !== "over" && mode !== "clear";

  const setArrowKeys = (on: boolean) => {
    keysOnRef.current = on;
    setKeysOn(on);
    heldRef.current = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    stickRef.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
  };

  const applyPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const base = joyRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.34;
    const mag = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(max, mag);
    dx = (dx / mag) * clamped;
    dy = (dy / mag) * clamped;
    stickRef.current = { x: dx / max, y: dy / max };
    setKnob({ x: dx, y: dy });
  };

  const grab = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    applyPointer(e);
    const now = performance.now();
    if (now - joyTapRef.current < 480) {
      const s = stateRef.current;
      if (s) fireCannon(s);
      joyTapRef.current = 0;
    } else {
      joyTapRef.current = now;
    }
  };

  const releaseStick = (e: ReactPointerEvent<HTMLDivElement>) => {
    stickRef.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const now = performance.now();
    if (now - joyUpRef.current < 480) {
      const s = stateRef.current;
      if (s && !s.shot) fireCannon(s);
      joyUpRef.current = 0;
    } else {
      joyUpRef.current = now;
    }
  };

  const locked = () => Date.now() < cardHoldRef.current && !cardPreview;

  const clearPhoto = () => {
    setProfile(null);
    setCardPreview("");
    setHandle("");
    setPhotoError("");
    setPhotoBusy(false);
  };

  useEffect(() => {
    if (!profile || !hud) {
      setCardPreview("");
      return;
    }
    let live = true;
    drawShareCard({
      initials: letters.join(""),
      score: hud.score,
      rank: rank ?? 0,
      level: hud.level,
      handle: profile.handle,
      name: profile.name,
      avatar: profile.avatar,
    })
      .then((canvas) => {
        if (live) setCardPreview(canvas.toDataURL("image/jpeg", 0.9));
      })
      .catch(() => {
        if (live) setCardPreview("");
      });
    return () => {
      live = false;
    };
  }, [profile, rank, letters, hud]);

  const usePhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const found = await loadXProfile(handle);
      setProfile(found);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That X profile did not load.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const bragControls = (fieldId: string) => {
    if (cardPreview) {
      return (
        <>
          <img className="topten-preview" src={cardPreview} alt="Your card, ready to post" />
          <button type="button" className="topten-post" onClick={() => void postRecord()}>
            Post to X
          </button>
          <button type="button" className="topten-change" onClick={clearPhoto}>
            Change handle
          </button>
        </>
      );
    }
    return (
      <form
        className="topten-handle-form"
        onSubmit={(event) => {
          event.preventDefault();
          void usePhoto();
        }}
      >
        <label htmlFor={fieldId}>X handle</label>
        <input
          id={fieldId}
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder="@handle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          enterKeyHint="go"
        />
        <button type="submit" className="topten-post" disabled={photoBusy || Boolean(profile)}>
          {photoBusy || profile ? "Making your card" : "Show my card"}
        </button>
        {photoError ? <p className="topten-note">{photoError}</p> : null}
      </form>
    );
  };

  const begin = () => {
    if (locked()) return;
    setDonateOpen(false);
    setCelebrate(false);
    const s = stateRef.current;
    if (!s) return;
    unlockAudio();
    stickRef.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
    celebrateRef.current = false;
    cardHoldRef.current = 0;
    clearPhoto();
    if (s.mode === "clear") advanceLevel(s);
    else startRun(s);
    setHud(pickHud(s));
  };

  const leave = () => {
    if (locked()) return;
    setDonateOpen(false);
    setCelebrate(false);
    celebrateRef.current = false;
    clearPhoto();
    const s = stateRef.current;
    if (!s) return;
    exitToMenu(s);
    setHud(pickHud(s));
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) unlockAudio();
    setSoundEnabled(next);
  };

  const spinLetter = (index: number, dir: number) => {
    setSlot(index);
    setLetters((prev) => {
      const next = [...prev];
      const at = ABC.indexOf(next[index] ?? "A");
      next[index] = ABC[(at + dir + 26) % 26] ?? "A";
      return next;
    });
  };

  const recordScore = async () => {
    if (saving || savedRef.current) return;
    const s = stateRef.current;
    if (!s) return;
    setSaving(true);
    setSaveError("");
    clearPhoto();
    try {
      const result = await postScore({ initials: letters.join(""), score: s.score, level: s.level });
      setBoard(result.board);
      setRank(result.rank);
      setSaved(true);
      const top = result.rank >= 1 && result.rank <= 10;
      celebrateRef.current = top;
      enteringRef.current = true;
      cardHoldRef.current = Date.now() + 2200;
      setCelebrate(top);
      savedRef.current = true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The board did not save. Try again.");
      loadScores()
        .then((rows) => setBoard(rows))
        .catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (mode !== "over" || saved || rulesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSlot((n) => (n + 2) % 3);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSlot((n) => (n + 1) % 3);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const dir = e.key === "ArrowUp" ? 1 : -1;
        setLetters((prev) => {
          const next = [...prev];
          const at = ABC.indexOf(next[slot] ?? "A");
          next[slot] = ABC[(at + dir + 26) % 26] ?? "A";
          return next;
        });
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const letter = e.key.toUpperCase();
        setLetters((prev) => {
          const next = [...prev];
          next[slot] = letter;
          return next;
        });
        setSlot((n) => (n + 1) % 3);
      } else if (e.key === "Enter") {
        e.preventDefault();
        void recordScore();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const openRules = () => {
    rulesOpenRef.current = true;
    setRulesOpen(true);
  };

  const closeRules = () => {
    rulesOpenRef.current = false;
    setRulesOpen(false);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <div ref={stageRef} className="absolute inset-0 touch-none">
        <canvas ref={canvasRef} className="absolute left-0 top-0" />
      </div>

      <button
        type="button"
        className="absolute z-40 h-11 rounded-full border border-border bg-surface/90 px-3 text-xs font-bold tracking-wide text-primary"
        style={{ top: "max(0.55rem, env(safe-area-inset-top))", right: "3.7rem" }}
        onClick={openRules}
      >
        Rules
      </button>

      <button
        type="button"
        className="absolute right-3 z-40 grid h-11 w-11 place-items-center rounded-full border border-border bg-surface/90 text-primary"
        style={{ top: "max(0.55rem, env(safe-area-inset-top))" }}
        aria-pressed={soundOn}
        aria-label={soundOn ? "Sound on" : "Sound off"}
        onClick={toggleSound}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M4 10h3.5L12 6.5v11L7.5 14H4z" />
          {soundOn ? (
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M16 9.2a3.6 3.6 0 0 1 0 5.6M18.4 7a6.4 6.4 0 0 1 0 10"
            />
          ) : (
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M16 9l5 6M21 9l-5 6" />
          )}
        </svg>
      </button>

      <header className="hud-safe pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-bg via-bg/80 to-transparent px-3 pr-36 pb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
          <span className="font-bold tracking-widest text-primary">GROKWORM</span>
          {hud?.bonus ? (
            <span className="font-bold tracking-widest text-primary">Bonus Round</span>
          ) : (
            <span className="text-muted">
              Level <span className="text-fg">{hud?.level ?? 1}</span>
            </span>
          )}
          {hud?.bonus ? (
            <span className="text-muted">
              Prizes <span className="text-fg tabular-nums">{hud.gemsGot}/{hud.gemsTotal}</span>
            </span>
          ) : (
            <span className="text-muted">
              Earth <span className="text-fg tabular-nums">{hud?.eaten ?? 0}</span>
            </span>
          )}
          <span className="text-muted">
            Score <span className="text-fg tabular-nums">{hud?.score ?? 0}</span>
          </span>
          <span className="text-muted" aria-label={`Cannonballs ${hud?.balls ?? 0}`}>
            Balls <span className="text-[#ffe36a] tabular-nums">{hud?.balls ?? 0}</span>
          </span>
          {!hud?.bonus && (
            <span className="text-muted">
              Exit <span className="text-fg tabular-nums">{hud?.exitDist ?? 0}</span>
            </span>
          )}
          <span className={hud && hud.time <= 10 && mode === "play" ? "text-danger" : "text-muted"}>
            Time <span className="tabular-nums text-fg">{hud?.time ?? 0}</span>
          </span>
          <span className="flex items-center gap-1" aria-label={`Lives ${hud?.lives ?? 3}`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2 w-5 rounded-sm ${i < (hud?.lives ?? 3) ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </span>
        </div>
        {hud?.toastOn && <p className="mt-1 text-sm text-primary">{hud.toast}</p>}
      </header>

      {mode === "menu" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex max-h-[58%] justify-center p-3 pad-safe">
          <section className="pointer-events-auto flex max-h-full w-full max-w-lg flex-col rounded-xl border border-border bg-surface/95 p-4">
            <div className="min-h-0 overflow-y-auto">
              <p className="text-xs tracking-widest text-primary">BORE 01</p>
              <h1 className="mt-1 text-3xl font-bold tracking-wide">Grokworm</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Once the countdown ends, Grokworm does not stop.{" "}
                {keysOn
                  ? "Arrow keys are on. The joystick is hidden."
                  : "Steer with the joystick using a finger, a mouse, or a trackpad."}{" "}
                The marked exit is the only way out. The surface stays closed. A clogger breaks in
                and pours a solid wall as it moves.
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-bold">Arrow keys</p>
                  <p className="text-xs text-muted">
                    {keysOn ? "On. Steer with the arrow keys." : "Off. The joystick stays on screen."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={keysOn}
                  aria-label="Arrow keys"
                  className={`relative h-8 w-14 shrink-0 rounded-full border border-border ${keysOn ? "bg-primary" : "bg-bg"}`}
                  onClick={() => setArrowKeys(!keysOn)}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full ${keysOn ? "left-7 bg-bg" : "left-0.5 bg-muted"}`}
                  />
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                Three lives. Dirt still scores. Reach the exit before the clock runs out. Blue pockets
                are water. You start with one cannonball. Each finished level adds another, and they stack.
                Double-tap the joystick or the same arrow key to fire.
                {hud && hud.best > 0 ? ` Best ${hud.best}.` : ""}
              </p>
              <div className="mt-3">
                <ScoreBoard rows={board} limit={5} />
              </div>
            </div>
            <button
              type="button"
              className="start-btn mt-3 h-12 w-full shrink-0 rounded-lg bg-primary font-bold tracking-wide text-bg disabled:opacity-50"
              onClick={begin}
              disabled={!ready}
            >
              Start
            </button>
          </section>
        </div>
      )}

      {mode === "countdown" && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="text-center">
            {hud?.bonus && (
              <p className="mb-2 text-3xl font-bold tracking-widest text-primary">Bonus Round</p>
            )}
            <p className="count-num text-8xl font-bold text-primary tabular-nums">{hud?.count || 3}</p>
          </div>
        </div>
      )}

      {mode === "clear" && hud?.bonus && (
        <div className="absolute inset-0 z-20 grid place-items-center p-4">
          <section className="w-full max-w-md rounded-xl border border-border bg-surface/95 p-5 text-center">
            <p className="text-xs tracking-widest text-primary">BONUS ROUND</p>
            <h2 className="mt-1 text-2xl font-bold">Bonus Round</h2>
            <p className="mt-2 text-sm text-muted">
              Grokworm grabbed {hud.gemsGot} of {hud.gemsTotal} prizes.
              {hud.gemsGot === hud.gemsTotal && hud.gemsTotal > 0 ? " Clean lap. Jackpot 500." : ""}
            </p>
            <p className="mt-2 text-lg tabular-nums text-fg">Score {hud.score}</p>
            <button type="button" className="mt-4 h-12 w-full rounded-lg bg-primary font-bold text-bg" onClick={begin}>
              Continue
            </button>
          </section>
        </div>
      )}

      {mode === "clear" && hud && !hud.bonus && (
        <div className="absolute inset-0 z-20 grid place-items-center p-4">
          <section className="w-full max-w-md rounded-xl border border-border bg-surface/95 p-5 text-center">
            <p className="text-xs tracking-widest text-primary">LEVEL {hud.level}</p>
            <h2 className="mt-1 text-2xl font-bold">Exit reached</h2>
            <p className="mt-2 text-sm text-muted">
              Grokworm left the tunnel. Time bonus {hud.timeBonus}. Score {hud.score}. Cannonball earned. Balls{" "}
              {hud.balls}.
            </p>
            <button type="button" className="mt-4 h-12 w-full rounded-lg bg-primary font-bold text-bg" onClick={begin}>
              Next level
            </button>
          </section>
        </div>
      )}

      {mode === "over" && hud && (
        <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto p-4">
          <section className="my-4 w-full max-w-md rounded-xl border border-border bg-surface/95 p-5 text-center">
            <p className="text-xs tracking-widest text-danger">BORE STOPPED</p>
            <h2 className="mt-1 text-2xl font-bold">Run over</h2>
            <p className="mt-2 text-sm text-muted">{hud.overReason}</p>
            <p className="mt-2 text-lg text-[#fff36a]" style={{ fontFamily: '"Press Start 2P", monospace' }}>
              {padScore(hud.score)}
            </p>
            <p className="mt-2 text-xs text-[#ffe36a]">Cannonballs {hud.balls}</p>
            {!saved ? (
              <div className="mt-4">
                <p className="text-xs tracking-widest text-[#ff4ad8]">ENTER INITIALS</p>
                <p className="mt-1 text-xs text-muted">Three letters. They stay on the board for every player.</p>
                <div className="mt-3 flex justify-center gap-3">
                  {letters.map((letter, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <button type="button" className="text-[#7dfff6]" aria-label={`Letter ${i + 1} up`} onClick={() => spinLetter(i, 1)}>
                        +
                      </button>
                      <button
                        type="button"
                        className={`letter-key ${slot === i ? "on" : ""}`}
                        aria-label={`Initial ${i + 1} ${letter}`}
                        onClick={() => spinLetter(i, 1)}
                      >
                        {letter}
                      </button>
                      <button type="button" className="text-[#7dfff6]" aria-label={`Letter ${i + 1} down`} onClick={() => spinLetter(i, -1)}>
                        −
                      </button>
                    </div>
                  ))}
                </div>
                {saveError ? <p className="mt-2 text-xs text-danger">{saveError}</p> : null}
                <button
                  type="button"
                  className="mt-4 h-12 w-full rounded-lg bg-[#ff4ad8] font-bold tracking-wide text-bg disabled:opacity-50"
                  onClick={() => void recordScore()}
                  disabled={saving}
                >
                  {saving ? "Saving" : "Record score"}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-[#7dfff6]">
                  {topTen ? `Rank ${String(rank).padStart(2, "0")}.` : `Saved. Rank ${rank ?? ""}.`}
                </p>
                {bragControls("over-handle")}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className="h-12 rounded-lg bg-primary font-bold text-bg" onClick={begin}>
                    Play again
                  </button>
                  <button type="button" className="h-12 rounded-lg border border-border font-bold" onClick={leave}>
                    Exit
                  </button>
                </div>
                {postNote ? <p className="mt-2 text-xs text-muted">{postNote}</p> : null}
              </div>
            )}
            <button type="button" className="donate-btn" onClick={() => setDonateOpen(true)}>
              Donate to this game
            </button>
            <div className="mt-4 text-left">
              <ScoreBoard rows={board} limit={10} />
            </div>
          </section>
        </div>
      )}

      {showStick && (
        <div className="pad-safe pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
          <div
            ref={joyRef}
            className="joy pointer-events-auto"
            onPointerDown={grab}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) applyPointer(e);
            }}
            onPointerUp={releaseStick}
            onPointerCancel={releaseStick}
            role="slider"
            aria-label="Steer Grokworm"
            aria-valuemin={-1}
            aria-valuemax={1}
            aria-valuenow={Math.round(stickRef.current.x * 10) / 10}
          >
            <span className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
        </div>
      )}

      {celebrate && topTen && hud && (
        <div
          className="topten-back"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <section
            className="topten-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={cardPreview ? undefined : "topten-title"}
            aria-label={cardPreview ? "Your card" : undefined}
          >
            <button
              type="button"
              className="donate-close"
              aria-label="Close"
              onClick={() => {
                if (locked()) return;
                celebrateRef.current = false;
                setCelebrate(false);
              }}
            >
              ×
            </button>
            {cardPreview ? null : <p className="topten-kicker">TOP 10</p>}
            {cardPreview ? null : (
              <>
                <div className="topten-badge" style={{ ["--badge" as string]: badge }}>
                  <span>{String(rank).padStart(2, "0")}</span>
                </div>
                <h2 id="topten-title">On the board</h2>
                <p className="topten-initials">{letters.join("")}</p>
                <p className="topten-score">{padScore(hud.score)}</p>
                <p className="topten-level">Level {hud.level}</p>
              </>
            )}
            {bragControls("award-handle")}
            {cardPreview ? (
              <div className="topten-actions">
                <button type="button" className="topten-again" onClick={begin}>
                  Play again
                </button>
                <button type="button" className="topten-exit" onClick={leave}>
                  Exit
                </button>
              </div>
            ) : null}
            {postNote ? <p className="topten-note">{postNote}</p> : null}
          </section>
        </div>
      )}

      {donateOpen && (
        <div className="donate-back" onClick={() => setDonateOpen(false)}>
          <div
            className="donate-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="donate-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="donate-close" aria-label="Close" onClick={() => setDonateOpen(false)}>
              ×
            </button>
            <h3 id="donate-title">Donate to this game</h3>
            <p>Opens X Money to pay @rcey28. The amount is filled in. You confirm the send.</p>
            <div className="donate-grid">
              {[1, 2, 5, 10].map((amount) => (
                <a
                  key={amount}
                  className="donate-amt"
                  href={`https://x.com/i/money/pay/rcey28?amount=${amount}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${amount}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      {rulesOpen ? <RulesCard onClose={closeRules} /> : null}
    </div>
  );
}
