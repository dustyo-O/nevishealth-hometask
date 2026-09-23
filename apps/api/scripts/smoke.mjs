// Build-and-boot smoke: proves the BUILT api starts under NODE_ENV=production, answers
// /api/health, serves /api/clients from the asset-copied JSON in a shape the contract accepts
// (tech doc §2.3, review 2 F3), and ignores the dev switches `?fail=1` / `?delay=` — the only
// proof of FR2-AC10 against the real production build.
// Importing @nevis/contracts from this plain Node process is itself part of the proof: the
// source-exported .ts loads under type stripping outside any bundler.
import { deepStrictEqual } from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { ClientsResponseSchema, MONTHS } from '@nevis/contracts';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const DATA_FILE = new URL('../src/clients/data/clients.json', import.meta.url);
const HEALTH_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 100;
/** `?delay=10000` must not be honoured; a real 10 s wait fails this bound by a wide margin. */
const IGNORED_DELAY_MS = 10_000;
const IGNORED_DELAY_BOUND_MS = 2_000;
/**
 * The supplied payload disagrees with itself in exactly seven places (spec 004 FR2, §2.2). The
 * guard must name every one and the data must still be served — this proves the guard fires,
 * where the old "0 discrepancies" only proved it stayed quiet.
 */
const EXPECTED_DISCREPANCIES = [
  '"Company" 2024-05: parent 301, children sum 279',
  '"Company > Branch 1" 2024-08: parent 214, children sum 216',
  '"Company > Branch 1 > Anna Blackwood" 2024-05: parent 31, children sum 30',
  '"Company > Branch 1 > Anna Blackwood" 2024-06: parent 32, children sum 33',
  '"Company > Branch 1 > Anna Blackwood" 2024-07: parent 34, children sum 35',
  '"Company > Branch 1 > Anna Blackwood" 2024-08: parent 38, children sum 36',
  '"Company > Branch 1 > Anna Blackwood" 2024-09: parent 27, children sum 28',
];

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

/** FR2-AC10: under NODE_ENV=production the switches are just unknown query parameters. */
const checkSwitchesIgnored = async (base, expected) => {
  const failed = await fetch(`${base}/api/clients?fail=1`);
  if (failed.status !== 200) {
    throw new Error(`/api/clients?fail=1 answered ${failed.status} in production, expected 200`);
  }
  deepStrictEqual(
    await failed.json(),
    expected,
    '/api/clients?fail=1 in production differs from the normal document',
  );

  const start = performance.now();
  const delayed = await fetch(`${base}/api/clients?delay=${IGNORED_DELAY_MS}`);
  const elapsedMs = performance.now() - start;
  if (delayed.status !== 200) {
    throw new Error(
      `/api/clients?delay=${IGNORED_DELAY_MS} answered ${delayed.status}, expected 200`,
    );
  }
  if (elapsedMs >= IGNORED_DELAY_BOUND_MS) {
    throw new Error(
      `/api/clients?delay=${IGNORED_DELAY_MS} took ${elapsedMs.toFixed(0)} ms in production — the switch was honoured`,
    );
  }
  deepStrictEqual(
    await delayed.json(),
    expected,
    `/api/clients?delay=${IGNORED_DELAY_MS} in production differs from the normal document`,
  );
  return elapsedMs;
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
  if (!/\[ConsistencyCheck\] .*Checked 12 nodes: 7 discrepancies/.test(output)) {
    throw new Error(`boot log does not report 7 discrepancies over 12 nodes:\n${output}`);
  }
  const warned = stripVTControlCharacters(output)
    .split('\n')
    .filter((line) => line.includes('[ConsistencyCheck]') && line.includes('children sum'))
    .map((line) => line.slice(line.indexOf('"')).trim());
  deepStrictEqual(
    warned,
    EXPECTED_DISCREPANCIES,
    'boot log does not name exactly the seven supplied discrepancies',
  );
  const body = await checkClients(base);
  const ignoredDelayMs = await checkSwitchesIgnored(base, body);
  console.log(
    `smoke: dist/main.js booted on :${port} under NODE_ENV=production, /api/health ok, contracts loaded, ` +
      `/api/clients valid and equal to the data file (${body.company.branches.length} branches), ` +
      `${warned.length} discrepancies reported and served anyway, ` +
      `?fail=1 → 200 data, ?delay=${IGNORED_DELAY_MS} answered in ${ignoredDelayMs.toFixed(0)} ms (switches ignored)` +
      warned.map((line) => `\n  discrepancy ${line}`).join(''),
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
