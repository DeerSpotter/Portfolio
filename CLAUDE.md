# Portfolio — live 3D flight branch

This branch is a ground-up replacement of the previous hand-painted cartographer map. The new direction is a scroll-driven, third-person 3D portfolio journey.

## Current objective

Prove the flight system before migrating portfolio content.

The current implementation must stay deterministic from native scroll position:

```text
browser scroll position
        -> target timeline progress
        -> damped actual progress
        -> 3D route position/tangent
        -> ship yaw/pitch/roll
        -> chase camera
        -> warp intensity from scroll velocity
```

Do not turn this into a timer-driven one-way animation. Forward and reverse scrolling must reconstruct the same world state.

## Files

```text
index.html                  page shell, HUD, native scroll surface
src/live3d.js               Three.js world, route, camera and flight controller
src/ship-stub.js            documented temporary procedural ship asset
docs/LIVE3D_PROTOTYPE.md    prototype contract and final GLB requirements
verify.mjs                  headless regression proof
```

## Ship stub rule

The procedural ship is a documented stub. It exists only to develop movement before the final GLB asset is selected. Do not quietly evolve it into the final production asset. Replace the stub module cleanly when the real ship arrives.

## Engineering rules

- No monkey patching.
- Do not suppress runtime, build, or test errors.
- Replace superseded implementations instead of hiding them behind dead branches in runtime code.
- Keep camera motion calmer than ship motion so aggressive banking does not destroy readability.
- Keep the live experience static-host compatible with GitHub Pages.
- If an external runtime dependency remains during prototyping, document it explicitly and provide a plan to vendor or bundle it before production.
