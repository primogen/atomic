#!/usr/bin/env node
// Reproduce the "click on paragraph, cursor goes to header" issue.
// Opens the atom in edit mode, picks a paragraph just below a heading,
// clicks on specific pixel rows within that paragraph, and reports which
// line CM's selection landed on.

import { chromium } from 'playwright';

const APP = process.env.ATOMIC_URL || 'http://localhost:1420';
const ATOM_ID = process.env.ATOM_ID || '71545095-8070-41c3-9e62-81b22fe11c3b';

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

  // Click edit
  await page.click('button[title="Edit"]');
  await page.waitForSelector('.cm-editor', { timeout: 5000 });
  await page.waitForTimeout(500);

  // Find a paragraph that follows a heading (possibly across a blank line).
  const targets = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('.cm-line'));
    const hits = [];
    console.log('lines:', lines.length);
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i];
      const text = cur.textContent || '';
      // Must be a non-empty non-heading line with wrapped content.
      if (text.length < 40) continue;
      if (/cm-md-h[1-6]/.test(cur.className)) continue;
      // Walk backwards past blank lines to find the preceding non-blank.
      let j = i - 1;
      while (j >= 0 && (lines[j].textContent || '').length === 0) j--;
      if (j < 0) continue;
      const prev = lines[j];
      const prevIsHeader = /cm-md-h[1-6]/.test(prev.className);
      if (prevIsHeader) {
        const r = cur.getBoundingClientRect();
        const text = (cur.textContent || '').slice(0, 40);
        hits.push({
          text,
          top: r.top,
          bottom: r.bottom,
          height: r.height,
          left: r.left,
          right: r.right,
          prevText: (prev.textContent || '').slice(0, 40),
          prevBottom: prev.getBoundingClientRect().bottom,
        });
        if (hits.length >= 3) break;
      }
    }
    return hits;
  });

  if (targets.length === 0) {
    console.log('No paragraph-below-heading found in viewport');
    await browser.close();
    return;
  }

  // Click at several Y positions across the first paragraph and report
  // where CM resolved the click.
  for (const t of targets) {
    console.log(`\nTarget: header="${t.prevText}" → paragraph="${t.text}"`);
    console.log(`  header-bottom=${t.prevBottom.toFixed(1)} paragraph=${t.top.toFixed(1)}..${t.bottom.toFixed(1)}`);
    const x = t.left + 80; // well inside the paragraph text
    const pointsOfInterest = [
      ['paragraph-top+2', t.top + 2],
      ['paragraph-middle', (t.top + t.bottom) / 2],
      ['paragraph-bottom-2', t.bottom - 2],
      ['gap-between', (t.prevBottom + t.top) / 2],
    ];
    // Dump line heights/positions around the target
    const dump = await page.evaluate((tText) => {
      const lines = Array.from(document.querySelectorAll('.cm-line'));
      const idx = lines.findIndex((l) => (l.textContent || '').startsWith(tText.slice(0, 20)));
      if (idx < 0) return [];
      const window = lines.slice(Math.max(0, idx - 1), idx + 15);
      return window.map((l) => {
        const r = l.getBoundingClientRect();
        return {
          cls: l.className,
          text: (l.textContent || '').slice(0, 30),
          top: r.top.toFixed(1),
          bottom: r.bottom.toFixed(1),
          h: r.height.toFixed(1),
        };
      });
    }, t.text);
    console.log('  lines near target:');
    dump.forEach((d) => console.log(`    [${d.top}..${d.bottom}] h=${d.h} "${d.text}" cls=${d.cls}`));

    for (const [label, y] of pointsOfInterest) {
      const beforePara = await page.evaluate(({ snippet, x, y }) => {
        const lines = Array.from(document.querySelectorAll('.cm-line'));
        const line = lines.find((l) => (l.textContent || '').startsWith(snippet.slice(0, 20)));
        const el = document.elementFromPoint(x, y);
        let cmLine = el;
        while (cmLine && !cmLine.classList?.contains('cm-line')) cmLine = cmLine.parentElement;
        return {
          top: line ? line.getBoundingClientRect().top : null,
          elAtPoint: el?.tagName,
          elCls: el?.className,
          elText: (el?.textContent || '').slice(0, 30),
          cmLineText: (cmLine?.textContent || '').slice(0, 30),
        };
      }, { snippet: t.text, x, y });
      await page.mouse.click(x, y);
      await page.waitForTimeout(50);
      const afterPara = await page.evaluate((snippet) => {
        const lines = Array.from(document.querySelectorAll('.cm-line'));
        const line = lines.find((l) => (l.textContent || '').startsWith(snippet.slice(0, 20)));
        return line ? { top: line.getBoundingClientRect().top } : null;
      }, t.text);
      const resolved = await page.evaluate(() => {
        const sel = window.getSelection();
        if (!sel || !sel.anchorNode) return { info: 'no-selection' };
        let el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
        while (el && !el.classList?.contains('cm-line')) el = el.parentElement;
        if (!el) return { info: 'no-cm-line' };
        return {
          cls: el.className,
          text: (el.textContent || '').slice(0, 40),
          top: el.getBoundingClientRect().top,
          selText: sel.toString().slice(0, 40),
        };
      });
      console.log(
        `  click(${x.toFixed(0)}, ${y.toFixed(1)}) [${label.padEnd(18)}] → ` +
          `top=${resolved.top?.toFixed(1) ?? resolved.info ?? 'n/a'} ` +
          `cls="${resolved.cls ?? ''}" ` +
          `text="${resolved.text ?? ''}" ` +
          (resolved.selText ? `selected="${resolved.selText}" ` : '') +
          `| at-point: <${beforePara?.elAtPoint}>.${beforePara?.elCls?.slice(0,30)} "${beforePara?.elText}" cmLine="${beforePara?.cmLineText}"`
      );
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
