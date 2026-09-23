import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { MonthlySeries } from '@/entities/clients';
import { describeMonth } from '../lib/describe-month';
import { monthAt } from '../lib/plot-geometry';
import { CLOSED, readMonth } from './month-reader';

/**
 * Recharts renders twelve `<g tabindex="-1">` layers, so a click or a tap would move focus into
 * the `aria-hidden` drawing. Load-bearing: without it focus lands inside the hidden subtree
 * (003 §2.4, consult Q5).
 */
const keepFocusOutOfTheDrawing = (event: MouseEvent) => event.preventDefault();

/** The month under the pointer, from the drawing's own geometry (003 §2.7). */
const monthUnder = (event: PointerEvent<HTMLElement>, months: number) => {
  const box = event.currentTarget.getBoundingClientRect();
  return monthAt({ x: event.clientX - box.left, y: event.clientY - box.top }, box, months);
};

/**
 * The chart's interaction: the keyboard on the focusable plot, the pointer on the drawing inside
 * it, both writing to the one `readMonth` state (003 §2.7). Spread `plotProps` on the focus
 * target and `drawingProps` on the `aria-hidden` wrapper around what is drawn; render the panel
 * and the tint from `point`, and put `announcement` in the polite live region.
 */
export const useMonthReader = (series: MonthlySeries) => {
  const [{ index, open }, dispatch] = useReducer(readMonth, CLOSED);
  // The live region speaks for the outline only; a pointer sweeping the year is for the eye.
  const [focused, setFocused] = useState(false);
  const drawingRef = useRef<HTMLDivElement>(null);
  const months = series.points.length;

  // A tap anywhere outside the plot box closes the month: the legend, the card's padding, the
  // table card (FR4-AC6/AC7). Scoped to the plot box, not the widget root, or a tap on our own
  // legend would leave it open (tech review F2). Listening only while open costs nothing else.
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && drawingRef.current?.contains(event.target)) return;
      dispatch({ type: 'outside' });
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  // The pointer moving off the chart closes the month (FR4-AC3). A native listener, not React's
  // `onPointerLeave`: React builds that from `pointerout`, and Chromium sends none when the node
  // under the pointer has been replaced — measured, twenty fast exits left the panel behind. A
  // touch is ignored: its pointer leaves the moment the finger lifts, and a tap must stay open.
  useEffect(() => {
    const wrapper = drawingRef.current;
    if (wrapper === null) return undefined;
    const leave = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'touch') dispatch({ type: 'leave' });
    };
    wrapper.addEventListener('pointerleave', leave);
    return () => wrapper.removeEventListener('pointerleave', leave);
  }, []);

  const point = open ? series.points[index] : undefined;
  const announcement = point === undefined || !focused ? '' : describeMonth(point, series.channels);

  const plotProps = {
    onFocus: () => {
      setFocused(true);
      dispatch({ type: 'focus' });
    },
    onBlur: () => {
      setFocused(false);
      dispatch({ type: 'blur' });
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatch({ type: 'escape' });
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      dispatch({ type: 'key', key: event.key, months });
    },
  };

  const drawingProps = {
    ref: drawingRef,
    onMouseDown: keepFocusOutOfTheDrawing,
    // A tap or a click inside the plot box: a column selects its month, above the bar as much as
    // on it; the axes around the columns count as outside (FR4).
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const under = monthUnder(event, months);
      dispatch(under === undefined ? { type: 'outside' } : { type: 'tap', index: under });
    },
    // A touch has no hover, and its pointer leaves the moment the finger lifts: taps are their own.
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch') return;
      const under = monthUnder(event, months);
      dispatch(under === undefined ? { type: 'leave' } : { type: 'hover', index: under });
    },
  };

  return { index, point, announcement, plotProps, drawingProps };
};
