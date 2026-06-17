# Emberwatch

> **Feed the fire. Hold the dark.**

A top-down action roguelite / horde-survivor built as a **single self-contained HTML file** — canvas plus vanilla JavaScript, no build step, no framework, no third-party assets. All audio is synthesized at runtime through the WebAudio API and all visuals are drawn procedurally, so there is nothing to license and nothing to download. It runs in any modern desktop or mobile browser.

## The idea

A campfire sits at the center of the world and does triple duty. It is your **progression** (its level is your level — feeding it drives all advancement), your **safety** (at night, straying beyond its light leaves you Exposed and your life drains), and your **bank** (you must carry the remains of slain foes back to the fire to deposit them and grow). The best loot is at the edge of the light; retrieving it means a run back through the dark. By day the loop is generous; by night it becomes a survival puzzle.

## Play

Open `emberwatch.html` in a browser. That's the whole game.

- **Desktop** — hold the mouse to move, release to attack the nearest foe. `Q W E R` cast abilities toward the cursor. `I` opens your satchel, `M` mutes.
- **Mobile** — left-side joystick to move; tap an ability to cast where you face, or drag to aim and release.

Three classes (Ranger, Mage, Knight), each with a passive and four abilities; a composable stat system; nine themed equipment sets with set bonuses; a day/night cycle with weather; and procedural fire, rain, and cricket ambience.

## Develop

It is one file. Open it in any editor and reload the browser — there is no toolchain. The script is organized into labelled sections; search for a section title (e.g. `COMBAT CORE`, `UPDATE`, `RENDER`) to jump to it. A map of all sections sits at the top of the `<script>` block.

### Testing

Game logic is validated with a headless Node harness that extracts the script, stubs the browser environment (canvas, WebAudio, DOM, storage), and runs the game loop without a display:

```bash
node test/harness.js
```

It reports `ALL OK` on a clean run. Any change to game logic should pass it before being committed; pure CSS or copy changes don't require it. See the comments in `test/harness.js` for environment gotchas.

## Project structure

```
emberwatch.html      the entire game
docs/                design briefing, plan, and research notes
test/harness.js      headless validation harness
```

## Status

Active prototype, balance still being tuned through playtesting. Content is intentionally lean while the core loop is validated.

## License

No license is currently granted; all rights reserved. A license may be added later as a deliberate decision.
