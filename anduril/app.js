(() => {
  const drone = document.getElementById('drone');
  const route = document.getElementById('routePath');
  const progressBar = document.getElementById('progressBar');
  const progressLabel = document.getElementById('progressLabel');
  const stops = [...document.querySelectorAll('.stop')];

  if (!drone || !route || !progressBar || !progressLabel || !stops.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const totalStops = Math.max(1, stops.length - 1);
  let ticking = false;
  let lastProgress = 0;

  function pageProgress() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    return Math.max(0, Math.min(1, window.scrollY / max));
  }

  function routePoint(progress) {
    const length = route.getTotalLength();
    const at = Math.max(0, Math.min(length, length * progress));
    const point = route.getPointAtLength(at);
    const before = route.getPointAtLength(Math.max(0, at - 4));
    const after = route.getPointAtLength(Math.min(length, at + 4));
    const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
    return { point, angle };
  }

  function updateDrone(progress) {
    const { point, angle } = routePoint(progress);
    const bob = reducedMotion ? 0 : Math.sin(progress * Math.PI * 22) * 4;
    drone.style.left = `${point.x / 10}%`;
    drone.style.top = `calc(${point.y / 10}% + ${bob}px)`;
    drone.style.transform = `translate(-50%, -50%) rotate(${angle * 0.16}deg)`;
  }

  function closestStop() {
    const center = window.innerHeight * 0.5;
    let best = stops[0];
    let bestDistance = Infinity;

    for (const stop of stops) {
      const rect = stop.getBoundingClientRect();
      const stopCenter = rect.top + rect.height / 2;
      const distance = Math.abs(stopCenter - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = stop;
      }
    }
    return best;
  }

  function updateActiveStop() {
    const active = closestStop();
    stops.forEach(stop => stop.classList.toggle('is-active', stop === active));
    const index = Number(active.dataset.stop || 0);
    progressLabel.textContent = `${String(index).padStart(2, '0')} / ${String(totalStops).padStart(2, '0')}`;
  }

  function render() {
    ticking = false;
    const progress = pageProgress();
    const eased = progress * progress * (3 - 2 * progress);
    lastProgress = eased;
    progressBar.style.width = `${(progress * 100).toFixed(2)}%`;
    updateDrone(eased);
    updateActiveStop();
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(render);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('load', () => {
    lastProgress = pageProgress();
    render();
  }, { once: true });

  render();
})();