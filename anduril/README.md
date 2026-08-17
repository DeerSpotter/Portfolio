# Anduril recruiter journey prototype

This prototype is intentionally isolated under `/anduril/` on the `portfolio` branch.

## Preview locally

From the repository root:

```bash
python -m http.server 8231
```

Open:

```text
http://localhost:8231/anduril/
```

## Prototype intent

The page turns Maxim Teleguz's project history into a scroll driven mission route:

1. Physical systems and mechanical design
2. Teamcenter and NX PLM operations
3. Engineering automation
4. Public source tooling
5. Mission Architecture CONOPS Simulator
6. Secure recruiter briefing handoff

A drone is the continuous traveler. Scroll position drives the drone along the route and updates the waypoint HUD.

The final button currently opens the separate `Greyframe-Labs/secure-project-brief` GitHub Pages site. During the next integration pass, the project route can become the front half of that secure project brief so the encrypted video appears natively at the end instead of opening as a separate page.

## Safety and publication note

This is candidate supplied material. It does not use classification markings and does not imply Anduril affiliation. Review all program and project wording before publishing the branch as a recruiter facing public page.