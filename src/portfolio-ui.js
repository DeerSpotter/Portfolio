import { waypoints } from './portfolio-content.js';

const brief = document.getElementById('hiringBrief');
const navigation = [...document.querySelectorAll('[data-stop]')];
const fields = {
  kicker: document.getElementById('detailKicker'),
  heading: document.getElementById('detailTitle'),
  body: document.getElementById('detailBody'),
  proof: document.getElementById('detailProof'),
};
const action = document.getElementById('detailAction');
let displayed = -1;
let returnFocus = null;

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function wrapSigned(value) {
  let wrapped = wrap01(value);
  if (wrapped > 0.5) wrapped -= 1;
  return wrapped;
}

function stopForCurrentScroll() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const progress = scrollY / maxScroll;
  return waypoints.reduce((best, stop) => {
    const distance = Math.abs(wrapSigned(stop.at - progress));
    return !best || distance < best.distance ? { stop, distance } : best;
  }, null).stop;
}

function resolvedWaypoint(requested) {
  const lockedTitle = window.__portfolioTimePocketDebug?.lockedStop;
  if (!lockedTitle) return requested;
  return waypoints.find(stop => stop.title === lockedTitle) || requested;
}

export function showWaypoint(requestedWaypoint) {
  const waypoint = resolvedWaypoint(requestedWaypoint);
  const index = waypoints.indexOf(waypoint);
  if (index < 0 || index === displayed) return;

  displayed = index;
  for (const [key, element] of Object.entries(fields)) element.textContent = waypoint[key];
  action.textContent = `${waypoint.action} ↗`;
  action.dataset.openBrief = waypoint.section;
  document.getElementById('chapterName').textContent = waypoint.title;
  document.getElementById('waypointStatus').textContent = `Waypoint ${index + 1} of ${waypoints.length}: ${waypoint.title}`;
  document.querySelector('.detail').scrollTop = 0;
  navigation.forEach((button, i) => {
    if (i === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

navigation.forEach(button => {
  button.addEventListener('click', () => {
    const waypoint = waypoints[Number(button.dataset.stop)];
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
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
  const trigger = event.target.closest('[data-open-brief]');
  if (trigger) openBrief(trigger.dataset.openBrief, trigger);
});

brief.addEventListener('close', () => {
  document.body.classList.remove('reading-brief');
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
});

for (const region of [brief, document.querySelector('.detail')]) {
  region.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
}

const hud = document.getElementById('hud');
hud.addEventListener('wheel', event => {
  if (hud.scrollHeight > hud.clientHeight + 1) event.stopPropagation();
}, { passive: true });

// Never hard-reset the panel to waypoint 01. Browsers can restore a previous
// scroll position before or just after module startup, so initialize from the
// actual flight position and resynchronize again on pageshow.
showWaypoint(stopForCurrentScroll());
addEventListener('pageshow', () => showWaypoint(stopForCurrentScroll()), { once: true });

if (new URLSearchParams(location.search).get('brief') === 'deepgram') {
  openBrief('deepgram', document.querySelector('[data-open-brief="deepgram"]'));
}
