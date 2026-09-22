import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TreeGridRow } from './types';
import { useExpandedIds } from './use-expanded-ids';

/**
 * A tree, not a client tree: this layer knows rows and parents, and nothing about what they
 * describe (architecture §6). Depth-first, exactly as a flattener hands them over.
 *
 *   root
 *     a            b        c (leaf)
 *       a1           b1 (leaf)
 *         a1x (leaf)
 *       a2 (leaf)
 */
const row = (id: string, parentId: string | null, level: number, hasChildren = false) =>
  ({ id, parentId, level, posInSet: 1, setSize: 1, hasChildren }) satisfies TreeGridRow;

const ROWS: TreeGridRow[] = [
  row('root', null, 1, true),
  row('a', 'root', 2, true),
  row('a1', 'a', 3, true),
  row('a1x', 'a1', 4),
  row('a2', 'a', 3),
  row('b', 'root', 2, true),
  row('b1', 'b', 3),
  row('c', 'root', 2),
];

const ids = (set: ReadonlySet<string>) => [...set].sort();

describe('useExpandedIds', () => {
  it('starts open on exactly the ids it was seeded with', () => {
    const { result } = renderHook(() => useExpandedIds(() => ['root']));

    expect(ids(result.current.expandedIds)).toEqual(['root']);
  });

  it('reads the seed once, so a later render never reopens what the user closed', () => {
    const { result, rerender } = renderHook(
      ({ seed }: { seed: string }) => useExpandedIds(() => [seed]),
      { initialProps: { seed: 'root' } },
    );

    act(() => {
      result.current.toggle('root', ROWS);
    });
    rerender({ seed: 'a' });

    expect(ids(result.current.expandedIds)).toEqual([]);
  });

  it('opens a row that was closed', () => {
    const { result } = renderHook(() => useExpandedIds(() => ['root']));

    act(() => {
      result.current.toggle('a', ROWS);
    });

    expect(ids(result.current.expandedIds)).toEqual(['a', 'root']);
  });

  it('closes a row that was open', () => {
    const { result } = renderHook(() => useExpandedIds(() => ['root', 'a']));

    act(() => {
      result.current.toggle('a', ROWS);
    });

    expect(ids(result.current.expandedIds)).toEqual(['root']);
  });

  it('prunes every descendant when a row closes, so re-opening it shows its children closed (FR2-AC3)', () => {
    const { result } = renderHook(() => useExpandedIds(() => ['root', 'a', 'a1']));

    act(() => {
      result.current.toggle('a', ROWS);
    });
    expect(ids(result.current.expandedIds)).toEqual(['root']);

    act(() => {
      result.current.toggle('a', ROWS);
    });
    expect(ids(result.current.expandedIds)).toEqual(['a', 'root']);
  });

  it('prunes only its own descendants, leaving the rows beside it open (FR2-AC4)', () => {
    const { result } = renderHook(() => useExpandedIds(() => ['root', 'a', 'a1', 'b']));

    act(() => {
      result.current.toggle('a', ROWS);
    });

    expect(ids(result.current.expandedIds)).toEqual(['b', 'root']);
  });

  it('keeps the same set object when nothing about it changes, and a new one when it does', () => {
    const { result } = renderHook(() => useExpandedIds(() => ['root']));
    const before = result.current.expandedIds;

    act(() => {
      result.current.toggle('a', ROWS);
    });

    expect(result.current.expandedIds).not.toBe(before);
    expect(before.has('a')).toBe(false);
  });
});
