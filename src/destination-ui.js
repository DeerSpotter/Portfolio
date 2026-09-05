import { destinations, createDestinationScene } from './destination-scenes.js';
import { destinationBriefings } from './destination-briefings.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const dialog = document.createElement('dialog');
dialog.id = 'destination';
dialog.setAttribute('aria-labelledby', 'destinationTitle');
dialog.innerHTML = `<canvas class="destination-scene" aria-hidden="true"></canvas><div class="destination-layout">
    <header class="destination-header"><div class="destination-ident"><span class="destination-monogram" aria-hidden="true">MT</span><div><p class="eyebrow" id="destinationLocation"></p><p class="destination-subline">Maxim Teleguz / Project systems</p></div></div>
    <form method="dialog"><button class="close-button" aria-label="Close destination and return to flight">Return to flight <span aria-hidden="true">×</span></button></form></header>
    <section class="destination-hero"><div class="destination-heading"><p class="destination-place"></p><h2 id="destinationTitle" tabindex="-1"></h2></div></section>
    <section class="destination-briefing-track" aria-label="Scroll staged project briefing">
      <div class="destination-briefing-sticky">
        <article class="destination-content destination-briefing-card">
          <div class="destination-stage-status"><span class="destination-stage-counter"></span><div class="destination-stage-meter" aria-hidden="true"></div></div>
          <div class="destination-stage-stack">
            <section class="destination-stage-panel" data-layer="0" data-active="true">
              <p class="eyebrow destination-stage-kicker"></p><h3 class="destination-stage-title"></h3><p class="destination-stage-body"></p><div class="destination-stage-visual" aria-hidden="true"></div><p class="destination-stage-proof"></p><div class="destination-stage-links"></div>
            </section>
            <section class="destination-stage-panel" data-layer="1" data-active="false">
              <p class="eyebrow destination-stage-kicker"></p><h3 class="destination-stage-title"></h3><p class="destination-stage-body"></p><div class="destination-stage-visual" aria-hidden="true"></div><p class="destination-stage-proof"></p><div class="destination-stage-links"></div>
            </section>
          </div>
          <p class="destination-scroll-cue">Scroll to advance the briefing</p>
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
let opener;
let currentSection = null;
let currentStages = [];
let displayedStage = -1;
let activeLayer = 0;
let scrollFrame = 0;

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

function updateProgress(index) {
  const total = currentStages.length;
  counter.textContent = `Brief ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  meter.style.setProperty('--destination-progress', `${((index + 1) / total) * 100}%`);
}

function showStage(index, { immediate = false } = {}) {
  if (!currentStages.length) return;
  const nextIndex = clamp(index, 0, currentStages.length - 1);
  if (nextIndex === displayedStage) return;

  updateProgress(nextIndex);
  const stage = currentStages[nextIndex];
  if (immediate || reducedMotion || displayedStage < 0) {
    const panel = panels[activeLayer];
    renderStage(panel, stage);
    panels.forEach((candidate, i) => candidate.dataset.active = i === activeLayer ? 'true' : 'false');
  } else {
    const outgoing = panels[activeLayer];
    const incomingLayer = activeLayer === 0 ? 1 : 0;
    const incoming = panels[incomingLayer];
    outgoing.getAnimations().forEach(animation => animation.cancel());
    incoming.getAnimations().forEach(animation => animation.cancel());
    renderStage(incoming, stage);
    incoming.dataset.active = 'true';
    outgoing.dataset.active = 'false';
    incoming.animate([
      { opacity: 0, transform: 'translateY(10px) scale(.992)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 230, easing: 'cubic-bezier(.2,.75,.25,1)' });
    outgoing.animate([
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-8px) scale(1.006)' },
    ], { duration: 150, easing: 'ease-out' });
    activeLayer = incomingLayer;
  }

  displayedStage = nextIndex;
  dialog.dataset.destinationStage = String(nextIndex);
  window.__portfolioDestinationDebug = {
    ready: true,
    section: currentSection,
    stage: nextIndex,
    stages: currentStages.length,
    visual: stage.visual?.type || null,
    reparenting: false,
    contract: 'destination-scroll-brief-v1',
  };
}

function stageFromScroll() {
  if (!dialog.open || !currentStages.length) return;
  const viewport = Math.max(1, dialog.clientHeight);
  const trackTop = track.offsetTop;
  const start = trackTop - viewport * 0.28;
  const travel = Math.max(1, track.offsetHeight - viewport * 0.72);
  const progress = clamp((dialog.scrollTop - start) / travel, 0, 0.9999);
  const stage = Math.min(currentStages.length - 1, Math.floor(progress * currentStages.length));
  showStage(stage);
}

function scheduleStageSync() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    stageFromScroll();
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
  displayedStage = -1;
  activeLayer = 0;
  dialog.dataset.place = config.kind;
  dialog.dataset.destinationSection = section;
  dialog.style.setProperty('--destination-accent', config.accent);
  track.style.setProperty('--destination-stage-count', String(stages.length));
  dialog.querySelector('#destinationLocation').textContent = config.name;
  dialog.querySelector('.destination-place').textContent = config.place;
  const heading = source.querySelector('h2, h3');
  dialog.querySelector('#destinationTitle').textContent = heading?.textContent || config.place;

  panels[0].dataset.active = 'true';
  panels[1].dataset.active = 'false';
  showStage(0, { immediate: true });
  dialog.showModal();
  document.body.classList.add('reading-brief');
  dialog.scrollTop = 0;
  dialog.querySelector('#destinationTitle').focus({ preventScroll: true });
  scene.start(config);
  requestAnimationFrame(stageFromScroll);
}

dialog.addEventListener('scroll', scheduleStageSync, { passive: true });
dialog.addEventListener('close', () => {
  scene.stop();
  document.body.classList.remove('reading-brief');
  currentSection = null;
  currentStages = [];
  displayedStage = -1;
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
});
dialog.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
