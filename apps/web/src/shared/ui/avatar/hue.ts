/**
 * A stable hue for a seed: the same subject always gets the same circle, and two subjects
 * beside each other almost never get the same one (D-12). FNV-1a in signed 32-bit, folded onto
 * the colour wheel by its absolute value (so `h` and `-h` share a hue) — a hash rather than a
 * palette lookup, because the number of subjects is whatever the data holds.
 *
 * Only the hue varies. Saturation and lightness are tokens, so the initials stay near-black on
 * a light tint at every hue and the contrast is safe wherever the wheel lands.
 */
export const hueOf = (seed: string): number => {
  let hash = 0x811c9dc5;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    // The FNV prime, multiplied in 32-bit pieces so the result never leaves exact-integer range.
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % 360;
};
