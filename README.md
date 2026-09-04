# Maxim Teleguz — Illustrated 2.5D Portfolio Flight

This repository now uses the **hybrid illustrated-flight implementation as the baseline going forward**.

The core experience is a lightweight illustrated 2.5D canvas world with the original procedural Three.js ship flying through it in the same forward third-person chase style established by the first live-3D prototype.

## Baseline architecture

The production direction is intentionally split into three layers:

- **Canvas 2D / 2.5D world** for the parchment background, stylized planets and rings, perspective guide, waypoints, trailing ink lines, waypoint curls, and scroll-driven environment motion.
- **Three.js ship layer** for the procedural 3D ship only.
- **HTML HUD/content layer** for readable portfolio information.

```text
HTML portfolio content / HUD
            ↓
transparent Three.js ship layer
            ↓
illustrated Canvas 2D / 2.5D world
            ↓
native browser scroll
```

This is the baseline for future work. New visual and portfolio features should build on this hybrid architecture rather than restoring the old fully 3D environment unless there is a specific reason to do so.

## Flight behavior

The ship preserves the movement language from the original live-3D prototype:

- forward third-person chase perspective
- perspective camera behind and above the ship
- original closed Catmull-Rom 3D route used as movement math
- smooth yaw and pitch
- expressive banking and roll
- scroll-velocity-driven warp response
- chase-camera pullback and look-ahead during faster travel
- seamless forward and reverse looping

The 3D route itself is not rendered. It exists only to drive the ship and chase camera.

## Illustrated world

The environment remains deliberately lightweight and stylized:

- parchment / cream background
- dark ink linework
- fox-orange and rust accents
- muted olive, blue, plum, and gold secondary colors
- cartoon planets and rings
- perspective drafting marks
- portfolio waypoints
- trailing ink lines that curl around active waypoints

The old 3D stars, nebulae, gates, moons, asteroids, obstacle fields, energy ribbons, and 3D warp geometry are not part of the baseline.

## Run locally

From the local clone:

```bat
cd /d "C:\Portfolio"
git pull origin main
python -m http.server 8231
```

Open:

```text
http://localhost:8231
```

## GitHub Pages

The site is designed to run as a static GitHub Pages project site with no backend or database.

The deployment workflow publishes the repository root from `main` using GitHub Pages Actions. After a successful deployment the expected project URL is:

```text
https://deerspotter.github.io/Portfolio/
```

All site-owned module and asset paths are relative so the project works correctly under the `/Portfolio/` project-site prefix.

The only external runtime dependency currently retained is `three@0.160.0` from jsDelivr. The architecture remains GitHub Pages compatible with that dependency, although vendoring or reproducibly bundling Three.js later would make the portfolio fully self-contained.

## Validation

The browser proof protects the baseline contracts:

- illustrated background remains Canvas 2D
- palette remains `fox-paper-earth`
- canvas movement remains `forward-chase-perspective`
- ship remains `documented-procedural-stub-v2`
- ship flight remains `original-live3d-third-person-chase`
- ship camera remains perspective
- old rendered 3D world item count remains zero
- canvas and ship progress remain synchronized
- waypoint trail curl still works
- forward and reverse seamless looping still work
