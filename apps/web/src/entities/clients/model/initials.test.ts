import { describe, expect, it } from 'vitest';
import { toInitials } from './initials';

describe('toInitials (FR5-AC1)', () => {
  it('takes the first letter of the first two words', () => {
    expect(toInitials('Anna Blackwood')).toBe('AB');
    expect(toInitials('Maria Gutierrez')).toBe('MG');
  });

  it('uppercases whatever case the name arrives in', () => {
    expect(toInitials('anna blackwood')).toBe('AB');
  });

  it('gives a one-word name a single initial', () => {
    expect(toInitials('Company')).toBe('C');
  });

  it('keeps accents rather than stripping them', () => {
    expect(toInitials('Élena Rossi')).toBe('ÉR');
    expect(toInitials('Ösgur')).toBe('Ö');
  });

  it('ignores the words past the second, and any extra whitespace', () => {
    expect(toInitials('  Maria   de  Gutierrez ')).toBe('MD');
  });

  it('has nothing to show for an empty name', () => {
    expect(toInitials('')).toBe('');
    expect(toInitials('   ')).toBe('');
  });
});
