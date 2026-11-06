# Grokworm

Canonical project folder (read this before any new Grok Build session):

Google Drive → **Grokworm**
https://drive.google.com/drive/folders/1efCYuQPTlWW4UlaeUwvUqceiZ2e87pET

The same notes are in this workspace at `artifacts/grokworm/README.md` and `artifacts/grokworm/BUILD_LOG.md`. Read the newest log entry first. Do not redesign from scratch.

## Where the project stands (2026-10-16)

The playable game is this workspace. Preview is port 8080. Ryan publishes to www.grokworm.com himself. Do not treat the preview as the live site.

Main files: `src/game/logic.ts`, `src/game/draw.ts`, `src/components/grokworm-game.tsx`, `src/components/rules-card.tsx`.

Latest change: the top 10 award card can add the public X profile picture for a handle the player types. Post record to X uses that card. The same footer stays. A finished level still adds one cannonball, and they stack. See the top of `artifacts/grokworm/BUILD_LOG.md`.

## What this is

Grokworm is a 2D browser game for grokworm.com. The player is the robotic bore in the reference image: matte black segmented body, silver rings, cyan LED dashes, glowing cyan eyes, a small smile, a cheek mark, and a curled tail with a cyan tip. It tunnels under the earth. It never surfaces except through the marked exit.

## Reference

`grokworm-reference.jpg` in the Drive folder is the likeness. Match it. Do not recast the worm.

## Rules locked by Ryan

Updated 2026-10-13 after the first playable build. Ryan replaced movement, the controller, the screen fit, and the level goal. Lives, the timer, the surface, dirt scoring, and the start countdown stay.

- The map fills the player's screen. Resizing or rotating refits the view. A new run from the menu rebuilds the earth to that screen.
- After the countdown, Grokworm runs continuously. Releasing the control does not stop it. It keeps the last heading.
- Control is a joystick by default. Touch, mouse, and trackpad all drag the same stick. The stick steers. It does not replace the Start button. The start card can switch on arrow keys. That hides the joystick.
- Dirt is eaten as a round bore the width of the worm, not as square blocks. The body is one width from head to tail.
- Earth tones stay on every level. Only Grokworm's color changes.
- A lost life plays the 3 second countdown again. The timer pauses during countdowns.
- Game over takes three initials for a public high-score board, then Exit or Play again. A blue DONATE pill opens https://x.com/rcey28. The player taps the dollar sign and sends $1.
- The earth's surface sits a little down from the top. The bore cannot cross it. Pushing into it stops that direction and does not cost a life.
- A clogger enters during the level, moves on its own, and lays a continuous solid wall. The wall blocks Grokworm. The clogger's body also blocks. The starter tunnel and the exit chamber are left open.
- The level is passed by reaching the predetermined EXIT. It is marked on the map. Dirt eaten is still score, not the goal.
- Three lives. Scoreboard stays on screen. Score keeps climbing as dirt is eaten, including after a lost life and into the next level.
- Start button, then a 3 second center-screen countdown, then the bore runs.
- Timer still ends the run if the exit is not reached. Water, cave-ins, and buried metal still cost a life.

## Tunables

| Rule | Value |
|---|---|
| Points per dirt cell | 10 |
| Time bonus | 2 points per second left when the exit is reached |
| Lives | 3, not refilled on level clear |
| Level 1 time | 90 seconds |
| Each next level | −6s, floor 50s. The exit row shifts. The clogger is faster and enters sooner. |
| Bore speed | 168 px/s, always, while the level is in play |
| Clogger speed | 74 px/s, plus 8 each level |
| Starting length | 12 segments, +1 every 6 dirt, cap 28 |
| Mercy after a hit | 1.7s |
| Cave-in warning | 0.85s, then the column seals into rock |
| Surface | hard ceiling, warning text only |
| Clogger entry | about 2.4s into level 1 |

## Level contents

- EXIT chamber on the right, below the surface. Reaching it passes the level.
- Clogger: rust-colored creature. Its trail is a ribbed solid wall.
- Water pools. Entering drowns and costs a life.
- Loose cracked earth. Eating it drops the column.
- Gray rock. Blocks the bore. Does not cost a life.
- Cyan-marked buried metal. Contact costs a life.

Death respawns in an open tunnel, aimed at the exit, unless lives hit zero. Time and score do not reset. Best score is kept in this browser only.

## Not built yet

Real water flow, equipment, and story levels. The public leaderboard, cannonball, bonus track, and rules card are already in the game.
