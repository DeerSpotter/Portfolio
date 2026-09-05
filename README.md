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

## Hiring narrative

The portfolio presents Maxim's engineering judgment and AI-assisted development through specific project decisions. Its six stops cover the hiring case, mechanical design and Teamcenter experience, Vault workflow automation, ContextPort, ipaSim, and the presentation of complex information.

- `index.html` contains the semantic page shell and complete hiring brief.
- `src/portfolio.css` owns the parchment, ink, and orange HTML presentation and responsive reading layouts.
- `src/portfolio-content.js` owns the six concise waypoint stories, with the baseline positions and colors preserved.
- `src/portfolio-ui.js` connects waypoint navigation to native document scroll, updates the current story only when it changes, and manages the native hiring-brief dialog.

The brief explains the problem, design decision, and evidence for each project. ContextPort and ipaSim link to public source and a merged implementation. Vault work is explicitly described as a private project. ipaSim is credited as an active fork extending Jan Joneš's original research; a storage milestone is not presented as completed iOS compatibility. Career statements describe Maxim's experience, without invented impact metrics or customer adoption claims.

The tailored Deepgram section maps that work to the Staff Developer Experience Engineer role. It describes proposed contributions and links to the employer's posting. The rest of the portfolio is written for engineering, developer-tooling, and AI product teams generally. A direct entry to the tailored brief is available at:

```text
https://deerspotter.github.io/Portfolio/?brief=deepgram
```

The brief uses native dialog keyboard behavior, returns focus to its opener, and preserves the flight position while reading. All content and navigation remain available on narrow screens; short viewports scroll their content instead of discarding it. The existing procedural ship is still the documented baseline model. No new stubs, placeholder projects, or monkey patches are introduced.

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

The deployment workflow publishes a validated `_site/` package containing only `index.html` and `src/` from `main` using GitHub Pages Actions. Test dependencies, diagnostics, and repository maintenance files are outside that public package. After a successful deployment the expected project URL is:

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

The same proof also exercises all six waypoint actions, hiring-brief section focus, closing and Escape, focus restoration, independent reading scroll, narrow and short layouts, enlarged text, and the direct Deepgram link. CI serves the public package under `/Portfolio/`, matching GitHub Pages.

Both workflows run `.github/scripts/run-checks.mjs`, which captures the real output of JavaScript syntax checks, npm setup, browser installation, static packaging, and the existing browser proof. The first failed stage stops further validation. `.github/scripts/report-ci.mjs` updates the single `portfolio-baseline-ci` PR comment and writes the job summary; complete output is retained in the `portfolio-diagnostics` artifact. Only then does `.github/scripts/enforce-result.mjs` fail the job normally. GitHub Pages runs use the associated PR conversation when available.

The repository is public. The runner script can also be invoked on a Linux machine with Node, npm, Python, and permission to install Chromium dependencies; the final gate can run there too. PR publication requires GitHub's event environment and a token with issue-comment permission. Fork PR tokens may lack that permission: publication errors remain explicit, and the diagnostic summary and artifact are still retained. CI does not auto-merge or repeatedly poll other workflow runs.

## Procedural orbital instruments

Each waypoint now has a seeded curved instrument shell, swept scanning arcs,
cratered moons, and an asteroid field. `src/procedural-cosmos.js` generates both
these displays and three background planetary systems with depth-sorted belts.
`src/billboard-field.js` replaces the old rectangular flame-corona renderer.
Its two canvas planes share the reading surface's perspective, roll, skew, and
scale; HTML retains scrolling, keyboard access, and the hiring-brief actions.

`src/flame-texture.js` builds a periodic turbulence atlas once for translucent
amber flame flows. `src/engine-plume.js` replaces the solid engine cones with
noise-shaded exhaust rooted at the nozzles. These are visual effects, not physical
combustion simulations. The existing documented procedural ship stub remains.
No new stubs, stock imagery, dependencies, or monkey patches are introduced.
Reduced motion freezes ambient effects; narrow layouts use a compact orbital
frame. Background bodies are cached and asteroid counts have a bounded degraded
mode. The forward chase flight and parchment palette remain the baseline.

## Destination arrivals and ambient travel

Billboard actions now open only their own project content in a dedicated arrival
scene: orbital reception, a Mars engineering colony, lunar archive, Saturn
context exchange, runtime transfer dock, or Europa observatory. The explicit
hiring-brief and Deepgram actions still open the full hiring brief. Destination
content reuses the authoritative section with remapped IDs; other case studies
are not filtered or hidden inside the arrival. Escape and Return to flight
restore focus and retain the scroll location.

`asteroid-traffic.js` maintains a fixed pool of irregular rocks and grey depth
trails driven by elapsed time, independently of the document's travel position.
`destination-scenes.js` renders each setting with its own geometry, palette,
and approach motion. Reduced motion freezes ambient travel. Billboard flame
flows are wider and denser; engine exhaust widens beyond the attached nozzle.

No local tests were run for this change, as requested.

## Stable billboard ownership and technical arrivals

The billboard controller now owns story selection, destination links, chapter
labels, and projected geometry together. The world renderer no longer writes a
competing nearest-stop story into the same HTML card. The UI presents the chosen
story directly, without independently choosing a different stop. Its procedural
shell measures changed content in the same frame; all planes use the same pose
precision. Releasing a reading hold blends back into flight instead of snapping.

Destinations now use a single technical dossier layout: a project headline,
framed live facility viewport, and parallel evidence panels. All original copy
and links remain available, with vertical scrolling on small screens or enlarged
text. The six facilities retain their settings and add articulated service arms,
grippers, assembly platforms and instrument tracks. The scene sizes itself to
its own viewport rather than the browser window. No local tests were run.

### Clickable reading stops

Selecting a waypoint now anchors its reading plane after the approach settles.
Hover or keyboard focus also anchors the currently presented plane. Automatic
coasting pauses during these interactions, while ambient rocks, flames, and
facility animation continue. Explicit flight input outside the billboard
releases the anchor; selecting another waypoint replaces it. This fixes the
reported `#detailAction` stability timeout without forced clicks or longer test
timeouts. No local tests were run for this correction.

Slow-pass mode now remains active during a reading anchor; only automatic
forward travel pauses. The debug state reports `readingHold` and `advancing`
separately. Wheel/keyboard travel over waypoint controls releases the anchor,
and real user input bypasses the synthetic-scroll guard. This corrects the
slow-pass timeout at `verify-time-pocket-browser.mjs:124` without changing its
assertion or timeout. No local tests were run.

## Full-page blueprint arrivals

The arrival canvas again fills the viewport behind the whole page and remains
there while project content scrolls. The corner viewport is replaced, and the
robot-arm module is replaced by `destination-blueprint.js`: seeded mechanical
linework with involute-style gear outlines, pitch circles, bearing races, bolt
patterns, section hatching, exploded coaxial drawings and dimension leaders.
Each destination has a different assembly composition. These are abstract
technical illustrations, not manufacturing drawings. Original planetary and
facility scenery remains behind the blueprint layer, with readable translucent
content surfaces. No local tests were run for this change.