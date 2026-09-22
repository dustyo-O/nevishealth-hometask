import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeGridRow } from '../model/types';
import type { TreeGrid as TreeGridComponent } from './tree-grid';

/**
 * The motion of FR2-AC8, at the level jsdom can hold an opinion about: that the grid really
 * hands `@formkit/auto-animate` the sliding plugin, that every arriving and leaving row is
 * animated by it, and that a row on its way out is out of the accessibility tree from the first
 * frame (D-15a) and gone from the DOM by the last.
 *
 * jsdom implements neither the Web Animations API nor `ResizeObserver` — which is what the
 * library tests for to decide whether it is in a browser — so the stubs below stand in for
 * them and record what was asked for. They make the library's own code run; what a browser then
 * paints is measured in Chrome instead (`e2e/table-animation.spec.ts` and the slice's ledger).
 */
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class TestIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

class TestKeyframeEffect {
  target: Element;
  keyframes: Keyframe[];
  timing: KeyframeEffectOptions;

  constructor(target: Element, keyframes: Keyframe[], timing: KeyframeEffectOptions = {}) {
    this.target = target;
    this.keyframes = keyframes;
    this.timing = timing;
  }
}

/** Every animation the library started, in order, so a test can ask whether one exists at all. */
const started: TestAnimation[] = [];

class TestAnimation extends EventTarget {
  effect: TestKeyframeEffect;
  playState = 'idle';
  finished: Promise<void>;
  #done: () => void = () => {};

  constructor(effect: TestKeyframeEffect) {
    super();
    this.effect = effect;
    this.finished = new Promise((resolve) => {
      this.#done = () => resolve();
    });
  }

  play() {
    this.playState = 'running';
    started.push(this);
    // Real timers, real duration: a departing row must be watched leaving rather than counted
    // gone, which is exactly what the standing rule asks every test of a collapse to do.
    setTimeout(
      () => {
        this.playState = 'finished';
        this.#done();
        this.dispatchEvent(new Event('finish'));
      },
      Number(this.effect.timing.duration ?? 0),
    );
  }

  cancel() {
    this.playState = 'idle';
    this.#done();
  }
}

vi.stubGlobal('ResizeObserver', TestResizeObserver);
vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
vi.stubGlobal('KeyframeEffect', TestKeyframeEffect);
vi.stubGlobal('Animation', TestAnimation);

// Imported only once the stubs are in place: the library decides whether it is in a browser
// when it is first imported, and never asks again.
let TreeGrid: typeof TreeGridComponent;

beforeAll(async () => {
  ({ TreeGrid } = await import('./tree-grid'));
});

beforeEach(() => {
  started.length = 0;
});

/**
 *   root      open or closed
 *     one     shown only while root is open
 *     two
 *   tail      always here, and moves as the two above come and go
 */
const rowsWhen = (open: boolean): TreeGridRow[] => {
  const root: TreeGridRow = {
    id: 'root',
    parentId: null,
    level: 1,
    posInSet: 1,
    setSize: 2,
    hasChildren: true,
  };
  const tail: TreeGridRow = {
    id: 'tail',
    parentId: null,
    level: 1,
    posInSet: 2,
    setSize: 2,
    hasChildren: false,
  };
  const children: TreeGridRow[] = ['one', 'two'].map((id, index) => ({
    id,
    parentId: 'root',
    level: 2,
    posInSet: index + 1,
    setSize: 2,
    hasChildren: false,
  }));
  return open ? [root, ...children, tail] : [root, tail];
};

const Grid = ({ open }: { open: boolean }) => (
  <TreeGrid
    id="grid"
    label="Values by column"
    columnCount={1}
    head={
      <TreeGrid.Head>
        <TreeGrid.ColumnHeader name>Name</TreeGrid.ColumnHeader>
        <TreeGrid.ColumnHeader colIndex={0}>One</TreeGrid.ColumnHeader>
      </TreeGrid.Head>
    }
  >
    {rowsWhen(open).map((row) => (
      <TreeGrid.Row key={row.id} row={row} expanded={row.id === 'root' ? open : undefined}>
        <TreeGrid.RowHeader>
          <TreeGrid.Toggle />
          {row.id}
        </TreeGrid.RowHeader>
        <TreeGrid.Cell colIndex={0}>{row.id}-One</TreeGrid.Cell>
      </TreeGrid.Row>
    ))}
  </TreeGrid>
);

const rowNamed = (id: string): HTMLTableRowElement => {
  const row = document.getElementById(`grid-row-${id}`);
  if (row === null) throw new Error(`no row for "${id}"`);
  return row as HTMLTableRowElement;
};

const animationFor = (el: Element): TestAnimation | undefined =>
  started.find((animation) => animation.effect.target === el);

/**
 * The library measures the rows it was handed at mount on a 500 ms debounce, and a row it has
 * never measured is one it cannot animate out — it simply lets it go. Every test that closes a
 * row therefore waits for that first measurement, as any hand on a mouse would.
 */
const measured = () => new Promise((resolve) => setTimeout(resolve, 600));

describe('TreeGrid — rows slide in and out (FR2-AC8, D-16)', () => {
  it('slides an arriving row down into place', async () => {
    const { rerender } = render(<Grid open={false} />);
    await measured();

    rerender(<Grid open />);

    await waitFor(() => expect(animationFor(rowNamed('one'))).toBeDefined());
    // A row height of zero: jsdom lays nothing out, so every box it measures is empty. That the
    // distance is the row's own height is the plugin's own test; that it is a `translateY` at
    // all is what this one is about.
    expect(animationFor(rowNamed('one'))?.effect.keyframes).toEqual([
      { transform: 'translateY(-0px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 },
    ]);
    // The row beneath travels with them rather than jumping — and never fades, because it is
    // not going anywhere.
    expect(animationFor(rowNamed('tail'))?.effect.keyframes).toEqual([
      { transform: 'translateY(0px)' },
      { transform: 'translateY(0)' },
    ]);
  });

  it('slides a departing row out and only then takes it out of the DOM', async () => {
    const { rerender } = render(<Grid open />);
    await measured();
    const departing = rowNamed('one');

    rerender(<Grid open={false} />);

    await waitFor(() => expect(animationFor(departing)).toBeDefined());
    expect(departing.isConnected).toBe(true);
    expect(animationFor(departing)?.effect.keyframes).toEqual([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(-0px)', opacity: 0 },
    ]);

    await waitFor(() => expect(departing.isConnected).toBe(false));
  });

  it('hides a departing row from a screen reader for the whole of its lingering (D-15a)', async () => {
    const { rerender } = render(<Grid open />);
    await measured();
    const departing = [rowNamed('one'), rowNamed('two')];

    rerender(<Grid open={false} />);

    await waitFor(() => {
      for (const row of departing) expect(row).toHaveAttribute('aria-hidden', 'true');
    });
    for (const row of departing) {
      expect(row).toHaveAttribute('inert');
      // Still here — which is the whole reason it has to be hidden.
      expect(row.isConnected).toBe(true);
    }

    await waitFor(() => {
      for (const row of departing) expect(row.isConnected).toBe(false);
    });
  });
});

describe('TreeGrid — mounted twice, as React does in development', () => {
  it('animates an arriving row once, having registered the library once', async () => {
    const { rerender } = render(
      <StrictMode>
        <Grid open={false} />
      </StrictMode>,
    );
    await measured();

    rerender(
      <StrictMode>
        <Grid open />
      </StrictMode>,
    );

    const arriving = await waitFor(() => {
      const row = rowNamed('one');
      expect(animationFor(row)).toBeDefined();
      return row;
    });
    // A second registration would answer the same insertion a moment later and cancel the slide
    // that the first one had just started — measured in Chrome: the row never moved.
    await measured();
    expect(started.filter((animation) => animation.effect.target === arriving)).toHaveLength(1);
  });
});

describe('TreeGrid — under prefers-reduced-motion (FR2-AC8)', () => {
  it('animates nothing at all, and a closed row is gone at once', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const { rerender } = render(<Grid open />);
    // Waited out all the same, so this proves the setting rather than the library's debounce.
    await measured();
    const departing = rowNamed('one');

    const closedAt = performance.now();
    rerender(<Grid open={false} />);

    expect(departing.isConnected).toBe(false);
    expect(performance.now() - closedAt).toBeLessThan(50);
    // Give the library the chance it would have taken: it was never switched on.
    await waitFor(() => expect(rowNamed('root')).toBeDefined());
    expect(started).toHaveLength(0);
  });
});
