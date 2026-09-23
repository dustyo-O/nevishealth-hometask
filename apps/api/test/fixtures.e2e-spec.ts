import type { Server } from 'node:http';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientsResponseSchema, type ClientsResponse } from '@nevis/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CLIENTS_DATA_PATH } from '../src/clients/json-clients.repository.js';

type Fixture = 'childless' | 'no-branches' | 'broken';

const fixturePath = (name: Fixture): URL => new URL(`./fixtures/${name}.json`, import.meta.url);

/** Boots the whole app on a fixture file — "when the service starts with it" (FR2). */
const bootWith = async (dataPath?: URL): Promise<INestApplication<Server>> => {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (dataPath) builder = builder.overrideProvider(CLIENTS_DATA_PATH).useValue(dataPath);
  const app = (await builder.compile()).createNestApplication<INestApplication<Server>>();
  app.setGlobalPrefix('api');
  return app.init();
};

const getClients = async (app: INestApplication<Server>): Promise<ClientsResponse> => {
  const res = await request(app.getHttpServer()).get('/api/clients');
  expect(res.status).toBe(200);
  expect(ClientsResponseSchema.safeParse(res.body).success).toBe(true);
  return res.body as ClientsResponse;
};

describe('GET /api/clients with test datasets (e2e)', () => {
  let app: INestApplication<Server> | undefined;
  // Installed before boot: the report runs in onApplicationBootstrap. The testing logger swallows
  // the output, but the call still goes through Logger.prototype.warn.
  let warn: MockInstance<Logger['warn']>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn');
  });

  afterEach(async () => {
    warn.mockRestore();
    await app?.close();
    app = undefined;
  });

  it('serves a branch without advisers and an adviser without channels as the end of their line', async () => {
    app = await bootWith(fixturePath('childless'));
    const { company } = await getClients(app);

    const branch3 = company.branches![2]!;
    expect(branch3.name).toBe('Branch 3');
    expect(branch3).not.toHaveProperty('employees');

    const elena = company.branches![1]!.employees![2]!;
    expect(elena.name).toBe('Elena Rossi');
    expect(elena).not.toHaveProperty('channels');

    expect(warn).not.toHaveBeenCalled();
  });

  it('serves a company with no branches at all', async () => {
    app = await bootWith(fixturePath('no-branches'));
    const { company } = await getClients(app);

    expect(company.name).toBe('Company');
    expect(company).not.toHaveProperty('branches');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once for the one broken item and month, and still serves the data', async () => {
    app = await bootWith(fixturePath('broken'));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Anna Blackwood.*2024-04/));

    const { company } = await getClients(app);
    // Served as found — the broken figure is not "fixed" on the way out.
    expect(company.branches![0]!.employees![0]!.channels![0]!.values[2]).toBe(31);
  });

  it('warns seven times when it starts with the shipped data, and serves it anyway', async () => {
    app = await bootWith();

    // The supplied figures disagree with themselves in seven places (spec 004 FR2); the guard
    // reports them and the data is served as found.
    expect(warn).toHaveBeenCalledTimes(7);
    const { company } = await getClients(app);
    expect(company.values[3]).toBe(301);
  });
});
