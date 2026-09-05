import { destinations, createDestinationScene } from './destination-scenes.js';

const dialog = document.createElement('dialog');
dialog.id = 'destination';
dialog.setAttribute('aria-labelledby', 'destinationTitle');
dialog.innerHTML = `<canvas class="destination-scene" aria-hidden="true"></canvas>
  <div class="destination-layout">
    <header class="destination-header"><p class="eyebrow" id="destinationLocation"></p>
    <form method="dialog"><button class="close-button" aria-label="Close destination and return to flight">Return to flight <span aria-hidden="true">×</span></button></form></header>
    <div class="destination-reading"><p class="destination-place"></p><h2 id="destinationTitle" tabindex="-1"></h2>
    <article class="destination-content"></article></div>
  </div>`;
document.body.append(dialog);
const scene = createDestinationScene(dialog.querySelector('canvas'));
let opener;

export function openDestination(section, trigger) {
  const config = destinations[section];
  const source = section === 'briefTitle' ? document.querySelector('.brief-intro') : document.getElementById(section);
  if (!config || !source) throw new Error(`Unknown flight destination: ${section}`);
  opener = trigger;
  dialog.dataset.place = config.kind;
  dialog.style.setProperty('--destination-accent', config.accent);
  dialog.querySelector('#destinationLocation').textContent = config.name;
  dialog.querySelector('.destination-place').textContent = config.place;
  const copy = source.cloneNode(true);
  // Remap copied IDs and references so the full hiring brief stays valid.
  for (const element of [copy, ...copy.querySelectorAll('[id]')]) {
    if (element.id) element.id = `destination-${element.id}`;
  }
  for (const element of [copy, ...copy.querySelectorAll('[aria-labelledby], [href^="#"]')]) {
    const label = element.getAttribute('aria-labelledby');
    if (label) element.setAttribute('aria-labelledby', label.split(' ').map(id => `destination-${id}`).join(' '));
    const href = element.getAttribute('href');
    if (href?.startsWith('#')) element.setAttribute('href', `#destination-${href.slice(1)}`);
  }
  const heading = copy.querySelector('h2, h3');
  dialog.querySelector('#destinationTitle').textContent = heading.textContent;
  // Move the real section heading into the destination heading instead of
  // duplicating it or rendering other projects behind a filter.
  heading.remove();
  dialog.querySelector('.destination-content').replaceChildren(copy);
  dialog.showModal();
  document.body.classList.add('reading-brief');
  dialog.scrollTop = 0;
  dialog.querySelector('#destinationTitle').focus({ preventScroll: true });
  scene.start(config);
}

dialog.addEventListener('close', () => {
  scene.stop(); document.body.classList.remove('reading-brief');
  if (opener?.isConnected) opener.focus({ preventScroll: true });
});
dialog.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
