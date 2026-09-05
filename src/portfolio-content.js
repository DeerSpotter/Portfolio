// Preserve the baseline positions, colors, sides, and lifts. The narrative
// describes real work; the documented procedural ship remains the only stub.
export const waypoints = [
  {
    at: 0.04, title: 'Start here', color: '#cf6f2f', side: -0.20, lift: -0.02,
    kicker: '01 / The case for hiring me',
    heading: 'Give AI someone who knows what matters.',
    body: 'I bring the judgment of someone who has designed hardware, untangled engineering workflows, and helped teams use difficult systems. AI lets me turn that experience into software.',
    proof: 'My advantage is connecting the problem, the implementation, and the person who has to use the result.',
    action: 'See the hiring case', section: 'briefTitle',
  },
  {
    at: 0.18, title: 'Engineering', color: '#66713f', side: 0.66, lift: -0.16,
    kicker: '02 / Engineering foundations',
    heading: 'The constraints are real. So is the experience.',
    body: '15+ years in mechanical design taught me to think about fit, manufacturing, revisions, and downstream consequences. Solving NX model and assembly problems led me into Teamcenter administration.',
    proof: 'I move between the person doing the work and the system supporting them. That perspective shapes what I build.',
    action: 'Follow the engineering thread', section: 'engineering',
  },
  {
    at: 0.34, title: 'Vault automation', color: '#4c6378', side: -0.68, lift: 0.10,
    kicker: '03 / Vault PDF History Export',
    heading: 'Turn repeated searches into a usable workflow.',
    body: 'Engineering history gets scattered across drawings, revisions, and change records. My Vault tool brings the review process, documentation, and metrics into one application.',
    proof: 'A code map connects features to their implementation. Understanding and maintaining the tool is part of its design.',
    action: 'Read the automation case study', section: 'automation',
  },
  {
    at: 0.51, title: 'ContextPort', color: '#694f66', side: 0.62, lift: -0.05,
    kicker: '04 / ContextPort · Public source',
    heading: 'Keep the context. Change the AI.',
    body: 'I built ContextPort around the friction of repeating project history. It carries revisioned, device-local Memory between AI providers while keeping their sessions isolated.',
    proof: 'The iOS source includes Markdown and PDF export, five providers, and checks that reject unsafe conversation captures.',
    action: 'Explore the product decisions', section: 'contextport',
  },
  {
    at: 0.69, title: 'ipaSim', color: '#96543f', side: -0.62, lift: 0.14,
    kicker: '05 / ipaSim · Active open-source fork',
    heading: 'Fix the boundary causing the failure.',
    body: 'When Windows could not reproduce a runtime’s filesystem, the useful change was architectural: read the image directly. My work on the ipaSim fork advances that path with AI-assisted development.',
    proof: 'Merged PR #78 proves the storage path and records the next unresolved import. Progress comes with inspectable evidence.',
    action: 'Inspect the runtime case study', section: 'ipasim',
  },
  {
    at: 0.85, title: 'Clarity', color: '#a9792f', side: 0.68, lift: 0.05,
    kicker: '06 / Information people can use',
    heading: 'Simplicity is an engineering outcome.',
    body: 'Maps, records, coverage, and source references should help someone make a decision. I design the path from the big picture to the evidence, then make the next action clear.',
    proof: 'That thread runs through my simulation work, review tools, and this portfolio: make complexity understandable.',
    action: 'See how I think and present', section: 'clarity',
  },
];
