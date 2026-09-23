import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import {
  formatMonth,
  readDevSwitches,
  toMonthlySeries,
  useClientsQuery,
  type MonthlySeries,
} from '@/entities/clients';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import { describeMonth } from '../lib/describe-month';
import {
  COLUMNS_LEFT,
  COLUMNS_RIGHT,
  PLOT_MARGIN,
  X_AXIS_HEIGHT,
  monthAt,
} from '../lib/plot-geometry';
import { CLOSED, readMonth } from '../model/month-reader';
import { BarPlot, type PlotDimension } from './bar-plot';
import { ChartDataTable } from './chart-data-table';
import { ChartLegend } from './chart-legend';
import styles from './clients-chart.module.css';
import { MonthPanel } from './month-panel';

export type ClientsChartProps = {
  /**
   * The size to draw at before the plot box has been measured. Only tests pass it: jsdom has no
   * `ResizeObserver`, so without it the drawing renders no SVG at all (003 R-5).
   */
  initialDimension?: PlotDimension;
};

const HINT = 'Use Left and Right to read each month.';

/** "Clients per month by acquisition channel, Feb 2024 to Jan 2025", from the months shown. */
const nameOf = ({ points }: MonthlySeries): string => {
  const first = points.at(0);
  const last = points.at(-1);
  const period = first && last ? `, ${formatMonth(first.month)} to ${formatMonth(last.month)}` : '';
  return `Clients per month by acquisition channel${period}`;
};

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
 * Where the drawing puts its columns, handed to the stylesheet so the panel stands beside the
 * same column the library draws. Values from `plot-geometry`, which lays out the drawing too.
 */
const columnsOf = (months: number) =>
  ({
    '--months': months,
    '--columns-left': `${COLUMNS_LEFT}px`,
    '--columns-right': `${COLUMNS_RIGHT}px`,
    '--plot-top': `${PLOT_MARGIN.top}px`,
    '--plot-bottom': `${PLOT_MARGIN.bottom + X_AXIS_HEIGHT}px`,
  }) as CSSProperties;

/**
 * The upper card of the dashboard: the company's twelve months as stacked bars, one part per
 * acquisition channel, with the legend beneath (spec 003 FR1–FR3). Company-wide always — the
 * table's drill-down never reaches it.
 *
 * Recharts draws and the widget owns the semantics (003 §2.4): one focus stop named for what it
 * shows, Left and Right reading a month at a time into a polite live region, and the same
 * figures as a hidden table beside it (FR5, FR6).
 */
export const ClientsChart = ({ initialDimension }: ClientsChartProps) => {
  // Read once, like the page: changing a switch means changing the address, which reloads.
  const [switches] = useState(() => readDevSwitches(window.location.search));
  const { data } = useClientsQuery(switches);
  // Memoised so a refetch with the same figures hands the drawing the same series (FR7-AC1).
  const series = useMemo(() => (data === undefined ? undefined : toMonthlySeries(data)), [data]);
  const [reader, dispatch] = useReducer(readMonth, CLOSED);
  // The live region speaks for the outline only; a pointer sweeping the year is for the eye.
  const [focused, setFocused] = useState(false);
  const hintId = useId();
  const drawingRef = useRef<HTMLDivElement>(null);

  // A tap anywhere outside the plot box closes the month: the legend, the card's padding, the
  // table card (FR4-AC6/AC7). Scoped to the plot box, not the widget root, or a tap on our own
  // legend would leave it open (tech review F2). Listening only while open costs nothing else.
  useEffect(() => {
    if (!reader.open) return undefined;
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && drawingRef.current?.contains(event.target)) return;
      dispatch({ type: 'outside' });
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [reader.open]);

  // The pointer moving off the chart closes the month (FR4-AC3). A native listener, not React's
  // `onPointerLeave`: React builds that from `pointerout`, and Chromium sends none when the node
  // under the pointer has been replaced — measured, twenty fast exits left the panel behind. A
  // touch is ignored: its pointer leaves the moment the finger lifts, and a tap must stay open.
  const drawn = series !== undefined;
  useEffect(() => {
    const drawing = drawingRef.current;
    if (!drawn || drawing === null) return undefined;
    const leave = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'touch') dispatch({ type: 'leave' });
    };
    drawing.addEventListener('pointerleave', leave);
    return () => drawing.removeEventListener('pointerleave', leave);
  }, [drawn]);

  // The page only mounts the chart once the figures are here; this is the belt to that braces.
  if (series === undefined) return null;

  const name = nameOf(series);
  const months = series.points.length;
  const point = reader.open ? series.points[reader.index] : undefined;
  const announcement = point === undefined || !focused ? '' : describeMonth(point, series.channels);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      dispatch({ type: 'escape' });
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    dispatch({ type: 'key', key: event.key, months });
  };

  // A touch has no hover, and its pointer leaves the moment the finger lifts: taps are their own.
  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return;
    const index = monthUnder(event, months);
    dispatch(index === undefined ? { type: 'leave' } : { type: 'hover', index });
  };

  // A tap or a click inside the plot box: a column selects its month, above the bar as much as on
  // it; the axes around the columns count as outside (FR4).
  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    const index = monthUnder(event, months);
    dispatch(index === undefined ? { type: 'outside' } : { type: 'tap', index });
  };

  return (
    <div className={styles.chart}>
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex --
          A chart has no interactive ARIA role; a focusable named group that owns Left, Right and
          Escape is the specified structure (003 §2.4), measured with axe at zero violations. */}
      <div
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={name}
        aria-describedby={hintId}
        className={styles.plot}
        onFocus={() => {
          setFocused(true);
          dispatch({ type: 'focus' });
        }}
        onBlur={() => {
          setFocused(false);
          dispatch({ type: 'blur' });
        }}
        onKeyDown={handleKeyDown}
      >
        {/* The drawing carries no readable text of its own (FR6-AC4). */}
        <div
          ref={drawingRef}
          aria-hidden="true"
          className={styles.drawing}
          style={columnsOf(months)}
          onMouseDown={keepFocusOutOfTheDrawing}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          {/* The tint is ours, placed from the widget's index: the library's cursor follows its
              own hover index, measured disagreeing with ours after hover-then-Tab (tech review
              F1). Before the drawing, so the bars paint over it. */}
          {point !== undefined && (
            <div
              data-month={point.month}
              className={styles.tint}
              style={{ '--month-index': reader.index } as CSSProperties}
            />
          )}
          <BarPlot series={series} initialDimension={initialDimension} />
          {point !== undefined && (
            <MonthPanel
              point={point}
              channels={series.channels}
              index={reader.index}
              months={months}
            />
          )}
        </div>
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      {/* Referenced as the group's description only; `hidden` keeps it out of reading order. */}
      <span id={hintId} hidden>
        {HINT}
      </span>
      {/* Polite, and empty while nothing is being read: one announcement per move (FR6-AC1/AC3). */}
      <VisuallyHidden as="p" role="status">
        {announcement}
      </VisuallyHidden>
      <ChartDataTable series={series} caption={name} />
      <ChartLegend channels={series.channels} className={styles.legend} />
    </div>
  );
};
