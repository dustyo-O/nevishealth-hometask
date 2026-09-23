// @layer: e2e
// @spec: 004-supplied-payload-non-uniform-nesting
//
// Slice 1 drew a fourth part, "Not recorded", for the clients no channel accounted for; slice 3
// folds them into Existing clients (§2.3) and removes the part outright, so nothing dormant is
// left for a component review to find (R-3). Proved twice: no source file the app is built from
// mentions it, and nothing the browser is served — the page, its stylesheets — carries it either.
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { openChart } from './support/chart';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** The name, the token and its swatch classes, the constant, and slice 1's `shown` flag. */
const TRACES = [/not[\s_-]?recorded/i, /\bshown:/];

const tracesIn = (where: string, text: string) =>
  TRACES.filter((trace) => trace.test(text)).map((trace) => `${where} ${trace}`);

test(
  'R-3: no source file references the fourth part — no token, swatch class, channel entry, flag or label',
  { tag: '@regression' },
  () => {
    // Tests are left out: they are the files allowed to say the name, to prove it is gone.
    const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
      (file) => /\.(ts|tsx|css)$/.test(file) && !/\.test\.tsx?$/.test(file),
    );
    const read = files.map((file) => file.split(sep).join('/'));
    expect(read).toEqual(
      expect.arrayContaining([
        'shared/styles/tokens.css',
        'widgets/clients-chart/model/channels.ts',
        'widgets/clients-chart/ui/chart-legend.module.css',
      ]),
    );
    const traces = files.flatMap((file) => tracesIn(file, readFileSync(join(SRC, file), 'utf8')));
    expect(traces).toEqual([]);
  },
);

test(
  'FR3-AC6 / FR5-AC1: the page as served says "Not recorded" nowhere — not in its text, markup or stylesheets',
  { tag: '@regression' },
  async ({ page }) => {
    await openChart(page);
    const served = await page.evaluate(() => ({
      text: document.body.innerText,
      markup: document.documentElement.outerHTML,
      styles: [...document.styleSheets]
        .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
        .join('\n'),
    }));
    expect(served.styles).toMatch(/--color-channel-existing/);
    expect([
      ...tracesIn('text', served.text),
      ...tracesIn('markup', served.markup),
      ...tracesIn('styles', served.styles),
    ]).toEqual([]);
  },
);
