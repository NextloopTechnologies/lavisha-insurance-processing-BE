#!/usr/bin/env node
// Camouflage guard: a one-line payload hides easily inside a diff that rewrites
// every file. Fails when a range flips line endings / whitespace on many files,
// and reports added lines that a whitespace-insensitive review would not show.
//
//   node scripts/guard/diff-camouflage.mjs --range <base>..<head> [--allow-eol]
import { git, report, loadConfig } from "./lib.mjs";

const args = process.argv.slice(2);
const config = loadConfig();
const range = args.includes("--range") ? args[args.indexOf("--range") + 1] : null;
const allowEol = args.includes("--allow-eol");
if (!range) {
  console.error("usage: diff-camouflage.mjs --range <base>..<head> [--allow-eol]");
  process.exit(2);
}
const [base, head] = range.split("..");

const problems = [];
const warnings = [];
const changed = git(["diff", "--name-only", "-z", "--diff-filter=M", base, head]).split("\0").filter(Boolean);

const eolOnly = [];
for (const file of changed) {
  const ignoringWhitespace = git(["diff", "--ignore-cr-at-eol", "--ignore-space-at-eol", "--numstat", base, head, "--", file]).trim();
  if (!ignoringWhitespace) eolOnly.push(file);
}
if (eolOnly.length > config.eolOnlyChangeLimit && !allowEol) {
  problems.push(
    `${eolOnly.length} files change only line endings / trailing whitespace (limit ${config.eolOnlyChangeLimit}). ` +
    `A mass rewrite hides real changes; split it into its own reviewed PR and add the "allow-eol-normalization" label. ` +
    `First files: ${eolOnly.slice(0, 5).join(", ")}`,
  );
} else if (eolOnly.length) {
  warnings.push(`${eolOnly.length} file(s) change only line endings / trailing whitespace: ${eolOnly.slice(0, 5).join(", ")}`);
}

// big symmetric rewrites in a single commit (e.g. LF -> CRLF across the repo)
for (const sha of git(["rev-list", "--no-merges", range]).split("\n").filter(Boolean)) {
  const stat = git(["show", "--shortstat", "--format=%h %s", sha]).trim().split("\n");
  const m = stat.at(-1).match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
  if (!m) continue;
  const [filesChanged, ins, del] = [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
  if (filesChanged >= 10 && ins > 1000 && Math.min(ins, del) / Math.max(ins, del) > 0.9) {
    warnings.push(`commit ${stat[0]} rewrites ${filesChanged} files (+${ins}/-${del}); review it with --ignore-cr-at-eol -w`);
  }
}

console.log(`checked ${changed.length} modified file(s) in ${range}`);
process.exitCode = report("diff camouflage", problems, warnings);
