// @layer: e2e
// @spec: 003-clients-trend-chart
//
// FR7 "Movement": the bars grow up from the bottom once when the figures arrive, and are simply
// there under reduced motion. Measured frame by frame from the moment the page starts: a recorder
// installed before any script runs sums the painted height of every bar segment on each frame.
import { expect, test, type Page } from '@playwright/test';
import { chartOf, expectReading, hoverMonth } from './support/chart';
import { installClientsDouble } from './support/clients-double';
import { shippedClients } from './support/table';

type Frame = { heights: number; bottom: number; segments: number };
type Recorded = Window & { __frames?: Frame[] };

/** Starts recording on every frame, before the app's own code runs. */
const recordFrames = (page: Page) =>
  page.addInitScript(() => {
    const frames: Frame[] = [];
    (window as Recorded).__frames = frames;
    const sample = () => {
      const paths = [...document.querySelectorAll('.recharts-bar path')];
      if (paths.length > 0) {
        const boxes = paths.map((path) => path.getBoundingClientRect());
        frames.push({
          heights: boxes.reduce((sum, box) => sum + box.height, 0),
          bottom: Math.max(...boxes.map((box) => box.bottom)),
          segments: paths.length,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

const framesOf = (page: Page) => page.evaluate(() => (window as Recorded).__frames ?? []);

const open = async (page: Page, motion: 'reduce' | 'no-preference') => {
  await page.emulateMedia({ reducedMotion: motion });
  await recordFrames(page);
  await installClientsDouble(page, { body: shippedClients() });
  await page.goto('/');
  const chart = chartOf(page);
  await expect(chart.svg).toBeVisible();
  return chart;
};

/** Waits until the painted heights have held still for a second. */
const settledHeight = async (page: Page): Promise<number> => {
  let last = -1;
  await expect
    .poll(
      async () => {
        const frames = await framesOf(page);
        const now = frames.at(-1)?.heights ?? -1;
        const still = now > 0 && now === last;
        last = now;
        return still;
      },
      { intervals: [1000], timeout: 10_000 },
    )
    .toBe(true);
  return last;
};

test(
  'FR7-AC1: when the figures arrive the bars grow up from the bottom once, then stay still',
  { tag: '@regression' },
  async ({ page }) => {
    const chart = await open(page, 'no-preference');
    const final = await settledHeight(page);
    const frames = await framesOf(page);
    const grown = frames.filter(({ heights }) => heights > 0);
    const distinct = new Set(grown.map(({ heights }) => heights.toFixed(2)));
    // Growth: many heights on the way up …
    expect(distinct.size).toBeGreaterThan(3);
    // … never shrinking, from a standing bottom …
    grown
      .slice(1)
      .forEach(({ heights }, i) =>
        expect(heights).toBeGreaterThanOrEqual(grown[i]!.heights - 0.01),
      );
    const bottoms = new Set(grown.map(({ bottom }) => bottom.toFixed(1)));
    expect(bottoms.size).toBe(1);
    // … and exactly once: reading months afterwards replays nothing.
    const count = frames.length;
    for (const [index, month] of [
      [0, '2024-02'],
      [6, '2024-08'],
      [11, '2025-01'],
    ] as const) {
      await hoverMonth(chart, index);
      await expectReading(chart, month);
    }
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    const after = (await framesOf(page)).slice(count);
    expect(after.length).toBeGreaterThan(0);
    for (const frame of after) expect(frame.heights).toBeCloseTo(final, 2);
  },
);

test(
  'FR7-AC2: with reduced motion the bars are fully drawn from the first frame, with no growth',
  { tag: '@regression' },
  async ({ page }) => {
    await open(page, 'reduce');
    const final = await settledHeight(page);
    const frames = await framesOf(page);
    const drawn = frames.filter(({ segments }) => segments === 36);
    expect(drawn.length).toBeGreaterThan(0);
    // The very first frame with bars in it already holds their final height.
    expect(frames[0]!.heights).toBeCloseTo(final, 2);
    expect(new Set(frames.map(({ heights }) => heights.toFixed(2))).size).toBe(1);
  },
);
