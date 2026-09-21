import { Card } from '@/shared/ui/card';
import styles from './dashboard-page.module.css';

/** The "Clients" page frame: heading and the two card slots of the design. States arrive in slices 2–3. */
export const DashboardPage = () => (
  <main className={styles.page}>
    <h1 className={styles.title}>Clients</h1>
    <div className={styles.grid}>
      <Card label="Clients chart" className={styles.chartSlot} />
      <Card label="Monthly detail" className={styles.tableSlot} />
    </div>
  </main>
);
