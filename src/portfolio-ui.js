import { waypoints } from './portfolio-content.js';
import { openDestination } from './destination-ui.js';

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

export function showWaypoint(requestedWaypoint) {
  // The billboard controller selects once for content, pose, and destination.
  const waypoint = requestedWaypoint;
  const index = waypoints.indexOf(waypoint);
  if (index < 0 || index === displayed) return;

  displayed = index;
  for (const [key, element] of Object.entries(fields)) element.textContent = waypoint[key];
  action.textContent = `${waypoint.action} ↗`;
  action.dataset.destination = waypoint.section;
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
  const destination = event.target.closest('[data-destination]');
  if (destination) {
    if (destination.getAttribute('aria-disabled') !== 'true') openDestination(destination.dataset.destination, destination);
    return;
  }
  const trigger = event.target.closest('[data-open-brief]');
  if (trigger) openBrief(trigger.dataset.openBrief, trigger);
});

const billboard = document.querySelector('.detail');
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

for (const region of [brief, document.querySelector('.detail')]) {
  region.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
}

const hud = document.getElementById('hud');
hud.addEventListener('wheel', event => {
  if (hud.scrollHeight > hud.clientHeight + 1) event.stopPropagation();
}, { passive: true });

// Content initialization and restored-scroll updates belong to billboard-flight.
// A separate nearest-stop writer would mismatch content and projected depth.

if (new URLSearchParams(location.search).get('brief') === 'deepgram') {
  openBrief('deepgram', document.querySelector('[data-open-brief="deepgram"]'));
}
