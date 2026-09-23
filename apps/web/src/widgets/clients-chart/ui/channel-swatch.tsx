import { cx } from '@/shared/lib/cx';
import { channelKey } from '../model/channels';
import styles from './channel-swatch.module.css';

/** A channel's colour, for the eye only: the name always stands beside it (003 FR3). */
export const ChannelSwatch = ({ name }: { name: string }) => (
  <span aria-hidden="true" className={cx(styles.swatch, styles[channelKey(name)])} />
);
