// Build-and-boot smoke: proves the BUILT api starts under NODE_ENV=production, answers
// /api/health, and serves /api/clients from the asset-copied JSON in a shape the contract
// accepts (tech doc §2.3, review 2 F3). Slice 3 adds the dev-switch assertions here.
// Importing @nevis/contracts from this plain Node process is itself part of the proof: the
// source-exported .ts loads under type stripping outside any bundler.
import { deepStrictEqual } from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { ClientsResponseSchema, MONTHS } from '@nevis/contracts';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const DATA_FILE = new URL('../src/clients/data/clients.json', import.meta.url);
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

const checkClients = async (base) => {
  const res = await fetch(`${base}/api/clients`);
  if (res.status !== 200) throw new Error(`/api/clients answered ${res.status}, expected 200`);
  const body = await res.json();
  const parsed = ClientsResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`/api/clients body fails ClientsResponseSchema:\n${parsed.error.message}`);
  }
  deepStrictEqual(body.months, [...MONTHS], '/api/clients months differ from MONTHS');
  // The served tree comes from dist/clients/data/clients.json (nest-cli assets); it must equal the source.
  const shipped = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  deepStrictEqual(
    body.company,
    shipped,
    '/api/clients company differs from src/clients/data/clients.json',
  );
  return body;
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
  if (!/\[ConsistencyCheck\] .*0 discrepancies/.test(output)) {
    throw new Error(`boot log does not report 0 discrepancies for the shipped data:\n${output}`);
  }
  const { company } = await checkClients(base);
  console.log(
    `smoke: dist/main.js booted on :${port} under NODE_ENV=production, /api/health ok, contracts loaded, ` +
      `/api/clients valid and equal to the data file (${company.branches.length} branches), 0 discrepancies`,
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
