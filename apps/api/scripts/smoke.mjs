// Build-and-boot smoke: proves the BUILT api starts under NODE_ENV=production and answers
// /api/health (tech doc §2.3, review 2 F3). Slice 2 adds the /api/clients assertions here.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const HEALTH_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 100;

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealth = async (base) => {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError = 'no response yet';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      const body = await res.json();
      if (res.status === 200 && body.status === 'ok') return body;
      lastError = `status ${res.status}, body ${JSON.stringify(body)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `/api/health did not answer { status: "ok" } within ${HEALTH_TIMEOUT_MS} ms (${lastError})`,
  );
};

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: appDir,
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => (output += chunk));
child.stderr.on('data', (chunk) => (output += chunk));
const exited = new Promise((resolve) =>
  child.on('exit', (code, signal) => resolve({ code, signal })),
);

const stop = () =>
  new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });

try {
  await waitForHealth(base);
  if (!/serving 12 months, 2024-02 to 2025-01/.test(output)) {
    throw new Error(`boot log does not show MONTHS from @nevis/contracts:\n${output}`);
  }
  if (/ExperimentalWarning|TypeScript/.test(output)) {
    throw new Error(`boot log carries a Node warning about type stripping:\n${output}`);
  }
  console.log(
    `smoke: dist/main.js booted on :${port} under NODE_ENV=production, /api/health ok, contracts loaded`,
  );
} catch (error) {
  console.error(`smoke: FAILED — ${error instanceof Error ? error.message : String(error)}`);
  if (output) console.error(`--- api output ---\n${output}`);
  await stop();
  process.exit(1);
} finally {
  await stop();
  await exited;
}
