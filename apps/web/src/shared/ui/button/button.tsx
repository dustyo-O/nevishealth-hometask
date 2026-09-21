import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './button.module.css';

/** Every native button attribute passes through; the type is always `button` (never a submit). */
export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;

export const Button = ({ className, ...rest }: ButtonProps) => (
  <button type="button" className={cx(styles.button, className)} {...rest} />
);
