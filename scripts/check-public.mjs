#!/usr/bin/env node
// Public-boundary check: fails if a ref (default HEAD) contains private lab files, or if any file
// or commit in its history matches a pattern from the local, never-pushed denylist
// `.git/info/public-denylist` (one case-insensitive regex per line, `#` comments allowed).
//
//   node scripts/check-public.mjs [--ref <ref>]
//
// Wired as a pre-push hook for the `public` remote: `git config core.hooksPath .githooks`.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const refIndex = process.argv.indexOf('--ref');
const ref = refIndex > 0 ? process.argv[refIndex + 1] : 'HEAD';

/** Paths that only exist on the private branch. */
const PRIVATE_PATHS = [/^src\/lab\//, /^public\/[^/]+\/lab\//, /^tasks\//, /^plan\.md$/, /^cyberdelic-webxr-starter-prd\.md$/];

const problems = [];
const tree = git('ls-tree', '-r', '--name-only', ref).split('\n').filter(Boolean);
for (const path of tree) if (PRIVATE_PATHS.some((pattern) => pattern.test(path))) problems.push(`private path in ${ref}: ${path}`);
const everTracked = new Set(git('log', ref, '--name-only', '--format=').split('\n').filter(Boolean));
for (const path of everTracked) if (PRIVATE_PATHS.some((pattern) => pattern.test(path))) problems.push(`private path in history: ${path}`);

const denylistFile = `${git('rev-parse', '--git-common-dir').trim()}/info/public-denylist`;
const denylist = existsSync(denylistFile)
  ? readFileSync(denylistFile, 'utf8').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  : [];
if (!denylist.length) console.warn(`[check-public] no denylist at ${denylistFile}: only private paths were checked`);
for (const pattern of denylist) {
  let files = '';
  try { files = git('grep', '-I', '-i', '-l', '-E', pattern, ref, '--'); } catch { /* no match */ }
  for (const file of files.split('\n').filter(Boolean)) problems.push(`"${pattern}" in ${file}`);
  const commits = git('log', ref, '-i', '-E', `-G${pattern}`, '--format=%h %s').split('\n').filter(Boolean);
  for (const commit of commits) problems.push(`"${pattern}" in history: ${commit}`);
  const messages = git('log', ref, '-i', '-E', `--grep=${pattern}`, '--format=%h %s').split('\n').filter(Boolean);
  for (const commit of messages) problems.push(`"${pattern}" in commit message: ${commit}`);
}

if (problems.length) {
  console.error(`[check-public] ${ref} is not safe to publish:\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(`[check-public] ${ref}: OK (${tree.length} files, ${denylist.length} denylist patterns)`);
