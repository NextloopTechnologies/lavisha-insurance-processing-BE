#!/usr/bin/env node
// Repository hygiene guard.
//   node scripts/guard/repo-hygiene.mjs              scan every file in HEAD (CI)
//   node scripts/guard/repo-hygiene.mjs --rev <sha>  scan every file in another commit
//   node scripts/guard/repo-hygiene.mjs --staged     scan what is about to be committed (pre-commit)
//
// Fails on: obfuscation markers, code hidden behind whitespace padding, over-long lines,
// text disguised as fonts/images, tracked or .gitignored executables, auto-run VS Code tasks,
// install-time npm scripts, known malicious packages, non-registry lockfile sources,
// and build configs that no longer parse.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  git, loadConfig, matchesAny, report, OBFUSCATION_PATTERNS, PADDING_RE, EXECUTABLE_EXT, KNOWN_BAD_FILENAMES,
  BINARY_EXT, CODE_EXT, BUILD_CONFIG, MALICIOUS_PACKAGES, isBinaryBuffer,
} from "./lib.mjs";

const argv = process.argv.slice(2);
const staged = argv.includes("--staged");
const rev = argv.includes("--rev") ? argv[argv.indexOf("--rev") + 1] : "HEAD";
const config = loadConfig();
const problems = [];
const warnings = [];

// contents come from git objects (index or commit), never from the working tree
const files = staged
  ? git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]).split("\0").filter(Boolean)
  : git(["ls-tree", "-r", "--name-only", "-z", rev]).split("\0").filter(Boolean);

const read = (path) => {
  try {
    return git(["cat-file", "blob", staged ? `:${path}` : `${rev}:${path}`], { buffer: true });
  } catch {
    return null; // submodule or unreadable entry
  }
};

for (const path of files) {
  const buf = read(path);
  if (!buf) continue;

  if (EXECUTABLE_EXT.test(path) || KNOWN_BAD_FILENAMES.test(path)) {
    problems.push(`${path}: executable / known-bad file is committed`);
  }

  if (BINARY_EXT.test(path)) {
    if (!isBinaryBuffer(buf)) {
      const head = buf.subarray(0, 4000).toString("utf8");
      if (/function|=>|require\(|global|eval\(|module\.exports/.test(head)) {
        problems.push(`${path}: binary file type but contains text that looks like code`);
      }
    }
    continue;
  }
  if (isBinaryBuffer(buf)) continue;

  const text = buf.toString("utf8");
  const lines = text.split("\n");
  const longAllowed = matchesAny(path, config.longLineAllow);
  const isConfig = BUILD_CONFIG.test(path);

  lines.forEach((line, i) => {
    const at = `${path}:${i + 1}`;
    for (const { name, re } of OBFUSCATION_PATTERNS) {
      if (re.test(line)) problems.push(`${at}: ${name}`);
    }
    if (PADDING_RE.test(line)) {
      const m = line.match(/[ \t]{40,}/);
      problems.push(`${at}: ${m[0].length} spaces/tabs followed by more code on the same line (hidden content?)`);
    }
    if (CODE_EXT.test(path) && !longAllowed && line.length > config.maxLineLength) {
      problems.push(`${at}: line is ${line.length} characters (limit ${config.maxLineLength})`);
    }
    if (isConfig && line.length > config.maxConfigLineLength) {
      problems.push(`${at}: build config line is ${line.length} characters (limit ${config.maxConfigLineLength})`);
    }
  });

  // .gitignore must not hide executables that sit in the working tree
  if (/(^|\/)\.gitignore$/.test(path)) {
    for (const [i, raw] of lines.entries()) {
      const entry = raw.trim().replace(/\r$/, "");
      if (!entry || entry.startsWith("#")) continue;
      if (EXECUTABLE_EXT.test(entry) || KNOWN_BAD_FILENAMES.test(entry) || /config\.bat/i.test(entry)) {
        problems.push(`${path}:${i + 1}: ignores an executable ("${entry}") so it never shows in git status`);
      }
    }
  }

  // VS Code tasks that run when the folder is opened
  if (/(^|\/)\.vscode\/tasks\.json$/.test(path) && /"runOn"\s*:\s*"folderOpen"/.test(text)) {
    problems.push(`${path}: task runs automatically on folder open`);
  }
  if (/(^|\/)\.vscode\/settings\.json$/.test(path) && /"task\.allowAutomaticTasks"\s*:\s*"on"/.test(text)) {
    problems.push(`${path}: enables automatic tasks`);
  }

  if (/(^|\/)package\.json$/.test(path)) {
    try {
      const pkg = JSON.parse(text);
      for (const hook of ["preinstall", "install", "postinstall"]) {
        if (pkg.scripts?.[hook]) problems.push(`${path}: "${hook}" script runs on every npm install: ${pkg.scripts[hook]}`);
      }
      if (pkg.scripts?.prepare && !config.allowedPrepareScripts.includes(pkg.scripts.prepare)) {
        problems.push(`${path}: unexpected "prepare" script (runs on install): ${pkg.scripts.prepare}`);
      }
      const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
      for (const bad of MALICIOUS_PACKAGES) if (deps[bad]) problems.push(`${path}: depends on known-malicious package ${bad}`);
    } catch (e) {
      problems.push(`${path}: not valid JSON (${e.message})`);
    }
  }

  if (/(^|\/)package-lock\.json$/.test(path)) {
    try {
      const lock = JSON.parse(text);
      for (const [name, meta] of Object.entries(lock.packages ?? {})) {
        if (!name) continue;
        const pkgName = name.replace(/^.*node_modules\//, "");
        if (MALICIOUS_PACKAGES.includes(pkgName)) problems.push(`${path}: contains known-malicious package ${pkgName}`);
        if (meta.link) continue;
        if (meta.resolved) {
          let host = "";
          try { host = new URL(meta.resolved).host; } catch { /* git+ssh etc. */ }
          if (!config.allowedRegistryHosts.includes(host)) problems.push(`${path}: ${pkgName} resolves from ${meta.resolved}`);
          if (!meta.integrity) problems.push(`${path}: ${pkgName} has no integrity hash`);
        }
      }
    } catch (e) {
      problems.push(`${path}: not valid JSON (${e.message})`);
    }
  }
}

// build configs must still parse (node --check parses without running)
const configs = files.filter((f) => BUILD_CONFIG.test(f) && /\.(m?js|cjs)$/.test(f));
if (configs.length) {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  try {
    for (const path of configs) {
      const buf = read(path);
      if (!buf) continue;
      const copy = join(dir, path.replace(/\//g, "__"));
      writeFileSync(copy, buf);
      try {
        execFileSync(process.execPath, ["--check", copy], { stdio: "pipe" });
      } catch (e) {
        const reason = String(e.stderr).split("\n").find((l) => /^\w*Error:/.test(l.trim())) ?? "syntax error";
        problems.push(`${path}: does not parse (${reason.trim().slice(0, 120)})`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (!files.length) warnings.push("no files to scan");
process.exitCode = report(staged ? "repo hygiene (staged changes)" : `repo hygiene (${rev})`, problems, warnings);
