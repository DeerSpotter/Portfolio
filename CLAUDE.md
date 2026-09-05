# Portfolio baseline

This repository now uses a hybrid portfolio architecture. Treat it as the production baseline.

## Baseline

- `index.html` is the page shell and HUD.
- `src/portfolio.css` styles the HUD and hiring brief using the baseline palette.
- `src/portfolio-content.js` contains the six evidence-backed waypoint stories and original route placements.
- `src/portfolio-ui.js` owns story navigation and the native hiring-brief dialog; document scroll remains the flight timeline.
- `src/canvas-flight.js` renders the illustrated 2D / 2.5D parchment world, planets, rings, perspective motion, waypoints, trails, and seamless scroll loop.
- `src/ship-overlay.js` renders only the 3D ship and chase camera over the canvas.
- `src/ship-stub.js` is the documented procedural ship model currently used by the baseline.
- `verify-canvas.mjs` is the browser regression proof.
- `.github/workflows/pages.yml` deploys `main` to GitHub Pages.
- `.github/workflows/baseline-browser-proof.yml` validates the baseline in CI.
- `.github/scripts/` captures validation output, updates the single PR diagnostic comment, and fails the gate after publication.

## Locked direction

Do not restore the previous full-3D world or the old cartographer/fox-template implementation unless explicitly requested.

The intended experience is:

```text
HTML portfolio content / HUD
            ↓
transparent Three.js ship layer
            ↓
illustrated Canvas 2D / 2.5D world
            ↓
native browser scroll
```

The ship keeps the original third-person chase flight language: perspective camera behind and above the ship, forward travel, yaw, pitch, expressive banking, warp response, look-ahead, and forward/reverse looping.

The environment stays lightweight and illustrated. Do not reintroduce 3D stars, nebulae, gates, moons, asteroids, obstacle fields, ribbons, or 3D warp geometry as background content.

## Engineering rules

- Keep scroll position deterministic as the timeline source of truth.
- Preserve forward and reverse navigation.
- No monkey patching.
- Do not suppress runtime, build, test, or deployment failures.
- Replace superseded implementations cleanly instead of leaving dead runtime code.
- Keep the critical path compatible with static GitHub Pages hosting.
- Keep camera motion readable even when ship banking is expressive.
- Keep the background cheaper than the ship layer so slower computers remain usable.
- If an external runtime dependency remains, document it and prefer vendoring or reproducible bundling before final production hardening.
