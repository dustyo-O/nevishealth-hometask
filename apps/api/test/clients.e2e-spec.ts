import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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

const DATA_FILE = new URL('../src/clients/data/clients.json', import.meta.url);

/** Every item, whichever list it hangs from (the walk does not trust `childrenOf` here). */
const allNodes = (node: TreeNode): TreeNode[] => [
  node,
  ...CHILD_KEYS.flatMap((key) => (node[key] ?? []).flatMap(allNodes)),
];

describe('GET /api/clients (e2e)', () => {
  let app: INestApplication<Server>;
  let shipped: TreeNode;

  beforeAll(async () => {
    shipped = JSON.parse(await readFile(DATA_FILE, 'utf8')) as TreeNode;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
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
});
