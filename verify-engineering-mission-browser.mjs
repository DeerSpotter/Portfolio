import { chromium } from 'playwright';

const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8231/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function sampleAt(progress) {
  await page.evaluate(value => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * value);
  }, progress);
  await page.waitForFunction(target => {
    const debug = window.__portfolioEngineeringMissionDebug;
    const canvas = window.__portfolioCanvasDebug;
    return debug?.ready && canvas?.ready && Math.abs(canvas.progress - target) < 0.006;
  }, progress, { timeout: 3500 });
  await page.waitForTimeout(120);
  return page.evaluate(() => ({
    story: structuredClone(window.__portfolioEngineeringMissionDebug),
    ship: structuredClone(window.__portfolioShipDebug),
    shipOpacity: document.getElementById('ship3d')?.style.opacity || '',
    overlayCount: document.querySelectorAll('#engineeringMissionThread').length,
  }));
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__portfolioCanvasDebug?.ready
    && window.__portfolioShipDebug?.ready
    && window.__portfolioEngineeringMissionDebug?.ready, null, { timeout: 15000 });

  const uplink = await sampleAt(0.316);
  if (uplink.overlayCount !== 1) throw new Error(`Engineering mission overlay duplicated: ${uplink.overlayCount}`);
  if (!uplink.story.orbitalHandoff?.active || uplink.story.orbitalHandoff.stage !== 'command-uplink') {
    throw new Error(`Command did not transition into uplink: ${JSON.stringify(uplink.story.orbitalHandoff)}`);
  }
  if (Number(uplink.shipOpacity || 1) > 0.05) {
    throw new Error(`Live ship appeared before payload release: opacity=${uplink.shipOpacity}`);
  }

  const relay = await sampleAt(0.342);
  if (relay.story.orbitalHandoff.stage !== 'satellite-relay') {
    throw new Error(`Satellite relay stage missing: ${JSON.stringify(relay.story.orbitalHandoff)}`);
  }
  if (relay.story.orbitalHandoff.relaySequence !== 'ground-to-sat-to-sat-to-vehicle') {
    throw new Error(`Orbital relay lost its causal sequence: ${relay.story.orbitalHandoff.relaySequence}`);
  }

  const launch = await sampleAt(0.378);
  if (launch.story.orbitalHandoff.stage !== 'launch') {
    throw new Error(`Launch stage missing: ${JSON.stringify(launch.story.orbitalHandoff)}`);
  }
  if (Number(launch.shipOpacity || 1) > 0.05) {
    throw new Error(`Existing 3D ship was not held back during launch: opacity=${launch.shipOpacity}`);
  }

  // Separation is intentionally a process rather than a single frame: the
  // fairing opens first, then the payload becomes released later in the same
  // stage. Prove both boundaries instead of requiring release at stage entry.
  const separationStart = await sampleAt(0.417);
  if (separationStart.story.orbitalHandoff.stage !== 'payload-separation') {
    throw new Error(`Payload separation stage missing: ${JSON.stringify(separationStart.story.orbitalHandoff)}`);
  }

  const separationReleased = await sampleAt(0.426);
  if (separationReleased.story.orbitalHandoff.stage !== 'payload-separation'
      || !separationReleased.story.orbitalHandoff.payloadReleased) {
    throw new Error(`Payload did not release during separation: ${JSON.stringify(separationReleased.story.orbitalHandoff)}`);
  }

  const handoff = await sampleAt(0.440);
  if (handoff.story.orbitalHandoff.stage !== 'flight-handoff') {
    throw new Error(`Live flight handoff stage missing: ${JSON.stringify(handoff.story.orbitalHandoff)}`);
  }
  if (handoff.story.orbitalHandoff.transitionTarget !== 'live-3d-ship-screen-position') {
    throw new Error(`Payload did not target the actual 3D ship projection: ${handoff.story.orbitalHandoff.transitionTarget}`);
  }
  if (!(Number(handoff.shipOpacity) > 0.25 && Number(handoff.shipOpacity) < 1)) {
    throw new Error(`Live ship did not fade in through payload handoff: opacity=${handoff.shipOpacity}`);
  }
  if (!Number.isFinite(handoff.ship.ship?.screenX) || !Number.isFinite(handoff.ship.ship?.screenY)) {
    throw new Error(`3D ship screen projection unavailable for handoff: ${JSON.stringify(handoff.ship.ship)}`);
  }

  const normalFlight = await sampleAt(0.49);
  if (normalFlight.story.orbitalHandoff.active) {
    throw new Error(`Orbital prologue failed to release control back to the portfolio flight.`);
  }
  if (normalFlight.shipOpacity !== '') {
    throw new Error(`Ship opacity override survived into normal flight: ${normalFlight.shipOpacity}`);
  }
  if (normalFlight.story.liveShipTransition !== 'normal-flight') {
    throw new Error(`Normal flight did not become the ending loop: ${normalFlight.story.liveShipTransition}`);
  }
  if (normalFlight.story.reparenting !== false || normalFlight.story.proprietaryUI !== false) {
    throw new Error(`Story arc violated isolation/public-concept boundary: ${JSON.stringify(normalFlight.story)}`);
  }

  console.log('[portfolio-engineering-mission] PASS');
  console.log('[portfolio-engineering-mission] arc=design->command->orbit->launch->payload->existing-flight');
  console.log('[portfolio-engineering-mission] transition=live-3d-ship-screen-position');
} finally {
  await browser.close();
}
