// @layer: e2e
// @spec: 001-clients-data-dashboard-shell
//
// FR2 "The clients data service", acceptance criterion by acceptance criterion, against the whole
// booted application (`AppModule`) over HTTP — the way a tester with curl would see it. Test
// datasets boot the app on a fixture file, exactly as "when the service starts with it" says.
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { performance } from 'node:perf_hooks';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientsResponseSchema, type ClientsResponse, type TreeNode } from '@nevis/contracts';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { CLIENTS_DATA_PATH } from '../../src/clients/json-clients.repository.js';
import { API_CONFIG, loadConfig, type ApiConfig } from '../../src/config.js';

/** The dataset the brief supplied — the acceptance criteria compare against this file, not a copy. */
const SUPPLIED_DATASET = new URL('../../../../context/inbox/data.json', import.meta.url);

/** FR2: "the twelve months the figures cover (February 2024 to January 2025, in order)". */
const EXPECTED_MONTHS = [
  '2024-02',
  '2024-03',
  '2024-04',
  '2024-05',
  '2024-06',
  '2024-07',
  '2024-08',
  '2024-09',
  '2024-10',
  '2024-11',
  '2024-12',
  '2025-01',
];

/** The list each level of the supplied tree carries beneath it (FR2-AC2). */
const LEVELS = ['branches', 'employees', 'channels'] as const;

type Fixture = 'ends-of-lines' | 'root-broken';

const fixturePath = (name: Fixture): URL => new URL(`./fixtures/${name}.json`, import.meta.url);

type App = INestApplication<Server>;

type BootOptions = { dataPath?: URL; config?: ApiConfig };

/** The whole application, optionally on another dataset or another configuration. */
const boot = async ({ dataPath, config }: BootOptions = {}): Promise<App> => {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (dataPath) builder = builder.overrideProvider(CLIENTS_DATA_PATH).useValue(dataPath);
  if (config) builder = builder.overrideProvider(API_CONFIG).useValue(config);
  const app = (await builder.compile()).createNestApplication<App>();
  app.setGlobalPrefix('api');
  return app.init();
};

const productionConfig = (): ApiConfig => ({
  ...loadConfig(process.env),
  isProduction: true,
  devSwitches: { enabled: false, maxDelayMs: 30_000 },
});

/** Wall-clock milliseconds a request takes end to end, as a client would measure them. */
const timed = async <T>(run: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> => {
  const start = performance.now();
  const result = await run();
  return { result, elapsedMs: performance.now() - start };
};

const isTwelveNumbers = (values: unknown): boolean =>
  Array.isArray(values) &&
  values.length === 12 &&
  values.every((value) => typeof value === 'number' && Number.isFinite(value));

/**
 * Walks the tree checking FR2-AC2's nesting: level 0 is the company with `branches`, level 1
 * a branch with `employees`, level 2 an adviser with `channels`, level 3 a channel with nothing
 * beneath it. Returns every violation as a readable string so a failure names the item.
 */
const nestingViolations = (node: TreeNode, level = 0): string[] => {
  const problems: string[] = [];
  if (typeof node.id !== 'string' || node.id === '')
    problems.push(`level ${level}: item without id`);
  if (typeof node.name !== 'string' || node.name === '')
    problems.push(`level ${level}: item without name`);
  if (!isTwelveNumbers(node.values)) problems.push(`${node.name}: figures are not twelve numbers`);

  const expectedList = LEVELS[level];
  for (const key of LEVELS) {
    const list = node[key];
    if (list === undefined) continue;
    if (key !== expectedList) problems.push(`${node.name}: carries "${key}" at level ${level}`);
    for (const child of list) problems.push(...nestingViolations(child, level + 1));
  }
  return problems;
};

describe('FR2 — the clients data service', () => {
  let app: App;
  let supplied: TreeNode;

  beforeAll(async () => {
    supplied = JSON.parse(await readFile(SUPPLIED_DATASET, 'utf8')) as TreeNode;
    app = await boot();
  });

  afterAll(async () => {
    await app.close();
  });

  // @regression
  it('AC1: GET /api/clients is one document with the twelve months in order and the company tree', async () => {
    const res = await request(app.getHttpServer()).get('/api/clients');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(Object.keys(res.body as object).sort()).toEqual(['company', 'months']);
    expect((res.body as ClientsResponse).months).toEqual(EXPECTED_MONTHS);
    expect((res.body as ClientsResponse).company.name).toBe('Company');
  });

  // @regression
  it('AC2: the company part is the supplied dataset — names, order, nesting and every figure', async () => {
    const res = await request(app.getHttpServer()).get('/api/clients');
    const { company } = res.body as ClientsResponse;

    expect(company).toEqual(supplied);
    expect(nestingViolations(company)).toEqual([]);
    // The supplied shape, spelled out: Company → branches → advisers (`employees`) → channels.
    expect(company.branches?.map((branch) => branch.name)).toEqual([
      'Branch 1',
      'Branch 2',
      'Branch 3',
    ]);
    const firstAdviser = company.branches?.[0]?.employees?.[0];
    expect(firstAdviser?.channels?.length).toBeGreaterThan(0);
    expect(firstAdviser?.channels?.every((channel) => isTwelveNumbers(channel.values))).toBe(true);
  });

  // @regression
  it('AC4: GET /api/health reports status "ok"', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  // @regression
  it('is read-only: nothing can be changed through it', async () => {
    const before = (await request(app.getHttpServer()).get('/api/clients')).body as ClientsResponse;
    const tampered = { ...before, company: { ...before.company, name: 'Tampered' } };

    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      const res = await request(app.getHttpServer())[method]('/api/clients').send(tampered);
      expect(res.status, `${method.toUpperCase()} /api/clients`).toBeGreaterThanOrEqual(400);
      expect(res.status, `${method.toUpperCase()} /api/clients`).toBeLessThan(500);
    }

    const after = (await request(app.getHttpServer()).get('/api/clients')).body as ClientsResponse;
    expect(after).toEqual(before);
  });

  // @regression
  it('answers 404 for a path it does not serve', async () => {
    await request(app.getHttpServer()).get('/api/clients/company').expect(404);
    await request(app.getHttpServer()).get('/api/branches').expect(404);
  });

  describe('development switches (AC7–AC9)', () => {
    // @regression
    it('AC7: ?fail=1 answers with an error response instead of the data', async () => {
      const res = await request(app.getHttpServer()).get('/api/clients?fail=1');

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body).not.toHaveProperty('months');
      expect(res.body).not.toHaveProperty('company');
      expect(res.body).toMatchObject({ statusCode: 500 });
    });

    // The two 3-second waits run side by side: they share one app and never touch each other.
    describe.concurrent('delays', () => {
      // @regression
      it('AC8: ?delay=3000 answers with the data no earlier than 3 s after the request', async () => {
        const { result: res, elapsedMs } = await timed(() =>
          request(app.getHttpServer()).get('/api/clients?delay=3000'),
        );

        expect(elapsedMs).toBeGreaterThanOrEqual(3000);
        expect(res.status).toBe(200);
        expect((res.body as ClientsResponse).months).toEqual(EXPECTED_MONTHS);
      });

      // @regression
      it('AC9: ?delay=3000&fail=1 waits 3 s and then answers with an error response', async () => {
        const { result: res, elapsedMs } = await timed(() =>
          request(app.getHttpServer()).get('/api/clients?delay=3000&fail=1'),
        );

        expect(elapsedMs).toBeGreaterThanOrEqual(3000);
        expect(res.status).toBeGreaterThanOrEqual(500);
        expect(res.body).not.toHaveProperty('company');
      });
    });

    // @regression
    it('does not let a delay hold /api/health', async () => {
      const { result: res, elapsedMs } = await timed(() =>
        request(app.getHttpServer()).get('/api/health?delay=3000&fail=1'),
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(elapsedMs).toBeLessThan(1000);
    });
  });
});

describe('FR2-AC10 — the production build ignores the switches', () => {
  let app: App;

  beforeAll(async () => {
    app = await boot({ config: productionConfig() });
  });

  afterAll(async () => {
    await app.close();
  });

  // @regression
  it('?fail=1 returns the normal data document', async () => {
    const res = await request(app.getHttpServer()).get('/api/clients?fail=1');

    expect(res.status).toBe(200);
    expect((res.body as ClientsResponse).months).toEqual(EXPECTED_MONTHS);
    expect((res.body as ClientsResponse).company.name).toBe('Company');
  });

  // @regression
  it('?delay=10000 returns the data document without the 10-second wait', async () => {
    const { result: res, elapsedMs } = await timed(() =>
      request(app.getHttpServer()).get('/api/clients?delay=10000'),
    );

    expect(res.status).toBe(200);
    expect((res.body as ClientsResponse).company.name).toBe('Company');
    expect(elapsedMs).toBeLessThan(2000);
  });
});

describe('FR2 — starting the service with other datasets (AC3, AC5, AC6)', () => {
  let app: App | undefined;
  // Installed before boot: the report runs in `onApplicationBootstrap`.
  let warn: MockInstance<Logger['warn']>;

  const startWith = async (fixture?: Fixture): Promise<App> => {
    warn = vi.spyOn(Logger.prototype, 'warn');
    app = await boot(fixture ? { dataPath: fixturePath(fixture) } : {});
    return app;
  };

  afterEach(async () => {
    warn.mockRestore();
    await app?.close();
    app = undefined;
  });

  // @regression
  it('AC3: a branch with no advisers and an adviser with no channels are simply the end of their line', async () => {
    const started = await startWith('ends-of-lines');
    const res = await request(started.getHttpServer()).get('/api/clients');

    expect(res.status).toBe(200);
    expect(ClientsResponseSchema.safeParse(res.body).success).toBe(true);
    const { company } = res.body as ClientsResponse;
    const [branchA, branchB, branchC] = company.branches ?? [];

    // No list beneath them at all…
    expect(branchB?.name).toBe('Branch B');
    expect(branchB).not.toHaveProperty('employees');
    expect(branchA?.employees?.[1]?.name).toBe('Bo Nakamura');
    expect(branchA?.employees?.[1]).not.toHaveProperty('channels');
    // …or an empty one: both are valid and served as found.
    expect(branchC?.employees).toEqual([]);
    expect(branchA?.employees?.[2]?.channels).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  // @regression
  it('AC5: the delivered dataset starts with no data warnings', async () => {
    const started = await startWith();
    await request(started.getHttpServer()).get('/api/clients').expect(200);

    expect(warn).not.toHaveBeenCalled();
  });

  // @regression
  it('AC6: one item whose figure is not the sum beneath it → one warning naming it and the month, data still served', async () => {
    const started = await startWith('root-broken');

    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] ?? [];
    expect(message).toContain('Company');
    expect(message).toContain('2024-05');

    const res = await request(started.getHttpServer()).get('/api/clients');
    expect(res.status).toBe(200);
    // Served as found — the figure is not "fixed" on the way out.
    expect((res.body as ClientsResponse).company.values[3]).toBe(31);
  });
});
