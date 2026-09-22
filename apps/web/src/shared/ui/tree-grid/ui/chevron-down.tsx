/**
 * The design's `Icon / Chevron down` (`context/inbox/design/icon-chevron-down.svg`), inlined so
 * it takes the row's colour through `currentColor` and needs no second request. Decoration: the
 * row itself already reports open or closed to a screen reader (FR4-AC1), so this is hidden.
 */
export const ChevronDown = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="square"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M11.5 6.5L8 10L4.5 6.5" />
  </svg>
);
