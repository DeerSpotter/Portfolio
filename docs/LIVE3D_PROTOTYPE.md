# Live 3D flight prototype

This branch replaces the old cartographer-map landing page with a motion-first proof for the new portfolio direction.

## What this prototype proves

- GitHub Pages can host the experience as a static site.
- A real Three.js scene can stay fixed while native browser scrolling drives timeline progress.
- A third-person chase camera can remain calm while the ship banks, pitches, climbs, descends, and turns more aggressively.
- Scroll velocity can influence warp intensity without making timeline position nondeterministic.
- 3D gates and obstacles can move past the camera with real depth and parallax.
- Forward and reverse scrolling both work because the world is derived from scroll progress rather than a one-way animation clock.

## Temporary ship stub

`src/ship-stub.js` is an explicit temporary asset stub. It assembles an original exploration cruiser from Three.js primitives so flight and camera behavior can be developed before the final ship asset exists.

It is **not** intended to become the production ship and must not be presented as final artwork.

The final asset should replace this module with a GLB/GLTF loader while preserving the public ship contract used by `src/live3d.js`:

- a root `THREE.Group` or `THREE.Object3D` controlled by the flight system;
- forward direction aligned with local `-Z`;
- origin near the craft center of mass;
- separate emissive engine material or named engine meshes so warp intensity can be driven at runtime;
- web-optimized mesh and texture sizes;
- no animation requirement for basic banking, yaw, or pitch because those are applied to the root object.

## Runtime dependency

The prototype reuses the repository's existing Three.js delivery model and currently imports `three@0.160.0` from jsDelivr.

That is acceptable for this isolated motion proof. Before the portfolio becomes the production landing page, Three.js should be vendored into the repository or bundled during a reproducible build so the critical experience does not depend on an external CDN.

No backend, database, API key, account, paid host, analytics service, or form service is required for the flight experience itself.

## Controls

Use normal browser scrolling or a trackpad. The page intentionally uses native vertical scrolling instead of intercepting wheel events.

- scroll down: travel forward;
- scroll up: travel backward;
- faster scrolling: temporarily increases warp intensity and camera FOV;
- route curvature determines yaw and pitch;
- lateral curvature produces exaggerated ship banking while the camera remains comparatively level.

## Local run

```bash
python3 -m http.server 8231
# open http://localhost:8231/
```

The page must be served over HTTP because it uses ES modules.

## Next proof after this works

1. Tune route geometry and the ship/camera angular relationship.
2. Replace the procedural ship stub with the selected GLB ship.
3. Add chapter-specific environment palettes.
4. Add one readable portfolio fly-by object.
5. Add one failure encounter driven entirely by timeline progress so reverse scrolling remains deterministic.
