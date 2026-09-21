import { describe, expect, it, vi } from 'vitest';
import { UnexpectedShapeError } from '@/shared/api';
import { fetchClients } from './fetch-clients';
import { clientsFixture, makeNode } from '@/test/fixtures/clients';

const respondWith = (body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(Response.json(body)));

describe('fetchClients', () => {
  it('resolves with the validated envelope from /api/clients', async () => {
    const fetchMock = respondWith(clientsFixture());

    await expect(fetchClients()).resolves.toEqual(clientsFixture());

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/clients');
  });

  it('rejects an item with eleven figures as "Unexpected data shape" (FR4-AC8)', async () => {
    const body = clientsFixture();
    body.company.values = body.company.values.slice(0, 11);
    respondWith(body);

    await expect(fetchClients()).rejects.toBeInstanceOf(UnexpectedShapeError);
    await expect(fetchClients()).rejects.toMatchObject({ detail: 'Unexpected data shape' });
  });

  it('accepts a missing child list — a company without branches, a branch without advisers (FR4-AC9)', async () => {
    const body = clientsFixture();
    body.company.branches = [makeNode('b1', 'Branch 1')];
    respondWith(body);
    await expect(fetchClients()).resolves.toEqual(body);

    const noBranches = clientsFixture();
    delete noBranches.company.branches;
    respondWith(noBranches);
    await expect(fetchClients()).resolves.toEqual(noBranches);
  });

  it('rejects an item carrying two non-empty child lists as "Unexpected data shape" (FR4-AC10)', async () => {
    const body = clientsFixture();
    body.company.branches = [
      makeNode('b1', 'Branch 1', {
        employees: [makeNode('e1', 'Anna Blackwood')],
        channels: [makeNode('c1', 'Referral')],
      }),
    ];
    respondWith(body);

    await expect(fetchClients()).rejects.toMatchObject({
      kind: 'shape',
      detail: 'Unexpected data shape',
    });
  });

  it('rejects a body without the month list', async () => {
    respondWith({ company: clientsFixture().company });

    await expect(fetchClients()).rejects.toBeInstanceOf(UnexpectedShapeError);
  });
});
