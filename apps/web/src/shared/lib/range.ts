/** `[0, 1, …, length - 1]` — for rendering a fixed number of identical placeholders. */
export const range = (length: number): number[] => Array.from({ length }, (_, index) => index);
