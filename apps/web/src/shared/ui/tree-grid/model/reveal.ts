/** A row's vertical extent in the viewport, already widened by its scroll margin. */
export type RevealBox = { top: number; bottom: number };

/**
 * How far the page must scroll so that a row just opened shows what it revealed (FR2, amended
 * 2026-09-23): the least that brings the opened row and as many of its new rows as fit on
 * screen — positive is down, `0` is not at all.
 *
 * Only whole rows count as fitting, and the first new row always does, so when more appear than
 * the screen can hold the page stops with the opened row at the top and the first of them
 * beneath it. It never carries the user past the row they clicked: the opened row's top is the
 * furthest down the page will go.
 */
export const revealDelta = (
  opened: RevealBox,
  revealed: readonly RevealBox[],
  viewportHeight: number,
): number => {
  const first = revealed[0];
  if (first === undefined) return 0;

  let last = first;
  for (const row of revealed) {
    if (row.bottom - opened.top > viewportHeight) break;
    last = row;
  }

  if (last.bottom > viewportHeight) return Math.min(last.bottom - viewportHeight, opened.top);
  // Everything fits already, unless the opened row itself is cut off at the top.
  return Math.min(opened.top, 0);
};

/** An element's box, widened by the `scroll-margin` that keeps it clear of the window's edge. */
const boxOf = (element: Element): RevealBox => {
  const { top, bottom } = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    top: top - (parseFloat(style.scrollMarginTop) || 0),
    bottom: bottom + (parseFloat(style.scrollMarginBottom) || 0),
  };
};

/**
 * Scrolls the page so the rows `opened` has just revealed come into view, by `revealDelta`.
 *
 * Called in the commit that inserted them, before the browser paints and before the rows start
 * to slide (D-8, D-16): the animation library starts its slides from a mutation observer, which
 * runs after React's layout effects, so what is measured here is the rows' final layout, with no
 * transform on it yet. Waiting for the slide to finish instead measured the same boxes (Chrome 153
 * and WebKit both report a sliding row's settled box — measured 2026-09-23) and left a quarter of
 * a second in which the user could scroll somewhere else and then be carried back.
 */
export const revealRows = (opened: Element, revealed: readonly Element[]): void => {
  const delta = revealDelta(
    boxOf(opened),
    revealed.map(boxOf),
    document.documentElement.clientHeight,
  );
  if (delta !== 0) window.scrollBy({ top: delta, behavior: 'instant' });
};
