# Maxim Teleguz — Live 3D Portfolio Flight

This repository is being rebuilt as a scroll-driven third-person 3D portfolio experience.

The active prototype lives on `feature/cinematic-portfolio-map` and intentionally starts with the smallest difficult problem: **can normal browser scrolling drive a stable, smooth 3D world with a ship and chase camera?**

## Current prototype

The prototype includes:

- a live Three.js scene;
- a third-person exploration ship;
- native scroll mapped to deterministic route progress;
- a curved 3D Catmull-Rom flight path;
- smooth yaw, pitch, and exaggerated banking;
- a calmer chase camera that follows independently of ship roll;
- scroll-velocity-driven warp intensity and FOV;
- star field, sector gates, and lightweight obstacle geometry for depth/parallax;
- a small live telemetry overlay;
- forward and reverse timeline travel.

The current ship is a **documented procedural stub**, not the final portfolio asset. See [`docs/LIVE3D_PROTOTYPE.md`](docs/LIVE3D_PROTOTYPE.md).

## Run locally

```bash
python3 -m http.server 8231
```

Open `http://localhost:8231/` and scroll.

## Why native scroll

Scroll position is the timeline source of truth. The scene damps toward that target, which keeps movement cinematic while preserving deterministic navigation and reverse scrolling.

```text
scroll position
   -> target progress
   -> damped progress
   -> route point + tangent
   -> ship attitude
   -> chase camera
   -> environment state
```

## GitHub Pages

The experience is designed to remain static-host compatible. No backend or database is required.

The motion prototype currently reuses the previous site's external `three@0.160.0` jsDelivr dependency. Before this becomes the production landing page, Three.js should be vendored or reproducibly bundled into the repository so the critical experience is self-contained.
