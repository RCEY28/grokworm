type Item = {
  name: string;
  rule: string;
  swatch: "dirt" | "loose" | "tunnel" | "water" | "rock" | "mine" | "cave" | "exit" | "wall" | "ball" | "clogger" | "worm" | "cyan" | "gold" | "surface";
};

const OBJECTS: Item[] = [
  { name: "Grokworm", swatch: "worm", rule: "Always moves forward. You only steer. The body grows longer as it eats." },
  { name: "Dirt", swatch: "dirt", rule: "Bore through it. 10 points a bite." },
  { name: "Loose dirt", swatch: "loose", rule: "Worth 10 points, then it caves in and becomes rock. Get clear before it falls." },
  { name: "Tunnel", swatch: "tunnel", rule: "The hole left behind. Safe to travel through." },
  { name: "Water", swatch: "water", rule: "The blue pockets. Touching one floods the bore and costs a life. A cannonball clears it." },
  { name: "Rock", swatch: "rock", rule: "Gray stone. Blocks the worm. A cannonball stops here and does not break it." },
  { name: "Mine", swatch: "mine", rule: "Red warning sign. Touching it costs a life. A cannonball destroys it." },
  { name: "Cave-in", swatch: "cave", rule: "Falling earth. Being caught in it costs a life." },
  { name: "Surface", swatch: "surface", rule: "The crust on top. It stays closed. Grokworm cannot cross it." },
  { name: "Exit", swatch: "exit", rule: "The glowing ring. The only way out of an earth level." },
  { name: "Clogger", swatch: "clogger", rule: "The wall builder. It breaks in and pours a solid wall as it moves. It will not cover the exit." },
  { name: "Clogger wall", swatch: "wall", rule: "Solid. The worm cannot pass. A cannonball breaks it into tunnel." },
  { name: "Cannonball", swatch: "ball", rule: "As wide as Grokworm. You start with one, and each finished level adds another. They stack. Flies straight along the heading and clears that whole path. Stops on rock. One in the air at a time." },
  { name: "Cyan prize", swatch: "cyan", rule: "Bonus-track gem. 100 points, times your chain." },
  { name: "Gold prize", swatch: "gold", rule: "Bonus-track boost gem. 250 points, times your chain." },
];

function Swatch({ kind }: { kind: Item["swatch"] }) {
  if (kind === "worm") {
    return (
      <span className="rule-swatch">
        <span className="rule-worm" />
        <span className="rule-worm rule-worm-b" />
      </span>
    );
  }
  if (kind === "mine") {
    return (
      <span className="rule-swatch">
        <span className="rule-mine" />
      </span>
    );
  }
  if (kind === "ball") {
    return (
      <span className="rule-swatch">
        <span className="rule-trail" />
        <span className="rule-ball" />
      </span>
    );
  }
  if (kind === "exit") {
    return (
      <span className="rule-swatch">
        <span className="rule-exit" />
      </span>
    );
  }
  if (kind === "cyan" || kind === "gold") {
    return (
      <span className="rule-swatch">
        <span className={kind === "gold" ? "rule-gem rule-gem-gold" : "rule-gem"} />
      </span>
    );
  }
  if (kind === "clogger") {
    return (
      <span className="rule-swatch">
        <span className="rule-clogger" />
      </span>
    );
  }
  return <span className={`rule-swatch rule-${kind}`} />;
}

function TrackMap() {
  const d = "M14,58 L40,62 L56,54 L68,40 L58,30 L70,20 L52,10 L32,8 L16,16 L8,30 L10,44 L18,50 L8,64 L16,80 L36,86 L42,70 L28,56 Z";
  return (
    <svg className="rule-track" viewBox="0 0 100 100" aria-hidden="true">
      <path d={d} fill="#14361f" stroke="#f4f4f4" strokeWidth="7" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#2a3036" strokeWidth="4.2" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#fff" strokeWidth="0.7" strokeDasharray="3 2.4" />
      <circle cx="27" cy="60" r="2.1" fill="#7af6ff" />
      <circle cx="62" cy="47" r="2.1" fill="#ffe36a" />
      <circle cx="40" cy="14" r="2.1" fill="#7af6ff" />
      <circle cx="14" cy="36" r="2.1" fill="#ffe36a" />
    </svg>
  );
}

export function RulesCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules-back" onClick={onClose}>
      <section
        className="rules-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs tracking-widest text-primary">FIELD MANUAL</p>
        <h2 id="rules-title" className="mt-1 text-2xl font-bold">
          Grokworm rules
        </h2>
        <div className="rules-scroll">
          <h3>Objective</h3>
          <p>
            Reach the glowing exit before the clock runs out. After every 5th level, run the bonus track
            and grab the prizes. Three lives. Lose them all, or run out of time, and the bore stops.
          </p>

          <h3>Controls</h3>
          <p>
            Grokworm never stops. Drag the joystick to steer. Turn on arrow keys if you want those instead,
            which hides the joystick. Double-tap the joystick, or the same arrow key twice, to fire a
            cannonball straight ahead. Each level starts with a 3-2-1 countdown. You take control once the
            worm is in the earth.
          </p>

          <h3>Time and score</h3>
          <p>
            Level 1 has 90 seconds. Each later level has 6 seconds less, down to 50. Leftover seconds at the
            exit are worth 2 points each. Dirt and loose dirt are 10 points. The worm grows one segment every
            6 bites. Each finished level adds one cannonball, and they stack on the Balls count.
          </p>

          <h3>Lives</h3>
          <p>
            Water, a mine, or a cave-in costs one life. After a hit you blink and cannot be hurt for a short
            moment. Rocks, clogger walls, and the clogger itself only block you. They do not cost a life.
          </p>

          <h3>Everything in the earth</h3>
          <ul className="rule-list">
            {OBJECTS.map((item) => (
              <li key={item.name}>
                <Swatch kind={item.swatch} />
                <span>
                  <strong>{item.name}</strong>
                  <span>{item.rule}</span>
                </span>
              </li>
            ))}
          </ul>

          <h3>Cannonballs</h3>
          <p>
            The run starts with one. Each level you finish adds another, and they stack. It is the same width as Grokworm and flies in the exact direction the
            worm is moving. It clears that whole path, including clogger walls, water, and mines, and it
            stops when it hits rock. Double-tap again for the next one. With none left, the screen says NO
            CANNONBALL.
          </p>

          <h3>Bonus track</h3>
          <p>
            After levels 5, 10, 15, and so on, the title Bonus Round comes up. The course is a Watkins Glen
            road course: a front straight, a run of esses, and the boot. It is not an oval. Rock lines the
            outside, so stay on the asphalt. Twelve prizes sit on the racing line. Cyan is 100, gold is 250,
            and a quick chain multiplies that up to x5. You have 26 seconds. Clear every prize for a 500
            point jackpot. There is no exit and no clogger here. When the clock or the prizes are done, the
            next earth level begins.
          </p>
          <TrackMap />
        </div>
        <button type="button" className="start-btn mt-3 h-12 w-full shrink-0 rounded-lg bg-primary font-bold text-bg" onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  );
}
