import { describe, expect, it } from 'vitest';
import { monthAt } from './plot-geometry';

/** 32 px of y-axis, 16 px of right margin: 1200 px of columns, 100 px a month. */
const BOX = { width: 1248, height: 338 };
const MONTHS = 12;
/** Inside the columns vertically: below the top margin (5), above the month labels (338 − 30). */
const MID = 150;

describe('monthAt', () => {
  it('finds the month by its column, from February at the y-axis to January at the right margin', () => {
    expect(monthAt({ x: 32, y: MID }, BOX, MONTHS)).toBe(0);
    expect(monthAt({ x: 131.9, y: MID }, BOX, MONTHS)).toBe(0);
    expect(monthAt({ x: 132, y: MID }, BOX, MONTHS)).toBe(1);
    expect(monthAt({ x: 32 + 4 * 100 + 50, y: MID }, BOX, MONTHS)).toBe(4);
    expect(monthAt({ x: 1231.9, y: MID }, BOX, MONTHS)).toBe(11);
  });

  it('counts the whole column, above the bar as well as on it (FR4)', () => {
    expect(monthAt({ x: 480, y: 5 }, BOX, MONTHS)).toBe(4);
    expect(monthAt({ x: 480, y: 308 }, BOX, MONTHS)).toBe(4);
  });

  it('finds no month on the axes or in the margins, so a tap there dismisses (FR4-AC6/AC7)', () => {
    expect(monthAt({ x: 31.9, y: MID }, BOX, MONTHS)).toBeUndefined(); // the scale's labels
    expect(monthAt({ x: 1232, y: MID }, BOX, MONTHS)).toBeUndefined(); // the right margin
    expect(monthAt({ x: 480, y: 4.9 }, BOX, MONTHS)).toBeUndefined(); // above the plot
    expect(monthAt({ x: 480, y: 308.1 }, BOX, MONTHS)).toBeUndefined(); // the month labels
    expect(monthAt({ x: -10, y: MID }, BOX, MONTHS)).toBeUndefined();
  });

  it('finds nothing in a box too narrow to hold a column, or with no months', () => {
    expect(monthAt({ x: 40, y: MID }, { width: 40, height: 338 }, MONTHS)).toBeUndefined();
    expect(monthAt({ x: 480, y: MID }, BOX, 0)).toBeUndefined();
  });
});
