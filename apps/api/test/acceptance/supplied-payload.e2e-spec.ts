// @layer: e2e
// @spec: 004-supplied-payload-non-uniform-nesting
//
// Spec 004 as the API delivers it: the company exactly as the brief supplies it — unevenly nested,
// with figures that do not always add up — read from the file we serve and from `GET /api/clients`.
//
// THE REGRESSION THIS SPEC EXISTS TO PREVENT (tech doc §4): we once "completed" the payload,
// inventing advisers for the empty branches and channels for the advisers without them, and the
// brief's requirement — handle a company whose parts are not all broken down to the same depth —
// quietly disappeared while every other test stayed green. The first describe block fails the
// moment the served file is made uniform again. If it is in your way, the data is right and your
// change is not: the gaps are the requirement.
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { childrenOf, type ClientsResponse, type TreeNode } from '@nevis/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AppModule } from '../../src/app.module.js';

/** The file the service reads at boot — the served data itself, never a copy of it. */
const SERVED = new URL('../../src/clients/data/clients.json', import.meta.url);
/** The inbox copy of what we serve (004 §2.1): the same content, byte for byte. */
const INBOX = new URL('../../../../context/inbox/data.json', import.meta.url);

const MAY = 3;
const AUGUST = 6;

const readTree = async (url: URL): Promise<TreeNode> =>
  JSON.parse(await readFile(url, 'utf8')) as TreeNode;

const named = (nodes: readonly TreeNode[], name: string): TreeNode => {
  const node = nodes.find((candidate) => candidate.name === name);
  if (node === undefined)
    throw new Error(`no "${name}" among ${nodes.map((n) => n.name).join(', ')}`);
  return node;
};

const sum = (nodes: readonly TreeNode[], month: number): number =>
  nodes.reduce((total, node) => total + node.values[month]!, 0);

/**
 * Where the tree stops short of the full depth (company → branch → adviser → channel): every node
 * above the channel level with nothing beneath it. Empty for a uniform tree — which is exactly the
 * shape this spec forbids.
 */
const endsOfLine = (node: TreeNode, depth = 0, path: string[] = []): string[] => {
  const here = [...path, node.name];
  const children = childrenOf(node);
  if (children.length === 0) return depth < 3 ? [here.join(' › ')] : [];
  return children.flatMap((child) => endsOfLine(child, depth + 1, here));
};

const twelve = (value: number): number[] => Array.from({ length: 12 }, () => value);

/** A uniform company, the shape we must never serve again: every level broken down fully. */
const uniformCompany = (): TreeNode => {
  const leaf = (name: string): TreeNode => ({ id: name, name, values: twelve(1) });
  const adviser = (name: string): TreeNode => ({
    ...leaf(name),
    values: twelve(3),
    channels: ['Existing clients', 'New organic', 'New paid'].map(leaf),
  });
  const branch = (name: string): TreeNode => ({
    ...leaf(name),
    values: twelve(6),
    employees: [adviser(`${name} A`), adviser(`${name} B`)],
  });
  return {
    ...leaf('Company'),
    values: twelve(18),
    branches: ['Branch 1', 'Branch 2', 'Branch 3'].map(branch),
  };
};

describe('004 — the served data is never made uniform again (§4)', () => {
  let served: TreeNode;

  beforeAll(async () => {
    served = await readTree(SERVED);
  });

  // @regression
  it('FR1: Branch 2 has no advisers — read from the served file', () => {
    const branch2 = named(served.branches ?? [], 'Branch 2');

    expect(childrenOf(branch2)).toEqual([]);
  });

  // @regression
  it('FR1: at least one adviser has no acquisition channels — read from the served file', () => {
    const advisers = (served.branches ?? []).flatMap((branch) => branch.employees ?? []);

    expect(advisers.length).toBeGreaterThan(0);
    expect(advisers.filter((adviser) => childrenOf(adviser).length === 0).length).toBeGreaterThan(
      0,
    );
  });

  // @regression
  it('FR1: the company is exactly as uneven as supplied — two empty branches, one adviser of five broken down', () => {
    expect(endsOfLine(served)).toEqual([
      'Company › Branch 1 › James Walker',
      'Company › Branch 1 › Maria Gutierrez',
      'Company › Branch 1 › Robert Chen',
      'Company › Branch 1 › Sarah Smith',
      'Company › Branch 2',
      'Company › Branch 3',
    ]);
    const anna = named(named(served.branches ?? [], 'Branch 1').employees ?? [], 'Anna Blackwood');
    expect(childrenOf(anna).map((channel) => channel.name)).toEqual([
      'Existing clients',
      'New organic',
      'New paid',
    ]);
  });

  // @regression
  it('negative: the check itself would catch a uniform company — a completed tree has no ends of line', () => {
    const uniform = uniformCompany();

    expect(endsOfLine(uniform)).toEqual([]);
    expect(childrenOf(named(uniform.branches ?? [], 'Branch 2')).length).toBeGreaterThan(0);
  });

  // @regression
  it('the inbox copy is the file we serve, byte for byte', async () => {
    const [servedText, inboxText] = await Promise.all([
      readFile(SERVED, 'utf8'),
      readFile(INBOX, 'utf8'),
    ]);

    expect(servedText).toBe(inboxText);
  });
});

describe('004 FR2 — the figures are the ones we were given, over HTTP', () => {
  let app: INestApplication<Server>;
  let served: TreeNode;
  let warn: MockInstance<Logger['warn']>;
  let company: TreeNode;
  let warnings: string[];

  beforeAll(async () => {
    served = await readTree(SERVED);
    // Installed before boot: the consistency report runs in `onApplicationBootstrap`.
    warn = vi.spyOn(Logger.prototype, 'warn');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    await app.init();
    const res = await request(app.getHttpServer()).get('/api/clients').expect(200);
    company = (res.body as ClientsResponse).company;
    // Counted here: call history does not survive into the tests.
    warnings = warn.mock.calls.map(([message]) => String(message));
  });

  afterAll(async () => {
    warn.mockRestore();
    await app.close();
  });

  // @regression
  it('AC4: figures that disagree are served normally — the whole tree, unchanged', () => {
    expect(company).toEqual(served);
  });

  // @regression
  it('AC1: the Company row reads 301 for May although its three branches come to 279', () => {
    const branches = company.branches ?? [];

    expect(company.values[MAY]).toBe(301);
    expect(branches.map((branch) => branch.values[MAY])).toEqual([156, 87, 36]);
    expect(sum(branches, MAY)).toBe(279);
  });

  // @regression
  it('AC2: Branch 1 reads 214 for August although its five advisers come to 216', () => {
    const branch1 = named(company.branches ?? [], 'Branch 1');

    expect(branch1.values[AUGUST]).toBe(214);
    expect(sum(branch1.employees ?? [], AUGUST)).toBe(216);
  });

  // @regression
  it('negative: no figure is reconciled on the way out — a parent is never its children’s sum where the data says otherwise', () => {
    // The counterpart to AC1/AC2: had the service "fixed" either parent, these would match.
    const branch1 = named(company.branches ?? [], 'Branch 1');

    expect(company.values[MAY]).not.toBe(sum(company.branches ?? [], MAY));
    expect(branch1.values[AUGUST]).not.toBe(sum(branch1.employees ?? [], AUGUST));
  });

  // @regression
  it('the disagreements are logged for the operator — seven, one per disagreement — and never reach the user', () => {
    // The warning is the operator's, in the server log; the response carries figures only.
    expect(warnings).toHaveLength(7);
    expect(warnings).toContain('"Company" 2024-05: parent 301, children sum 279');
    expect(Object.keys(company).sort()).toEqual(['branches', 'id', 'name', 'values']);
  });
});
