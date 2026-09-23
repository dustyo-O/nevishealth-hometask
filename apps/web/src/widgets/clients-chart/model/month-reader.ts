/** Which month is being read, and whether its panel and announcement are showing. */
export type MonthReader = {
  /** Index into the series' points; February 2024, the first month, is 0. */
  index: number;
  open: boolean;
};

export type MonthReaderAction =
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'key'; key: string; months: number }
  | { type: 'escape' }
  | { type: 'hover'; index: number }
  | { type: 'leave' }
  | { type: 'tap'; index: number }
  | { type: 'outside' };

/** Where every visit starts: on the first month, with nothing shown. */
export const CLOSED: MonthReader = { index: 0, open: false };

const STEP: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

/** The state for `index`, open — or `state` itself when that is what it already is. */
const show = (state: MonthReader, index: number): MonthReader =>
  state.open && state.index === index ? state : { index, open: true };

const hide = (state: MonthReader): MonthReader =>
  state.open ? { index: state.index, open: false } : state;

/**
 * The one state both the pointer and the keyboard write to (003 §2.7), and every FR4/FR5 rule
 * in one place. Arriving reads February; Left and Right move one month and stop at either end
 * rather than wrapping; Escape closes but keeps the month, so the next move opens it again;
 * leaving closes **and** resets to February, because the dashboard remembers nothing between
 * visits (FR5-AC7). A step that changes nothing returns the same object, so React skips the
 * render and the live region is not rewritten with the month it already says (FR6-AC3).
 */
export const readMonth = (state: MonthReader, action: MonthReaderAction): MonthReader => {
  switch (action.type) {
    case 'focus':
      return show(state, 0);
    case 'blur':
      return state.open || state.index !== 0 ? CLOSED : state;
    case 'key': {
      const step = STEP[action.key];
      if (step === undefined) return state;
      const index = Math.min(Math.max(state.index + step, 0), action.months - 1);
      return show(state, index);
    }
    case 'hover':
    case 'tap':
      return show(state, action.index);
    case 'escape':
    case 'leave':
    case 'outside':
      return hide(state);
  }
};
