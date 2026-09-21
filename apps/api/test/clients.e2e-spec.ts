import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { performance } from 'node:perf_hooks';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import {
  CHILD_KEYS,
  ClientsResponseSchema,
  MONTHS,
  type ClientsResponse,
  type TreeNode,
} from '@nevis/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { API_CONFIG, loadConfig, type ApiConfig } from '../src/config.js';

const DATA_FILE = new URL('../src/clients/data/clients.json', import.meta.url);

/** Every item, whichever list it hangs from (the walk does not trust `childrenOf` here). */
const allNodes = (node: TreeNode): TreeNode[] => [
  node,
  ...CHILD_KEYS.flatMap((key) => (node[key] ?? []).flatMap(allNodes)),
];

/** Nest's default error body for the `?fail=1` switch (tech doc §2.3). */
const FAIL_BODY = {
  message: 'Failing on purpose (?fail=1)',
  error: 'Internal Server Error',
  statusCode: 500,
};

const boot = async (builder: TestingModuleBuilder): Promise<INestApplication<Server>> => {
  const app = (await builder.compile()).createNestApplication<INestApplication<Server>>();
  app.setGlobalPrefix('api');
  return app.init();
};

/** Wall-clock milliseconds a request takes end to end, as a client would measure them. */
const timed = async <T>(run: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> => {
  const start = performance.now();
  const result = await run();
  return { result, elapsedMs: performance.now() - start };
};

describe('GET /api/clients (e2e)', () => {
  let app: INestApplication<Server>;
  let shipped: TreeNode;

  beforeAll(async () => {
    shipped = JSON.parse(await readFile(DATA_FILE, 'utf8')) as TreeNode;
    app = await boot(Test.createTestingModule({ imports: [AppModule] }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 200 with a JSON document the contract schema accepts', async () => {
    const res = await request(app.getHttpServer()).get('/api/clients');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(ClientsResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('lists the twelve months of the contract, in order', async () => {
    const res = await request(app.getHttpServer()).get('/api/clients');
    const { months } = res.body as ClientsResponse;

    expect(months).toEqual([...MONTHS]);
  });

  it('serves the company tree exactly as the data file has it', async () => {
    const res = await request(app.getHttpServer()).get('/api/clients');
    const { company } = res.body as ClientsResponse;

    expect(company).toEqual(shipped);
    expect(company.name).toBe('Company');
    expect(company.branches).toHaveLength(3);
  });

  it('gives every item exactly twelve figures', async () => {
    const res = await request(app.getHttpServer()).get('/api/clients');
    const { company } = res.body as ClientsResponse;
    const nodes = allNodes(company);

    expect(nodes).toHaveLength(44);
    expect(nodes.every((node) => node.values.length === 12)).toBe(true);
  });

  it('is served under the /api prefix only', async () => {
    await request(app.getHttpServer()).get('/clients').expect(404);
  });

  describe('dev switches (FR2-AC7–9)', () => {
    it('runs with the switches enabled here — Vitest is not NODE_ENV=production', () => {
      const config = app.get<ApiConfig>(API_CONFIG);
      expect(config.devSwitches).toEqual({ enabled: true, maxDelayMs: 30_000 });
    });

    it('?fail=1 answers 500 with the documented body instead of the data', async () => {
      const res = await request(app.getHttpServer()).get('/api/clients?fail=1');

      expect(res.status).toBe(500);
      expect(res.body).toEqual(FAIL_BODY);
    });

    it('?delay=3000 answers with the data no earlier than 3 s after the request', async () => {
      const { result: res, elapsedMs } = await timed(() =>
        request(app.getHttpServer()).get('/api/clients?delay=3000'),
      );

      expect(res.status).toBe(200);
      expect(ClientsResponseSchema.safeParse(res.body).success).toBe(true);
      expect(elapsedMs).toBeGreaterThanOrEqual(3000);
    });

    it('?delay=3000&fail=1 waits 3 s and then answers 500', async () => {
      const { result: res, elapsedMs } = await timed(() =>
        request(app.getHttpServer()).get('/api/clients?delay=3000&fail=1'),
      );

      expect(res.status).toBe(500);
      expect(res.body).toEqual(FAIL_BODY);
      expect(elapsedMs).toBeGreaterThanOrEqual(3000);
    });

    it('?delay=abc is not a delay: the data arrives at once', async () => {
      const { result: res, elapsedMs } = await timed(() =>
        request(app.getHttpServer()).get('/api/clients?delay=abc'),
      );

      expect(res.status).toBe(200);
      expect(elapsedMs).toBeLessThan(1000);
    });

    it('/api/health?delay=3000 is instant — the switches never touch health', async () => {
      const { result: res, elapsedMs } = await timed(() =>
        request(app.getHttpServer()).get('/api/health?delay=3000'),
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(elapsedMs).toBeLessThan(1000);
    });
  });
});

describe('GET /api/clients with the dev switches disabled — production (FR2-AC10)', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const production: ApiConfig = {
      ...loadConfig(process.env),
      devSwitches: { enabled: false, maxDelayMs: 30_000 },
    };
    app = await boot(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(API_CONFIG)
        .useValue(production),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('?fail=1 answers 200 with the normal data document', async () => {
    const res = await request(app.getHttpServer()).get('/api/clients?fail=1');

    expect(res.status).toBe(200);
    expect(ClientsResponseSchema.safeParse(res.body).success).toBe(true);
    expect((res.body as ClientsResponse).months).toEqual([...MONTHS]);
  });

  it('?delay=10000 answers 200 in under a second — the switch is not honoured', async () => {
    const { result: res, elapsedMs } = await timed(() =>
      request(app.getHttpServer()).get('/api/clients?delay=10000'),
    );

    expect(res.status).toBe(200);
    expect(ClientsResponseSchema.safeParse(res.body).success).toBe(true);
    expect(elapsedMs).toBeLessThan(1000);
  });
});
