import { spawn } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

mkdirSync('.ci-results', { recursive: true });
const logPath = '.ci-results/diagnostic.txt';
writeFileSync(logPath, 'Portfolio validation\n');
let stage = 'Initialize validation';
let server;
let serverError;
let result = { status: 1, stage };

function log(text) {
  appendFileSync(logPath, text);
  process.stdout.write(text);
}

async function run(label, command, args) {
  stage = label;
  log(`\n[stage] ${stage}\n$ ${command} ${args.join(' ')}\n`);
  await new Promise((accept, reject) => {
    const child = spawn(command, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => log(chunk.toString()));
    child.stderr.on('data', chunk => log(chunk.toString()));
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) accept();
      else reject(new Error(`${stage} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
    });
  });
}

try {
  for (const directory of ['src', '.github/scripts']) {
    for (const file of readdirSync(directory).filter(name => /\.m?js$/.test(name))) {
      await run(`Syntax: ${directory}/${file}`, process.execPath, ['--check', `${directory}/${file}`]);
    }
  }
  await run('Syntax: browser proof', process.execPath, ['--check', 'verify-canvas.mjs']);
  await run('Syntax: ship bank browser proof', process.execPath, ['--check', 'verify-ship-smoothness-browser.mjs']);
  await run('Syntax: billboard browser proof', process.execPath, ['--check', 'verify-billboard-browser.mjs']);
  await run('Syntax: destination browser proof', process.execPath, ['--check', 'verify-destination-browser.mjs']);
  await run('Syntax: mobile destination browser proof', process.execPath, ['--check', 'verify-mobile-destination-browser.mjs']);
  await run('Syntax: mobile browser proof', process.execPath, ['--check', 'verify-mobile-browser.mjs']);
  await run('Syntax: mobile loop touch proof', process.execPath, ['--check', 'verify-mobile-loop-touch-browser.mjs']);
  await run('Syntax: time-pocket browser proof', process.execPath, ['--check', 'verify-time-pocket-browser.mjs']);
  await run('Layered scenery contract', process.execPath, ['.github/scripts/verify-scenery.mjs']);
  await run('Interactive billboard contract', process.execPath, ['.github/scripts/verify-billboard.mjs']);
  await run('Scene-spanning ribbon contract', process.execPath, ['.github/scripts/verify-ribbon.mjs']);
  await run('Cinematic time-pocket contract', process.execPath, ['.github/scripts/verify-time-pocket.mjs']);
  await run('Mobile loop touch contract', process.execPath, ['verify-mobile-loop-touch-browser.mjs']);
  await run('Prepare browser test dependency', 'npm', ['init', '-y']);
  await run('Install pinned Playwright', 'npm', ['install', '--no-save', '--package-lock=false', 'playwright@1.55.0']);
  await run('Install Chromium and system dependencies', 'npx', ['playwright', 'install', '--with-deps', 'chromium']);

  stage = 'Package public site';
  log(`\n[stage] ${stage}\n`);
  mkdirSync('_site', { recursive: true });
  cpSync('index.html', '_site/index.html');
  cpSync('src', '_site/src', { recursive: true });
  // Serve the exact public package under the real GitHub Pages project prefix.
  const previewRoot = mkdtempSync(join(tmpdir(), 'portfolio-ci-'));
  symlinkSync(resolve('_site'), join(previewRoot, 'Portfolio'), 'dir');
  stage = 'Start packaged site';
  server = spawn('python3', ['-u', '-m', 'http.server', '8231', '--bind', '127.0.0.1', '--directory', previewRoot], { stdio: ['ignore', 'pipe', 'pipe'] });
  const serverLog = chunk => appendFileSync('.ci-results/server.txt', chunk);
  server.stdout.on('data', serverLog);
  server.stderr.on('data', serverLog);
  server.once('error', error => { serverError = error; });
  const url = 'http://127.0.0.1:8231/Portfolio/';
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Static server exited with code ${server.exitCode}; see server.txt.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      ready = response.ok;
      await response.body?.cancel();
    } catch (error) {
      // Expected only while the new server starts; timeout remains a hard error.
      if (attempt === 29) throw error;
    }
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw new Error(`Packaged site did not become ready: ${url}`);
  process.env.PORTFOLIO_URL = url;
  await run('Flight baseline and hiring experience', process.execPath, ['verify-canvas.mjs']);
  await run('Smooth ship banking through center', process.execPath, ['verify-ship-smoothness-browser.mjs']);
  await run('Billboard depth and interaction experience', process.execPath, ['verify-billboard-browser.mjs']);
  await run('Destination arrival briefing experience', process.execPath, ['verify-destination-browser.mjs']);
  await run('Mobile destination depth experience', process.execPath, ['verify-mobile-destination-browser.mjs']);
  await run('Mobile compact game HUD experience', process.execPath, ['verify-mobile-browser.mjs']);
  await run('Cinematic slow-pass experience', process.execPath, ['verify-time-pocket-browser.mjs']);
  result = { status: 0, stage: 'All checks passed' };
} catch (error) {
  log(`\n[FAIL] ${stage}\n${error.stack || error}\n`);
  result = { status: 1, stage };
} finally {
  server?.kill('SIGTERM');
  writeFileSync('.ci-results/result.json', JSON.stringify(result, null, 2));
}

// The next workflow step publishes this result. A separate mandatory gate
// exits nonzero after publication, so no test or packaging failure is masked.
log(`\n[result] ${result.status === 0 ? 'PASS' : 'FAIL'}: ${result.stage}\n`);
