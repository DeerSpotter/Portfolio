import { waypoints } from './portfolio-content.js';
import { openDestination } from './destination-ui.js';

const brief = document.getElementById('hiringBrief');
const billboard = document.querySelector('.detail');
const navigation = [...document.querySelectorAll('[data-stop]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fields = {
  kicker: document.getElementById('detailKicker'),
  heading: document.getElementById('detailTitle'),
  body: document.getElementById('detailBody'),
  proof: document.getElementById('detailProof'),
};
const action = document.getElementById('detailAction');
const status = document.getElementById('waypointStatus');
let displayed = -1;
let displayedStage = -1;
let stageWaypoint = null;
let returnFocus = null;

// Keep the existing billboard element and pose. Only its internal reading surface
// becomes a staged briefing. No page shell or flight-scene markup is replaced.
const panelShell = document.createElement('div');
panelShell.className = 'arrival-panel-shell';
const panel = document.createElement('div');
panel.className = 'arrival-panel';
const visual = document.createElement('div');
visual.className = 'arrival-visual';
const detailHeading = billboard.querySelector('.detail-heading');
billboard.insertBefore(panelShell, detailHeading);
panelShell.append(panel);
panel.append(detailHeading, fields.heading, fields.body, visual, fields.proof);
billboard.dataset.briefingSequence = 'true';

function stripIds(root) {
  if (root.id) root.removeAttribute('id');
  for (const element of root.querySelectorAll('[id]')) element.removeAttribute('id');
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderTrace(config) {
  const list = document.createElement('ol');
  list.className = 'arrival-trace';
  for (const item of config.items || []) {
    const entry = document.createElement('li');
    entry.append(
      textElement('strong', '', item.title),
      textElement('span', '', item.detail),
    );
    list.append(entry);
  }
  visual.append(list);
}

function renderReadout(config) {
  const grid = document.createElement('div');
  grid.className = 'arrival-readout';
  for (const item of config.items || []) {
    const cell = document.createElement('div');
    cell.append(
      textElement('strong', '', item.value),
      textElement('span', '', item.label),
    );
    grid.append(cell);
  }
  visual.append(grid);
}

function renderMatrix(config) {
  const grid = document.createElement('div');
  grid.className = 'arrival-matrix';
  for (const item of config.items || []) {
    const cell = document.createElement('div');
    cell.append(
      textElement('strong', '', item.title),
      textElement('span', '', item.detail),
    );
    grid.append(cell);
  }
  visual.append(grid);
}

function renderVisual(config) {
  visual.replaceChildren();
  visual.removeAttribute('data-visual');
  if (!config) return;
  visual.dataset.visual = config.type;
  if (config.type === 'trace') renderTrace(config);
  else if (config.type === 'readout') renderReadout(config);
  else if (config.type === 'matrix') renderMatrix(config);
}

function applyStage(stage) {
  for (const [key, element] of Object.entries(fields)) element.textContent = stage[key] || '';
  renderVisual(stage.visual);
}

function transitionToStage(stage, immediate) {
  if (immediate || reducedMotion || displayedStage < 0) {
    applyStage(stage);
    return;
  }

  // Crossfade with a short-lived visual copy so the outgoing briefing actually
  // fades away while the replacement resolves in the same physical card.
  const ghost = panel.cloneNode(true);
  stripIds(ghost);
  ghost.classList.add('arrival-panel-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  panelShell.append(ghost);

  applyStage(stage);
  panel.getAnimations().forEach(animation => animation.cancel());
  panel.animate([
    { opacity: 0, transform: 'translateY(7px) scale(.988)' },
    { opacity: 1, transform: 'translateY(0) scale(1)' },
  ], {
    duration: 260,
    delay: 35,
    easing: 'cubic-bezier(.2,.75,.25,1)',
    fill: 'both',
  });

  const outgoing = ghost.animate([
    { opacity: 1, transform: 'translateY(0) scale(1)' },
    { opacity: 0, transform: 'translateY(-5px) scale(1.008)' },
  ], {
    duration: 165,
    easing: 'ease-out',
    fill: 'forwards',
  });
  outgoing.finished.catch(() => {}).finally(() => ghost.remove());
}

export function showWaypoint(requestedWaypoint) {
  // The billboard controller selects once for content, pose, and destination.
  const waypoint = requestedWaypoint;
  const index = waypoints.indexOf(waypoint);
  if (index < 0 || index === displayed) return;

  displayed = index;
  displayedStage = -1;
  stageWaypoint = waypoint;
  action.textContent = `${waypoint.action} ↗`;
  action.dataset.destination = waypoint.section;
  document.getElementById('chapterName').textContent = waypoint.title;
  billboard.scrollTop = 0;
  navigation.forEach((button, i) => {
    if (i === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  showWaypointStage(waypoint, 0, { immediate: true });
}

export function showWaypointStage(waypoint, requestedStage, { immediate = false } = {}) {
  const stages = waypoint.briefing?.length ? waypoint.briefing : [waypoint];
  const stageIndex = Math.max(0, Math.min(stages.length - 1, requestedStage));
  if (stageWaypoint === waypoint && displayedStage === stageIndex) return;

  if (stageWaypoint !== waypoint) {
    stageWaypoint = waypoint;
    displayedStage = -1;
  }

  transitionToStage(stages[stageIndex], immediate);
  displayedStage = stageIndex;
  billboard.dataset.cardStage = String(stageIndex);
  billboard.dataset.cardStageCount = String(stages.length);

  const waypointIndex = waypoints.indexOf(waypoint);
  status.textContent = `Waypoint ${waypointIndex + 1} of ${waypoints.length}: ${waypoint.title} · Brief ${stageIndex + 1} of ${stages.length}`;
  window.__portfolioArrivalDebug = {
    ready: true,
    waypoint: waypoint.title,
    stage: stageIndex,
    stages: stages.length,
    visual: stages[stageIndex].visual?.type || null,
    contract: 'scroll-staged-arrival-brief-v1',
  };
}

function stageForDepth(waypoint, depth) {
  const count = waypoint.briefing?.length || 1;
  if (count <= 1) return 0;
  // The existing billboard approaches through roughly t=.34 to t=.78. Divide
  // only that readable approach into briefing beats; the world timeline stays
  // untouched and reverse scrolling naturally walks the same beats backward.
  const progress = Math.max(0, Math.min(0.9999, (depth - 0.36) / 0.42));
  return Math.min(count - 1, Math.floor(progress * count));
}

function syncBriefingSequence() {
  const debug = window.__portfolioBillboardDebug;
  if (debug?.ready) {
    const waypoint = waypoints.find(candidate => candidate.title === debug.stop);
    if (waypoint && waypoints.indexOf(waypoint) === displayed) {
      showWaypointStage(waypoint, stageForDepth(waypoint, debug.depth));
    }
  }
  requestAnimationFrame(syncBriefingSequence);
}
requestAnimationFrame(syncBriefingSequence);

navigation.forEach(button => {
  button.addEventListener('click', () => {
    const waypoint = waypoints[Number(button.dataset.stop)];
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    window.dispatchEvent(new CustomEvent('portfolio:waypoint-navigation', { detail: { title: waypoint.title } }));
    window.scrollTo({ top: maxScroll * waypoint.at, behavior: 'instant' });
  });
});

function openBrief(section, trigger) {
  const target = document.getElementById(section);
  if (!target || !brief.contains(target)) throw new Error(`Unknown hiring brief section: ${section}`);
  returnFocus = trigger;
  brief.showModal();
  document.body.classList.add('reading-brief');
  target.focus({ preventScroll: true });
  const top = section === 'briefTitle' ? 0 : brief.scrollTop + target.getBoundingClientRect().top - brief.getBoundingClientRect().top - 90;
  brief.scrollTo({ top, behavior: 'instant' });
}

document.addEventListener('click', event => {
  const destination = event.target.closest('[data-destination]');
  if (destination) {
    if (destination.getAttribute('aria-disabled') !== 'true') openDestination(destination.dataset.destination, destination);
    return;
  }
  const trigger = event.target.closest('[data-open-brief]');
  if (trigger) openBrief(trigger.dataset.openBrief, trigger);
});

billboard.addEventListener('click', event => {
  if (event.target.closest('button, a') || billboard.dataset.interactive !== 'true') return;
  openDestination(action.dataset.destination, billboard);
});
billboard.addEventListener('keydown', event => {
  if (event.target !== billboard || billboard.dataset.interactive !== 'true') return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openDestination(action.dataset.destination, billboard);
  }
});

brief.addEventListener('close', () => {
  document.body.classList.remove('reading-brief');
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
});

for (const region of [brief, billboard]) {
  region.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
}

const hud = document.getElementById('hud');
hud.addEventListener('wheel', event => {
  if (hud.scrollHeight > hud.clientHeight + 1) event.stopPropagation();
}, { passive: true });

if (new URLSearchParams(location.search).get('brief') === 'deepgram') {
  openBrief('deepgram', document.querySelector('[data-open-brief="deepgram"]'));
}
