#!/usr/bin/env node
// Merge-injection guard: finds content written directly into merge commits,
// i.e. lines that exist in the merge but in neither parent. Code review and
// `git log -p` do not show these lines, so they are where payloads were hidden.
//
//   node scripts/guard/merge-injection.mjs --range <base>..<head>   merges in a PR / push
//   node scripts/guard/merge-injection.mjs --all                    every merge in history
//   node scripts/guard/merge-injection.mjs --since "8 days ago"     recent merges on HEAD (scheduled scan)
//
// Fails when merge-only lines are suspicious (obfuscation markers, padding,
// over-long lines) or touch a build config / .gitignore / package manifest.
// Ordinary conflict resolutions elsewhere are printed as warnings for review.
import { git, report, OBFUSCATION_PATTERNS, PADDING_RE, BUILD_CONFIG, loadConfig } from "./lib.mjs";

const args = process.argv.slice(2);
const config = loadConfig();
const rangeArg = args.includes("--range") ? args[args.indexOf("--range") + 1] : null;
const sinceArg = args.includes("--since") ? args[args.indexOf("--since") + 1] : null;
const revArgs = args.includes("--all")
  ? ["--all"]
  : rangeArg
    ? [rangeArg]
    : sinceArg
      ? [`--since=${sinceArg}`, "HEAD"]
      : ["-n", "200", "HEAD"];

const merges = git(["rev-list", "--merges", ...revArgs]).split("\n").filter(Boolean);
const SENSITIVE = (f) => BUILD_CONFIG.test(f) || /(^|\/)(\.gitignore|package\.json|package-lock\.json|\.npmrc)$/.test(f) || /^\.(github|husky|vscode)\//.test(f);

const problems = [];
const warnings = [];

for (const sha of merges) {
  const subject = git(["log", "-1", "--format=%h %an %ad %s", "--date=short", sha]).trim();
  const diff = git(["diff-tree", "--cc", "-l0", "--no-commit-id", sha]);
  let file = null;
  const perFile = new Map();
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --cc ")) { file = line.slice(10); continue; }
    if (!file || !line.startsWith("++") || line.startsWith("+++")) continue;
    const content = line.slice(2);
    const entry = perFile.get(file) ?? { count: 0, flags: new Set() };
    entry.count++;
    for (const { name, re } of OBFUSCATION_PATTERNS) if (re.test(content)) entry.flags.add(name);
    if (PADDING_RE.test(content)) entry.flags.add("whitespace padding followed by code");
    if (content.length > config.maxLineLength) entry.flags.add(`line of ${content.length} characters`);
    perFile.set(file, entry);
  }
  for (const [f, { count, flags }] of perFile) {
    const where = `merge ${subject} → ${f} (${count} merge-only line${count === 1 ? "" : "s"})`;
    if (flags.size) problems.push(`${where}: ${[...flags].join(", ")}`);
    else if (SENSITIVE(f)) problems.push(`${where}: content in neither parent, in a sensitive file`);
    else warnings.push(`${where}: review this conflict resolution`);
  }
}

console.log(`checked ${merges.length} merge commit(s) in ${revArgs.join(" ")}`);
process.exitCode = report("merge injection", problems, warnings);
