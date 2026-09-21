import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cx } from '../../lib/cx';
import styles from './visually-hidden.module.css';

type HiddenTag = 'span' | 'p' | 'div';

export type VisuallyHiddenProps<T extends HiddenTag = 'span'> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

/** Content for assistive technology only (live regions, labels); never removed from the tree. */
export const VisuallyHidden = <T extends HiddenTag = 'span'>({
  as,
  className,
  ...rest
}: VisuallyHiddenProps<T>) => {
  const Tag: ElementType = as ?? 'span';
  return <Tag className={cx(styles.visuallyHidden, className)} {...rest} />;
};
