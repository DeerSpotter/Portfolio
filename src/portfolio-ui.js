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

export function showWaypoint(waypoint) {
  const index = waypoints.indexOf(waypoint);
  if (index === displayed) return;
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
    // Native scroll remains the sole source of flight progress. Its existing
    // damping provides travel; this does not replace or patch the flight math.
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
  // Move only the dialog scrollport, preserving the flight's scroll position.
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

// These are independent reading scrollports. Their wheel input must not also
// trigger the flight's forward/reverse edge recycling.
for (const region of [brief, document.querySelector('.detail')]) {
  region.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
}

const hud = document.getElementById('hud');
hud.addEventListener('wheel', event => {
  if (hud.scrollHeight > hud.clientHeight + 1) event.stopPropagation();
}, { passive: true });

showWaypoint(waypoints[0]);

// A recruiter can open the general portfolio directly at the tailored brief.
if (new URLSearchParams(location.search).get('brief') === 'deepgram') {
  openBrief('deepgram', document.querySelector('[data-open-brief="deepgram"]'));
}
