#!/usr/bin/env node
// Probe what happens when the user modifies the raw markdown of an image
// while it's visible (cursor on image line). Three scenarios:
//   1. Change URL to a different cached image → does image update?
//   2. Break syntax mid-edit → does image disappear / reappear?
//   3. Type inside the alt text → does image stay stable?

import { openAtom, clickEdit, clickDone, setScroll } from './lib.mjs';

async function main() {
  const { browser, page } = await openAtom();

  try {
    await clickEdit(page);
    await page.waitForTimeout(300);

    // Scroll so an image widget is in view.
    await setScroll(page, 800);
    await page.waitForTimeout(300);

    // Click on the first image to activate the line.
    const clickedImg = await page.evaluate(() => {
      const img = document.querySelector('img.cm-md-img');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, src: img.src };
    });
    if (!clickedImg) {
      console.log('no image found');
      await browser.close();
      return;
    }
    await page.mouse.click(clickedImg.x, clickedImg.y);
    await page.waitForTimeout(300);
    console.log(`clicked image, src=${clickedImg.src.slice(-40)}`);

    // Snapshot what's in DOM after click.
    const state1 = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img.cm-md-img'));
      const activeLine = document.querySelector('.cm-line:has(.cm-cursor-primary), .cm-activeLine, .cm-line[aria-current]') ||
        (() => {
          const sel = window.getSelection();
          if (!sel?.anchorNode) return null;
          let el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
          while (el && !el.classList?.contains('cm-line')) el = el.parentElement;
          return el;
        })();
      return {
        imgCount: imgs.length,
        activeLineText: activeLine ? (activeLine.textContent || '').slice(0, 60) : null,
      };
    });
    console.log('after click:', JSON.stringify(state1));

    // Scenario 1: change URL to a known-loaded sibling (w2.jpg if clicked image was w1.jpg, etc.)
    // Select the URL and replace it.
    console.log('\nScenario 1: change URL inside the markdown');
    const originalSrc = clickedImg.src;
    // Find the URL in the current line's text and select it via CM dispatch.
    await page.evaluate(() => {
      const sel = window.getSelection();
      if (!sel?.anchorNode) return;
      let line = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      while (line && !line.classList?.contains('cm-line')) line = line.parentElement;
      if (!line) return;
      // Look for the URL text inside the line and put cursor there
      const text = line.textContent || '';
      const m = /\((https?:\/\/[^)]+)\)/.exec(text);
      if (!m) return;
      // find the text node containing the URL and select it
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.textContent || '';
        const idx = t.indexOf(m[1]);
        if (idx >= 0) {
          const r = document.createRange();
          r.setStart(n, idx);
          r.setEnd(n, idx + m[1].length);
          sel.removeAllRanges();
          sel.addRange(r);
          return;
        }
      }
    });
    await page.keyboard.press('Backspace'); // delete the URL
    await page.waitForTimeout(100);
    const stateBroken = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img.cm-md-img'));
      return { count: imgs.length };
    });
    console.log(`after deleting URL: img count = ${stateBroken.count} (was 1+ before)`);

    // Now type a new URL — use a known-cached one from the same atom
    await page.keyboard.type('https://kdenlive.org/news/2026/state-2026/w2.jpg');
    await page.waitForTimeout(400);
    const stateRetyped = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img.cm-md-img'));
      return { count: imgs.length, srcs: imgs.map((i) => i.src.slice(-20)) };
    });
    console.log(`after typing new URL: ${JSON.stringify(stateRetyped)}`);

    // Scenario 2: break the syntax — remove the closing bracket
    console.log('\nScenario 2: break syntax by removing `)`');
    // Press End then Backspace to remove last char (the `)`)
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);
    const stateBroken2 = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img.cm-md-img'));
      return { count: imgs.length };
    });
    console.log(`after removing closing ): img count = ${stateBroken2.count}`);

    // Fix it again
    await page.keyboard.type(')');
    await page.waitForTimeout(200);
    const stateFixed = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img.cm-md-img'));
      return { count: imgs.length };
    });
    console.log(`after retyping ): img count = ${stateFixed.count}`);

    // Scenario 3: type in alt text — find [...] area, add characters
    console.log('\nScenario 3: type extra characters in alt text');
    await page.evaluate(() => {
      const sel = window.getSelection();
      if (!sel?.anchorNode) return;
      let line = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      while (line && !line.classList?.contains('cm-line')) line = line.parentElement;
      if (!line) return;
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.textContent || '';
        const idx = t.indexOf('](');
        if (idx >= 0) {
          // position cursor at idx (just before `]`)
          const r = document.createRange();
          r.setStart(n, idx);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          return;
        }
      }
    });
    await page.keyboard.type('XXX');
    await page.waitForTimeout(200);
    const stateAltMod = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img.cm-md-img'));
      const altTexts = imgs.map((i) => (i).alt);
      return { count: imgs.length, altTexts };
    });
    console.log(`after alt-text typing: ${JSON.stringify(stateAltMod)}`);

    // Undo all changes
    console.log('\nUndo');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Meta+z');
      await page.waitForTimeout(50);
    }
    await clickDone(page);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
