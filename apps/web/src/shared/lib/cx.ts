type ClassValue = string | false | null | undefined;

/** Joins class names, dropping the falsy ones — the one way CSS Module classes are combined. */
export const cx = (...classes: ClassValue[]): string => classes.filter(Boolean).join(' ');
