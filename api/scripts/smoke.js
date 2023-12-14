// Starts the API, waits for /health and calls a few endpoints. Used by CI on all three OS,
// so no curl and no shell tricks.
// usage: npm run db:reset && npm run smoke -w api
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.SMOKE_PORT || '4799';
const BASE = 'http://localhost:' + PORT;
const TIMEOUT_MS = 30000;

const CHECKS = [
  { url: '/api/v1/books?_limit=1', check: body => Array.isArray(body) && body.length === 1 && !!body[0].isbn },
  { url: '/api/v1/publishers', check: body => Array.isArray(body) && body.length > 0 },
  { url: '/api/v2/books?limit=1', check: body => Array.isArray(body.items) && body.items.length === 1 && body.total > 0 },
  { url: '/api/v2/books/search?q=ring', check: body => body.total > 0 },
  { url: '/api/books?_limit=1', check: body => Array.isArray(body) && body.length === 1 }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const until = Date.now() + TIMEOUT_MS;
  while (Date.now() < until) {
    try {
      const res = await fetch(BASE + '/health');
      if (res.ok) return await res.json();
    } catch (e) {
      // not up yet
    }
    await sleep(300);
  }
  throw new Error('API did not answer on ' + BASE + '/health within ' + TIMEOUT_MS / 1000 + 's');
}

async function main() {
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: PORT, JOBS: 'off', LOG_LEVEL: 'warn' }),
    stdio: ['ignore', 'inherit', 'inherit']
  });
  let exited = false;
  server.on('exit', function (code) {
    exited = true;
    if (code) console.error('[smoke] API exited with code ' + code);
  });

  let failed = 0;
  try {
    const health = await waitForHealth();
    console.log('[smoke] health ok, node ' + health.node);
    for (const c of CHECKS) {
      const res = await fetch(BASE + c.url);
      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        body = null;
      }
      const ok = res.status === 200 && c.check(body);
      console.log('[smoke] ' + (ok ? 'ok  ' : 'FAIL') + ' ' + res.status + ' ' + c.url);
      if (!ok) failed++;
    }
  } catch (err) {
    console.error('[smoke] ' + err.message);
    failed++;
  } finally {
    if (!exited) server.kill();
  }
  process.exit(failed ? 1 : 0);
}

main();
