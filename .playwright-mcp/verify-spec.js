async (page) => {
  const DIR = '/Users/dusty/projects/test-tasks/nevishealth/docs/screenshots/';
  const P = '001-clients-data-dashboard-shell-';
  const state = () => page.evaluate(() => {
    const grid = document.querySelector('main > div');
    const alert = document.querySelector('[role=alert]');
    const btn = document.querySelector('button');
    return {
      busy: grid ? grid.getAttribute('aria-busy') : null,
      status: (document.querySelector('[role=status]') || {}).textContent,
      skeletonBlocks: document.querySelectorAll('[aria-hidden="true"]').length,
      cards: [...document.querySelectorAll('section')].map((s) => {
        const r = s.getBoundingClientRect();
        return { label: s.getAttribute('aria-label'), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
      }),
      texts: [...document.querySelectorAll('section p')].map((p) => p.textContent),
      alert: alert ? alert.textContent : null,
      retry: btn ? btn.textContent : null,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      focus: document.activeElement ? document.activeElement.tagName : null,
      clipped: [...document.querySelectorAll('section p, h1, button')].some((el) => el.scrollWidth > el.clientWidth + 1),
      lang: document.documentElement.lang,
    };
  });
  const out = {};

  // --- announcement timeline (FR3: silent, then text after ~1 s, then silent) at 1440
  await page.setViewportSize({ width: 1440, height: 900 });
  const marks = [];
  await page.goto('http://localhost:5173/?delay=4000', { waitUntil: 'commit' });
  const t0 = Date.now();
  for (const at of [200, 700, 1400, 2500]) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    marks.push({ ms: Date.now() - t0, status: await page.evaluate(() => (document.querySelector('[role=status]') || {}).textContent) });
  }
  out.announcement = marks;
  out.loading1440 = await state();
  await page.screenshot({ path: DIR + P + 'loading-1440.png' });
  await page.waitForSelector('text=Company · 3 branches', { timeout: 8000 });
  out.loaded1440 = await state();
  await page.screenshot({ path: DIR + P + 'loaded-1440.png' });
  out.announcementAfterLoad = await page.evaluate(() => (document.querySelector('[role=status]') || {}).textContent);

  // --- fast load is silent (FR3 amended)
  await page.goto('http://localhost:5173/', { waitUntil: 'commit' });
  await page.waitForSelector('text=Company · 3 branches', { timeout: 8000 });
  await page.waitForTimeout(1300);
  out.fastLoadStatus = await page.evaluate(() => (document.querySelector('[role=status]') || {}).textContent);

  // --- failed state + Retry (FR4) at 1440
  await page.goto('http://localhost:5173/?fail=1', { waitUntil: 'commit' });
  const tf = Date.now();
  await page.waitForSelector('[role=alert]', { timeout: 4000 });
  out.failPanelMs = Date.now() - tf;
  out.failed1440 = await state();
  await page.screenshot({ path: DIR + P + 'failed-1440.png' });
  await page.keyboard.press('Tab');
  out.tabReaches = await page.evaluate(() => document.activeElement.textContent);
  const navBefore = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  out.duringRetry = { busy: (await state()).busy, focus: (await state()).focus };
  await page.waitForSelector('[role=alert]', { timeout: 4000 });
  out.retryKeptSwitch = await page.evaluate(() => location.search);
  out.navigationsAfterRetry = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  out.navigationsBeforeRetry = navBefore;

  // --- 375 px, three states (FR7)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:5173/?delay=4000', { waitUntil: 'commit' });
  await page.waitForTimeout(600);
  out.loading375 = await state();
  await page.screenshot({ path: DIR + P + 'loading-375.png' });
  await page.waitForSelector('text=Company · 3 branches', { timeout: 8000 });
  out.loaded375 = await state();
  await page.screenshot({ path: DIR + P + 'loaded-375.png' });
  await page.goto('http://localhost:5173/?fail=1', { waitUntil: 'commit' });
  await page.waitForSelector('[role=alert]', { timeout: 4000 });
  out.failed375 = await state();
  await page.screenshot({ path: DIR + P + 'failed-375.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  return out;
}
