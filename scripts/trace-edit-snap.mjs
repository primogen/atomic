#!/usr/bin/env node
// Reproduce the view↔edit alignment issue on a real atom.
//
// Flow:
//   1. Navigate to the atom in view mode; scroll through to force all
//      lazy-loaded images to load.
//   2. Scroll to put a target image partially above the viewport.
//   3. Measure: img src + its top offset within the scroll container.
//   4. Click edit. Wait. Measure the same img.
//   5. Click Done. Wait. Measure again.
//   6. Click edit once more. Wait. Measure again.
//
// We expect the offset to stay within a few pixels across all toggles.

import { chromium } from 'playwright';

const APP = process.env.ATOMIC_URL || 'http://localhost:1420';
const ATOM_ID = process.env.ATOM_ID || '71545095-8070-41c3-9e62-81b22fe11c3b';
const SCROLL_TARGET = process.env.SCROLL_TARGET || 'Paraguay';
// How many pixels the target's top should sit above the viewport top —
// simulates the "partial cutoff at top" case the user reported.
const CUTOFF = Number(process.env.CUTOFF || 150);

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

  // Scroll through view to force lazy images to load.
  await page.evaluate(async () => {
    const c = document.querySelector('.scrollbar-auto-hide') ||
      document.querySelector('.overflow-y-auto');
    if (!c) return;
    while (c.scrollTop + c.clientHeight < c.scrollHeight - 1) {
      c.scrollBy(0, 600);
      await new Promise((r) => setTimeout(r, 120));
    }
    c.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 500));
  });

  // Scroll to the target, then push cutoff pixels further so target is
  // partially above viewport.
  await page.evaluate(
    ({ target, cutoff }) => {
      const c = document.querySelector('.scrollbar-auto-hide') ||
        document.querySelector('.overflow-y-auto');
      if (!c) return;
      const nodes = Array.from(document.querySelectorAll('article *'));
      const hit = nodes.find((n) => (n.textContent || '').toLowerCase().includes(target.toLowerCase()));
      if (hit) {
        const rect = hit.getBoundingClientRect();
        const scRect = c.getBoundingClientRect();
        c.scrollTop += rect.top - scRect.top + cutoff;
      }
    },
    { target: SCROLL_TARGET, cutoff: CUTOFF }
  );
  await page.waitForTimeout(300);

  // Identify the first-visible image — this is our tracked landmark.
  const tracked = await page.evaluate(() => {
    const c = document.querySelector('.scrollbar-auto-hide') ||
      document.querySelector('.overflow-y-auto');
    if (!c) return null;
    const crect = c.getBoundingClientRect();
    for (const img of document.querySelectorAll('article img')) {
      const r = img.getBoundingClientRect();
      if (r.bottom > crect.top && r.top < crect.bottom) {
        return { src: img.src, top: r.top - crect.top, h: r.height };
      }
    }
    return null;
  });
  if (!tracked) {
    console.log('No image visible at scrolled position; nothing to track.');
    await browser.close();
    return;
  }
  console.log(
    `Tracking image: src=${tracked.src.slice(-40)} top=${tracked.top.toFixed(1)} h=${tracked.h.toFixed(1)}`
  );

  const measure = async (label) => {
    const m = await page.evaluate((src) => {
      const c = document.querySelector('.scrollbar-auto-hide') ||
        document.querySelector('.overflow-y-auto');
      if (!c) return null;
      const crect = c.getBoundingClientRect();
      const imgs = Array.from(document.querySelectorAll('img'));
      const hit = imgs.find((i) => i.src === src);
      if (!hit) return { missing: true, scrollTop: c.scrollTop };
      const r = hit.getBoundingClientRect();
      const cs = getComputedStyle(hit);
      // In view, the image is inside .markdown-image-wrapper — measure the
      // wrapper's top too for comparison.
      const wrapper = hit.closest('.markdown-image-wrapper');
      const wrapperTop = wrapper ? wrapper.getBoundingClientRect().top - crect.top : null;
      return {
        imgTop: r.top - crect.top,
        wrapperTop,
        h: r.height,
        mTop: cs.marginTop,
        scrollTop: c.scrollTop,
        modeEdit: !!document.querySelector('.cm-editor'),
      };
    }, tracked.src);
    const mode = m?.modeEdit ? 'edit' : 'view ';
    const topStr = m?.missing ? 'MISSING' : `img=${m?.imgTop?.toFixed(1)} wrap=${m?.wrapperTop == null ? '-' : m.wrapperTop.toFixed(1)} mT=${m?.mTop}`;
    console.log(
      `  ${label.padEnd(32)} [${mode}] scroll=${m?.scrollTop?.toFixed(0).padStart(5)}  ${topStr}`
    );
    return m;
  };

  console.log(`\nRound-trip (cutoff=${CUTOFF}px):`);
  await measure('pre-toggle view');
  await page.screenshot({ path: '/tmp/snap-00-view-pre.png' });

  await page.click('button[title="Edit"]');
  await page.waitForSelector('.cm-editor', { timeout: 5000 });
  await page.waitForTimeout(400);
  await measure('after click-edit');
  await page.screenshot({ path: '/tmp/snap-01-edit.png' });

  await page.click('button[title^="Done"]');
  await page.waitForTimeout(400);
  await measure('after click-done (view)');
  await page.screenshot({ path: '/tmp/snap-02-view-again.png' });

  await page.click('button[title="Edit"]');
  await page.waitForSelector('.cm-editor', { timeout: 5000 });
  await page.waitForTimeout(400);
  await measure('after second click-edit');
  await page.screenshot({ path: '/tmp/snap-03-edit-again.png' });

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
