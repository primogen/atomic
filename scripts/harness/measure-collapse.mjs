#!/usr/bin/env node
// Directly measure whether margins between adjacent cm-lines collapse
// (like normal CSS) or sum (broken by some CM internal styling).

import { openAtom } from './lib.mjs';

async function main() {
  const { browser, page } = await openAtom();
  try {
    await page.click('button[title="Edit"]');
    await page.waitForSelector('.cm-editor');
    await page.waitForTimeout(1500);

    const data = await page.evaluate(() => {
      // Find consecutive p-end → blank → p-start triples.
      const lines = Array.from(document.querySelectorAll('.cm-line'));
      const samples = [];
      for (let i = 0; i < lines.length - 2; i++) {
        const a = lines[i], b = lines[i + 1], c = lines[i + 2];
        if (!a.classList.contains('cm-md-p-end')) continue;
        if (!b.classList.contains('cm-md-blank')) continue;
        if (!c.classList.contains('cm-md-p-start')) continue;
        const aR = a.getBoundingClientRect();
        const bR = b.getBoundingClientRect();
        const cR = c.getBoundingClientRect();
        const aStyle = getComputedStyle(a);
        const bStyle = getComputedStyle(b);
        const cStyle = getComputedStyle(c);
        samples.push({
          aBottom: Math.round(aR.bottom),
          aMarginBottom: parseFloat(aStyle.marginBottom),
          blankTop: Math.round(bR.top),
          blankBottom: Math.round(bR.bottom),
          blankHeight: Math.round(bR.height),
          blankMarginTop: parseFloat(bStyle.marginTop),
          blankMarginBottom: parseFloat(bStyle.marginBottom),
          cTop: Math.round(cR.top),
          cMarginTop: parseFloat(cStyle.marginTop),
          gapA2B: Math.round(bR.top - aR.bottom),
          gapB2C: Math.round(cR.top - bR.bottom),
          gapA2C: Math.round(cR.top - aR.bottom),
        });
        if (samples.length >= 5) break;
      }
      return samples;
    });

    console.log('P-end → blank → P-start gaps (in edit mode):');
    data.forEach((s, i) => {
      console.log(`  [${i}] a.bot=${s.aBottom} b.top=${s.blankTop} b.bot=${s.blankBottom} c.top=${s.cTop}`);
      console.log(`      margins: a.mb=${s.aMarginBottom} b.mt=${s.blankMarginTop} b.mb=${s.blankMarginBottom} c.mt=${s.cMarginTop}`);
      console.log(`      gaps:    a→b=${s.gapA2B}  b→c=${s.gapB2C}  a→c=${s.gapA2C}`);
      console.log(`      collapse analysis: if max-collapse expected=${Math.max(s.aMarginBottom, s.cMarginTop)}, if sum=${s.aMarginBottom + s.cMarginTop}`);
    });
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
