import { destinations, createDestinationScene } from './destination-scenes.js';
import { destinationBriefings } from './destination-briefings.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ENTRY_LEAD = 0.72;
const EXIT_TAIL = 0.92;
const EXIT_TRIGGER = 0.78;
const dialog = document.createElement('dialog');
dialog.id = 'destination';
dialog.setAttribute('aria-labelledby', 'destinationTitle');
dialog.innerHTML = `<canvas class="destination-scene" aria-hidden="true"></canvas><div class="destination-layout">
    <header class="destination-header"><div class="destination-ident"><span class="destination-monogram" aria-hidden="true">MT</span><div><p class="eyebrow" id="destinationLocation"></p><p class="destination-subline">Maxim Teleguz / Project systems</p></div></div>
    <form method="dialog"><button class="close-button" aria-label="Exit destination immediately and return to flight">Exit now <span aria-hidden="true">×</span></button></form></header>
    <section class="destination-hero"><div class="destination-heading"><p class="destination-place"></p><h2 id="destinationTitle" tabindex="-1"></h2></div></section>
    <section class="destination-briefing-track" aria-label="Forward flight through project briefing">
      <div class="destination-briefing-sticky">
        <article class="destination-content destination-briefing-card">
          <div class="destination-stage-status"><span class="destination-stage-counter"></span><div class="destination-stage-meter" aria-hidden="true"></div></div>
          <div class="destination-stage-stack">
            <section class="destination-stage-panel" data-layer="0" data-active="false" aria-hidden="true">
              <p class="eyebrow destination-stage-kicker"></p><h3 class="destination-stage-title"></h3><p class="destination-stage-body"></p><div class="destination-stage-visual" aria-hidden="true"></div><p class="destination-stage-proof"></p><div class="destination-stage-links"></div>
            </section>
            <section class="destination-stage-panel" data-layer="1" data-active="false" aria-hidden="true">
              <p class="eyebrow destination-stage-kicker"></p><h3 class="destination-stage-title"></h3><p class="destination-stage-body"></p><div class="destination-stage-visual" aria-hidden="true"></div><p class="destination-stage-proof"></p><div class="destination-stage-links"></div>
            </section>
          </div>
          <p class="destination-scroll-cue">Scroll to fly through the briefing</p>
        </article>
      </div>
    </section>
  </div>`;
document.body.append(dialog);

const scene = createDestinationScene(dialog.querySelector('canvas'));
const track = dialog.querySelector('.destination-briefing-track');
const panels = [...dialog.querySelectorAll('.destination-stage-panel')];
const counter = dialog.querySelector('.destination-stage-counter');
const meter = dialog.querySelector('.destination-stage-meter');
const cue = dialog.querySelector('.destination-scroll-cue');
let opener;
let currentSection = null;
let currentStages = [];
let activeStage = -1;
let layerStages = [null, null];
let scrollFrame = 0;
let departureTimer = 0;
let departing = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderTrace(container, items) {
  const list = document.createElement('ol');
  list.className = 'destination-trace';
  for (const item of items) {
    const entry = document.createElement('li');
    entry.append(textElement('strong', '', item.title), textElement('span', '', item.detail));
    list.append(entry);
  }
  container.append(list);
}

function renderReadout(container, items, type) {
  const grid = document.createElement('div');
  grid.className = type === 'matrix' ? 'destination-matrix' : 'destination-readout';
  for (const item of items) {
    const cell = document.createElement('div');
    cell.append(
      textElement('strong', '', item.value || item.title),
      textElement('span', '', item.label || item.detail),
    );
    grid.append(cell);
  }
  container.append(grid);
}

function renderVisual(panel, visual) {
  const container = panel.querySelector('.destination-stage-visual');
  container.replaceChildren();
  container.removeAttribute('data-visual');
  if (!visual) return;
  container.dataset.visual = visual.type;
  if (visual.type === 'trace') renderTrace(container, visual.items || []);
  else if (visual.type === 'readout' || visual.type === 'matrix') renderReadout(container, visual.items || [], visual.type);
}

function renderLinks(panel, links = []) {
  const container = panel.querySelector('.destination-stage-links');
  container.replaceChildren();
  for (const link of links) {
    const anchor = document.createElement('a');
    anchor.className = 'text-link';
    anchor.href = link.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = `${link.label} ↗`;
    container.append(anchor);
  }
}

function renderStage(panel, stage) {
  panel.querySelector('.destination-stage-kicker').textContent = stage.kicker || '';
  panel.querySelector('.destination-stage-title').textContent = stage.heading || '';
  panel.querySelector('.destination-stage-body').textContent = stage.body || '';
  panel.querySelector('.destination-stage-proof').textContent = stage.proof || '';
  renderVisual(panel, stage.visual);
  renderLinks(panel, stage.links);
}

function stageCenter(index) {
  return index + ENTRY_LEAD;
}

function flightRange() {
  return Math.max(1, stageCenter(currentStages.length - 1) + EXIT_TAIL);
}

function updateProgress(index, flightPosition) {
  const total = currentStages.length;
  counter.textContent = `Brief ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  const first = stageCenter(0);
  const last = stageCenter(total - 1);
  const progress = total <= 1 ? 1 : clamp((flightPosition - first) / Math.max(0.001, last - first), 0, 1);
  meter.style.setProperty('--destination-progress', `${progress * 100}%`);
}

function desiredStageIndices(flightPosition) {
  const base = Math.floor(flightPosition - ENTRY_LEAD);
  const desired = [base, base + 1].filter(index => index >= 0 && index < currentStages.length);
  if (!desired.length && currentStages.length) {
    desired.push(flightPosition < ENTRY_LEAD ? 0 : currentStages.length - 1);
  }
  return [...new Set(desired)];
}

function assignLayers(desired) {
  const usedLayers = new Set();
  const assignments = new Map();

  for (const stageIndex of desired) {
    const existingLayer = layerStages.indexOf(stageIndex);
    if (existingLayer >= 0 && !usedLayers.has(existingLayer)) {
      assignments.set(stageIndex, existingLayer);
      usedLayers.add(existingLayer);
    }
  }

  for (const stageIndex of desired) {
    if (assignments.has(stageIndex)) continue;
    const freeLayer = panels.findIndex((_, index) => !usedLayers.has(index));
    if (freeLayer < 0) continue;
    layerStages[freeLayer] = stageIndex;
    renderStage(panels[freeLayer], currentStages[stageIndex]);
    assignments.set(stageIndex, freeLayer);
    usedLayers.add(freeLayer);
  }

  panels.forEach((panel, layer) => {
    if (!usedLayers.has(layer)) {
      layerStages[layer] = null;
      panel.dataset.active = 'false';
      panel.dataset.readable = 'false';
      panel.setAttribute('aria-hidden', 'true');
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
    }
  });

  return assignments;
}

function poseForDistance(distance, stageIndex) {
  const side = stageIndex % 2 === 0 ? -1 : 1;
  if (reducedMotion) {
    return {
      scale: 1,
      x: 0,
      y: 0,
      yaw: 0,
      opacity: Math.abs(distance) < 0.52 ? 1 : 0,
      blur: 0,
    };
  }

  if (distance >= 0) {
    const t = clamp(distance, 0, 1);
    const eased = t * t * (3 - 2 * t);
    return {
      scale: 1 - 0.48 * eased,
      x: side * 28 * eased,
      y: 96 * eased,
      yaw: side * -8 * eased,
      opacity: clamp(1 - 0.86 * Math.pow(t, 0.82), 0, 1),
      blur: 1.6 * t,
    };
  }

  const t = clamp(-distance, 0, 1);
  return {
    scale: 1 + 0.38 * Math.pow(t, 0.85),
    x: side * -20 * t,
    y: -78 * t,
    yaw: side * 5 * t,
    opacity: clamp(1 - Math.pow(t, 0.68), 0, 1),
    blur: 2.4 * t,
  };
}

function applyPose(panel, stageIndex, flightPosition, isActive) {
  const distance = stageCenter(stageIndex) - flightPosition;
  const pose = poseForDistance(distance, stageIndex);
  const readable = isActive && Math.abs(distance) < 0.46;
  panel.style.setProperty('--destination-flight-scale', pose.scale.toFixed(4));
  panel.style.setProperty('--destination-flight-x', `${pose.x.toFixed(2)}px`);
  panel.style.setProperty('--destination-flight-y', `${pose.y.toFixed(2)}px`);
  panel.style.setProperty('--destination-flight-yaw', `${pose.yaw.toFixed(2)}deg`);
  panel.style.setProperty('--destination-flight-blur', `${pose.blur.toFixed(2)}px`);
  panel.style.opacity = pose.opacity.toFixed(4);
  panel.style.pointerEvents = readable ? 'auto' : 'none';
  panel.dataset.active = isActive ? 'true' : 'false';
  panel.dataset.readable = readable ? 'true' : 'false';
  panel.dataset.stageIndex = String(stageIndex);
  panel.dataset.distance = distance.toFixed(4);
  panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  return { stage: stageIndex, distance, ...pose, readable };
}

function beginDeparture() {
  if (departing || !dialog.open) return;
  departing = true;
  dialog.dataset.departing = 'true';
  cue.textContent = 'Departing to flight';
  window.__portfolioDestinationDebug = {
    ...window.__portfolioDestinationDebug,
    departure: true,
  };
  const delay = reducedMotion ? 0 : 360;
  departureTimer = window.setTimeout(() => {
    departureTimer = 0;
    if (dialog.open) dialog.close('flight-complete');
  }, delay);
}

function syncFlightFromScroll() {
  if (!dialog.open || !currentStages.length || departing) return;
  const viewport = Math.max(1, dialog.clientHeight);
  const start = track.offsetTop - viewport * 0.16;
  const travel = Math.max(1, track.offsetHeight - viewport * 0.84);
  const normalized = clamp((dialog.scrollTop - start) / travel, 0, 1);
  const position = normalized * flightRange();
  const desired = desiredStageIndices(position);
  const assignments = assignLayers(desired);
  const nextActive = clamp(Math.round(position - ENTRY_LEAD), 0, currentStages.length - 1);
  const poses = [];

  for (const stageIndex of desired) {
    const layer = assignments.get(stageIndex);
    if (layer === undefined) continue;
    poses.push(applyPose(panels[layer], stageIndex, position, stageIndex === nextActive));
  }

  activeStage = nextActive;
  updateProgress(activeStage, position);
  const lastCenter = stageCenter(currentStages.length - 1);
  cue.textContent = activeStage === currentStages.length - 1 && position > lastCenter + 0.18
    ? 'Keep scrolling to fly out'
    : 'Scroll to fly through the briefing';

  window.__portfolioDestinationDebug = {
    ready: true,
    section: currentSection,
    stage: activeStage,
    stages: currentStages.length,
    visual: currentStages[activeStage]?.visual?.type || null,
    flightPosition: position,
    normalized,
    entryLead: ENTRY_LEAD,
    exitTail: EXIT_TAIL,
    flightRange: flightRange(),
    layerStages: [...layerStages],
    poses,
    departure: false,
    reparenting: false,
    contract: 'destination-flight-brief-v2',
  };

  if (position >= lastCenter + EXIT_TRIGGER) beginDeparture();
}

function scheduleFlightSync() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    syncFlightFromScroll();
  });
}

export function openDestination(section, trigger) {
  const config = destinations[section];
  const source = section === 'briefTitle' ? document.querySelector('.brief-intro') : document.getElementById(section);
  const stages = destinationBriefings[section];
  if (!config || !source || !stages?.length) throw new Error(`Unknown flight destination: ${section}`);

  opener = trigger;
  currentSection = section;
  currentStages = stages;
  activeStage = -1;
  layerStages = [null, null];
  departing = false;
  dialog.removeAttribute('data-departing');
  dialog.dataset.place = config.kind;
  dialog.dataset.destinationSection = section;
  dialog.style.setProperty('--destination-accent', config.accent);
  track.style.minHeight = `${(stages.length + 1.7) * 100}dvh`;
  track.dataset.entryLead = String(ENTRY_LEAD);
  track.dataset.exitTail = String(EXIT_TAIL);
  track.dataset.flightRange = String(stageCenter(stages.length - 1) + EXIT_TAIL);
  dialog.querySelector('#destinationLocation').textContent = config.name;
  dialog.querySelector('.destination-place').textContent = config.place;
  const heading = source.querySelector('h2, h3');
  dialog.querySelector('#destinationTitle').textContent = heading?.textContent || config.place;
  cue.textContent = 'Scroll to fly through the briefing';

  panels.forEach(panel => {
    panel.dataset.active = 'false';
    panel.dataset.readable = 'false';
    panel.setAttribute('aria-hidden', 'true');
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
  });

  dialog.showModal();
  document.body.classList.add('reading-brief');
  dialog.scrollTop = 0;
  dialog.querySelector('#destinationTitle').focus({ preventScroll: true });
  scene.start(config);
  requestAnimationFrame(syncFlightFromScroll);
}

dialog.addEventListener('scroll', scheduleFlightSync, { passive: true });
dialog.addEventListener('close', () => {
  scene.stop();
  document.body.classList.remove('reading-brief');
  dialog.removeAttribute('data-departing');
  currentSection = null;
  currentStages = [];
  activeStage = -1;
  layerStages = [null, null];
  departing = false;
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  if (departureTimer) clearTimeout(departureTimer);
  scrollFrame = 0;
  departureTimer = 0;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
});
dialog.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
