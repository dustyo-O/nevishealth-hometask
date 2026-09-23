import { describe, expect, it } from 'vitest';
import { revealDelta, type RevealBox } from './reveal';

/** Rows 56 px tall, stacked from `top`, as a revealed run beneath an opened row. */
const rowsFrom = (top: number, count: number): RevealBox[] =>
  Array.from({ length: count }, (_, i) => ({ top: top + i * 56, bottom: top + (i + 1) * 56 }));

describe('revealDelta — how far opening a row scrolls the page (FR2, amended)', () => {
  const VIEWPORT = 700;

  it('scrolls by the least that brings every new row into view, when they all fit', () => {
    const opened = { top: 580, bottom: 636 };
    const revealed = rowsFrom(636, 5);
    // The last one ends at 916; 216 px up puts it on the edge, and no more.
    expect(revealDelta(opened, revealed, VIEWPORT)).toBe(216);
  });

  it('does not scroll when the new rows are already on screen', () => {
    expect(revealDelta({ top: 100, bottom: 156 }, rowsFrom(156, 3), VIEWPORT)).toBe(0);
  });

  it('does not scroll when the row has nothing beneath it to show', () => {
    expect(revealDelta({ top: 650, bottom: 706 }, [], VIEWPORT)).toBe(0);
  });

  it('shows as many whole rows as fit when more appear than the screen holds, and stops at the opened row', () => {
    const opened = { top: 580, bottom: 636 };
    const revealed = rowsFrom(636, 20);
    const delta = revealDelta(opened, revealed, VIEWPORT);
    // Eleven new rows fit beneath the opened one (12 × 56 = 672 ≤ 700); the twelfth does not.
    expect(delta).toBe(636 + 11 * 56 - VIEWPORT);
    expect(opened.top - delta, 'the opened row is still on screen').toBeGreaterThanOrEqual(0);
    expect(revealed[0]!.bottom - delta, 'and the first new row beneath it').toBeLessThanOrEqual(
      VIEWPORT,
    );
  });

  it('never carries the user past the row they clicked, even on a screen too short for two rows', () => {
    const opened = { top: 50, bottom: 106 };
    expect(revealDelta(opened, rowsFrom(106, 3), 80)).toBe(50);
  });

  it('brings an opened row that is cut off at the top back into view', () => {
    expect(revealDelta({ top: -20, bottom: 36 }, rowsFrom(36, 2), VIEWPORT)).toBe(-20);
  });
});
