#!/usr/bin/env node
import { openAtom, clickEdit, clickDone } from './lib.mjs';

async function main() {
  const { browser, page } = await openAtom();
  try {
    await clickEdit(page);
    await page.waitForTimeout(500);

    const before = await page.evaluate(() => {
      // Pick line index 3 (should be a blank BETWEEN paragraphs inside selection).
      const lines = Array.from(document.querySelectorAll('.cm-line'));
      const b = lines[3];
      return {
        tag: b?.className,
        html: b?.outerHTML ?? null,
        childCount: b?.childNodes.length ?? 0,
        h: b ? Math.round(b.getBoundingClientRect().height) : null,
      };
    });
    console.log('BEFORE selection — line[3]:');
    console.log(JSON.stringify(before, null, 2));

    // drag-select across blocks
    const sel = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll('.cm-line'));
      const a = lines[2].getBoundingClientRect();
      const b = lines[8].getBoundingClientRect();
      return { sx: a.left + 10, sy: a.top + a.height / 2, ex: b.right - 10, ey: b.top + b.height / 2 };
    });
    await page.mouse.move(sel.sx, sel.sy);
    await page.mouse.down();
    await page.mouse.move(sel.ex, sel.ey, { steps: 10 });
    await page.waitForTimeout(200);

    const during = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll('.cm-line'));
      const b = lines[3];
      return {
        tag: b?.className,
        html: b?.outerHTML ?? null,
        childCount: b?.childNodes.length ?? 0,
        h: b ? Math.round(b.getBoundingClientRect().height) : null,
        computedFontSize: b ? parseFloat(getComputedStyle(b).fontSize) : null,
        computedLineHeight: b ? getComputedStyle(b).lineHeight : null,
        children: b ? Array.from(b.childNodes).map((c) => ({
          type: c.nodeType === 1 ? 'el' : c.nodeType === 3 ? 'text' : 'other',
          tag: c.nodeType === 1 ? c.tagName : null,
          text: c.textContent ?? '',
          outer: c.nodeType === 1 ? c.outerHTML : null,
        })) : [],
      };
    });
    console.log('\nDURING selection — line[3]:');
    console.log(JSON.stringify(during, null, 2));

    await page.mouse.up();
    await clickDone(page);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
