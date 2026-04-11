// scripts/generate-changelog.js
//
// Generates a concise, human-friendly CHANGELOG entry for a release using the
// Claude Agent SDK. The SDK inherits Atomic's CLAUDE.md and project settings
// via `settingSources: ['project']`, so the summary follows the same context
// Claude Code sees locally.
//
// Auth: the SDK uses $ANTHROPIC_API_KEY if set, otherwise falls back to the
// credentials stored by the Claude Code CLI. If you're logged into Claude Code,
// no extra setup is required.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

function execCapture(cmd) {
  return execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
}

/**
 * Most recent tag reachable from HEAD, or null if the repo has no tags yet.
 */
export function getPreviousTag() {
  try {
    return execCapture('git describe --tags --abbrev=0');
  } catch {
    return null;
  }
}

function collectCommitHistory(previousTag) {
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
  // %h short hash, %s subject, %b body — separated by a unique marker so the
  // model can tell commits apart even when bodies contain blank lines.
  const log = execCapture(
    `git log ${range} --no-merges --pretty=format:"--- %h %s%n%b"`
  );
  let stat = '';
  try {
    stat = execCapture(`git diff --stat ${range}`);
  } catch {
    // diff against a non-existent range on the first release is fine
  }
  return { range, log, stat };
}

/**
 * Generate the markdown body (bullets only — no heading) for a release entry.
 *
 * @param {string | null} previousTag
 * @param {string} newVersion
 * @returns {Promise<string>}
 */
export async function generateChangelogBody(previousTag, newVersion) {
  const { log, stat } = collectCommitHistory(previousTag);
  if (!log) {
    throw new Error(
      `No commits found since ${previousTag ?? 'the beginning of history'}. Nothing to release.`
    );
  }

  // Dynamic import so the SDK only loads when actually cutting a release.
  const { query } = await import('@anthropic-ai/claude-agent-sdk');

  const prompt = `You are writing the CHANGELOG entry for Atomic v${newVersion}.

Atomic is a personal knowledge base desktop app (Tauri + React + Rust + SQLite)
with a headless server and an iOS client. Readers of this changelog are users
of the app, not contributors — focus on what they will notice.

Below is every commit since the previous release${previousTag ? ` (${previousTag})` : ''}.
Each commit starts with a line that begins with "--- <hash> <subject>" followed
by its body.

=== GIT LOG ===
${log}

=== FILE DIFF SUMMARY ===
${stat || '(no diff stat available)'}

Write 3 to 6 markdown bullet points summarising this release. Rules:
- Output bullets only. No heading, no preamble, no trailing commentary, no code fences.
- Each bullet is one line, present tense, user-facing ("Add…", "Fix…", "Improve…").
- Group related commits into a single bullet where it makes sense.
- Omit purely internal refactors, dependency bumps, and CI changes unless they
  have a visible effect.
- Do not invent features that aren't in the git log.
- Do not use any tools — everything you need is in this prompt.`;

  let resultText = '';
  let errorSubtype = null;

  for await (const message of query({
    prompt,
    options: {
      cwd: PROJECT_ROOT,
      settingSources: ['project'],
      // Disable all built-in tools so the run is deterministic and never blocks
      // on a permission prompt. The model has everything it needs in the prompt.
      tools: [],
      allowedTools: [],
    },
  })) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        resultText = message.result.trim();
      } else {
        errorSubtype = message.subtype;
      }
    }
  }

  if (errorSubtype) {
    throw new Error(`Claude Agent SDK returned error subtype: ${errorSubtype}`);
  }
  if (!resultText) {
    throw new Error('Claude Agent SDK returned no result message.');
  }

  return resultText;
}

/**
 * Prepend a new release entry to CHANGELOG.md, creating the file if needed.
 * Returns the absolute path of the file that was written.
 *
 * @param {string} newVersion
 * @param {string} body - markdown bullets (no heading)
 */
export function prependChangelog(newVersion, body) {
  const changelogPath = path.join(PROJECT_ROOT, 'CHANGELOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const entry = `## v${newVersion} — ${date}\n\n${body.trim()}\n`;

  let existing = '';
  if (fs.existsSync(changelogPath)) {
    existing = fs.readFileSync(changelogPath, 'utf8');
  }

  let newContent;
  if (!existing.trim()) {
    newContent = `# Changelog\n\nAll notable changes to Atomic are documented here.\n\n${entry}`;
  } else {
    // Insert the new entry before the first existing `## ` section. If there
    // are no sections yet (only a top-level header), append after the preamble.
    const firstSectionIdx = existing.search(/^## /m);
    if (firstSectionIdx === -1) {
      newContent = `${existing.trimEnd()}\n\n${entry}`;
    } else {
      newContent = `${existing.slice(0, firstSectionIdx)}${entry}\n${existing.slice(firstSectionIdx)}`;
    }
  }

  fs.writeFileSync(changelogPath, newContent);
  return changelogPath;
}
