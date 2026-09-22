/**
 * The letters that stand in for the adviser photograph the design shows: the first letter of the
 * first two words, uppercased — "Anna Blackwood" → "AB" (FR5-AC1). A one-word name gives one
 * letter, and an empty name gives nothing. Spread rather than indexed so an accented or
 * astral first letter survives whole.
 */
export const toInitials = (name: string): string =>
  name
    .split(/\s+/u)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toUpperCase();
