import { describe, expect, it } from 'vitest';
import { CLOSED, readMonth, type MonthReader, type MonthReaderAction } from './month-reader';

const MONTHS = 12;
const FEB = 0;
const JUN = 4;
const JAN = MONTHS - 1;

/** Runs the actions in order from the state a fresh page starts in. */
const after = (...actions: MonthReaderAction[]): MonthReader => actions.reduce(readMonth, CLOSED);

const right = { type: 'key', key: 'ArrowRight', months: MONTHS } as const;
const left = { type: 'key', key: 'ArrowLeft', months: MONTHS } as const;
const focus = { type: 'focus' } as const;
const blur = { type: 'blur' } as const;
const escape = { type: 'escape' } as const;

describe('readMonth', () => {
  it('starts closed on February: nothing is read until the chart is reached', () => {
    expect(CLOSED).toEqual({ index: FEB, open: false });
  });

  it('reads February on arrival (FR5-AC2)', () => {
    expect(after(focus)).toEqual({ index: FEB, open: true });
  });

  it('moves one month with Right and back one with Left (FR5-AC3)', () => {
    expect(after(focus, right)).toEqual({ index: 1, open: true });
    expect(after(focus, right, right, left)).toEqual({ index: 1, open: true });
  });

  it('does not wrap past February: Left on February stays on February (FR5-AC5)', () => {
    const onFeb = after(focus);
    expect(readMonth(onFeb, left)).toBe(onFeb);
  });

  it('does not wrap past January: Right on January stays on January (FR5-AC4)', () => {
    const onJan = after(focus, ...Array.from({ length: 15 }, () => right));
    expect(onJan).toEqual({ index: JAN, open: true });
    expect(readMonth(onJan, right)).toBe(onJan);
  });

  it('closes the panel on Escape and keeps the month, so the outline stays put (FR5-AC6)', () => {
    expect(after(focus, right, escape)).toEqual({ index: 1, open: false });
  });

  it('opens again on the next move after Escape (FR5)', () => {
    expect(after(focus, right, right, escape, left)).toEqual({ index: 1, open: true });
  });

  it('closes and resets to February when the outline leaves — nothing is remembered (FR5-AC7)', () => {
    const away = after(focus, right, right, right, right, blur);
    expect(away).toEqual({ index: FEB, open: false });
    expect(readMonth(away, focus)).toEqual({ index: FEB, open: true });
    expect(after(focus, ...Array.from({ length: JUN }, () => right), blur, focus).index).toBe(FEB);
  });

  it('opens the month pointed at, and closes when the pointer leaves (FR4-AC1/AC3)', () => {
    const onJun = after({ type: 'hover', index: JUN });
    expect(onJun).toEqual({ index: JUN, open: true });
    expect(readMonth(onJun, { type: 'leave' })).toEqual({ index: JUN, open: false });
  });

  it('opens a tapped month, and a tap on another month replaces it (FR4-AC4/AC5)', () => {
    expect(after({ type: 'tap', index: 3 }, { type: 'tap', index: 7 })).toEqual({
      index: 7,
      open: true,
    });
  });

  it('closes on a tap outside the plot (FR4-AC6/AC7)', () => {
    expect(after({ type: 'tap', index: 3 }, { type: 'outside' })).toEqual({
      index: 3,
      open: false,
    });
  });

  it('ignores keys it does not own, and keeps the same state so nothing re-announces (FR6-AC3)', () => {
    const onMar = after(focus, right);
    expect(readMonth(onMar, { type: 'key', key: 'ArrowUp', months: MONTHS })).toBe(onMar);
    expect(readMonth(onMar, { type: 'hover', index: 1 })).toBe(onMar);
  });

  it('keeps the same state when closing what is already closed', () => {
    expect(readMonth(CLOSED, escape)).toBe(CLOSED);
    expect(readMonth(CLOSED, blur)).toBe(CLOSED);
  });
});
