const ISO_MONTH = /^(\d{4})-(\d{2})$/;

/** Locale pinned to English and the calendar to UTC: `"2024-02"` is "Feb 2024" on every machine. */
const monthFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `"2024-02"` → `"Feb 2024"` (spec 001 FR5). The contract guarantees the input format. */
export const formatMonth = (isoMonth: string): string => {
  const match = ISO_MONTH.exec(isoMonth);
  if (match === null) throw new RangeError(`Not an ISO month (YYYY-MM): "${isoMonth}"`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return monthFormatter.format(Date.UTC(year, monthIndex, 1));
};
