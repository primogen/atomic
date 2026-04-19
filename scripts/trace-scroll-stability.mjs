#!/usr/bin/env node
// Measure whether scrolling in edit mode shifts line positions.
//
// For a static document, a line's absolute position in the document
// (line.offsetTop + container.scrollTop) should be invariant under scroll.
// If it changes, CodeMirror's heightmap is being re-measured mid-scroll,
// and the user sees content "snap" or drift.
//
// Pick a landmark line well below the initial viewport, scroll in steps
// until it's visible, and report its absolute position at each step.

import { chromium } from 'playwright';

const APP = process.env.ATOMIC_URL || 'http://localhost:1420';
const ATOM_ID = process.env.ATOM_ID || '71545095-8070-41c3-9e62-81b22fe11c3b';
const LANDMARK = process.env.LANDMARK || 'OpenTimelineIO';

async function main() {
  const authToken = process.env.ATOMIC_AUTH_TOKEN;
  if (!authToken) throw new Error('ATOMIC_AUTH_TOKEN required');
  const serverUrl = process.env.ATOMIC_SERVER_URL || 'http://localhost:8080';

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));

  await page.goto(APP);
  await page.evaluate(
    ({ url, token }) => {
      localStorage.setItem(
        'atomic-server-config',
        JSON.stringify({ baseUrl: url, authToken: token })
      );
    },
    { url: serverUrl, token: authToken }
  );
  await page.goto(`${APP}/atoms/${ATOM_ID}`);
  await page.waitForSelector('article', { timeout: 30000 });
  await page.click('button[title="Edit"]');
  await page.waitForSelector('.cm-editor', { timeout: 5000 });
  await page.waitForTimeout(500);

  // Measure the absolute position of the landmark line at the current scroll.
  const sample = async (label) => {
    const m = await page.evaluate((landmark) => {
      const c = document.querySelector('.scrollbar-auto-hide') ||
        document.querySelector('.overflow-y-auto');
      if (!c) return null;
      const lines = Array.from(document.querySelectorAll('.cm-line'));
      const hit = lines.find((l) => (l.textContent || '').includes(landmark));
      if (!hit) return { missing: true, scrollTop: c.scrollTop };
      const r = hit.getBoundingClientRect();
      const crect = c.getBoundingClientRect();
      // Absolute position inside the scrollable content = rect.top - container.top + container.scrollTop.
      const abs = (r.top - crect.top) + c.scrollTop;
      return {
        scrollTop: c.scrollTop,
        viewportTop: r.top - crect.top,
        absY: abs,
        h: r.height,
        totalHeight: c.scrollHeight,
      };
    }, LANDMARK);
    console.log(
      `  ${label.padEnd(24)} scroll=${m?.scrollTop?.toFixed(0).padStart(5)}  ` +
        (m?.missing
          ? 'LANDMARK NOT IN DOM'
          : `absY=${m?.absY?.toFixed(1).padStart(8)}  docH=${m?.totalHeight}`)
    );
    return m;
  };

  console.log(`Landmark: "${LANDMARK}"`);
  console.log(`If absY shifts across steps, CM's heightmap drifted on scroll.\n`);

  // Make sure we're at the top first.
  await page.evaluate(() => {
    const c = document.querySelector('.scrollbar-auto-hide') ||
      document.querySelector('.overflow-y-auto');
    if (c) c.scrollTop = 0;
  });
  await page.waitForTimeout(200);

  await sample('scrollTop=0');

  // Scroll down in steps. Each step, re-measure.
  const steps = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000];
  const results = [];
  for (const top of steps) {
    await page.evaluate((t) => {
      const c = document.querySelector('.scrollbar-auto-hide') ||
        document.querySelector('.overflow-y-auto');
      if (c) c.scrollTop = t;
    }, top);
    await page.waitForTimeout(200);
    const m = await sample(`scrollTop=${top}`);
    if (m && !m.missing) results.push(m.absY);
  }

  // Scroll back to top and re-measure.
  await page.evaluate(() => {
    const c = document.querySelector('.scrollbar-auto-hide') ||
      document.querySelector('.overflow-y-auto');
    if (c) c.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  await sample('back to scrollTop=0');

  const min = Math.min(...results);
  const max = Math.max(...results);
  console.log(`\nLandmark absY range across scrolls: ${min.toFixed(1)} .. ${max.toFixed(1)} (drift = ${(max - min).toFixed(1)}px)`);
  if (max - min > 5) {
    console.log('⚠ Heightmap drifted: the document is not stable under scroll.');
  } else {
    console.log('✓ Stable.');
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
