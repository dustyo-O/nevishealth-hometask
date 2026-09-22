import { describe, expect, it } from 'vitest';
import { formatMonth } from './format-month';

describe('formatMonth', () => {
  it('renders an ISO month as short English month + year', () => {
    expect(formatMonth('2024-02')).toBe('Feb 2024');
    expect(formatMonth('2025-01')).toBe('Jan 2025');
    expect(formatMonth('2024-12')).toBe('Dec 2024');
  });

  it('refuses anything that is not YYYY-MM', () => {
    expect(() => formatMonth('2024-2')).toThrow(RangeError);
    expect(() => formatMonth('Feb 2024')).toThrow(RangeError);
  });
});
