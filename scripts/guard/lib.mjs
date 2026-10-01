// Shared helpers for the repository guards. No dependencies; Node >= 18.
// The guards only read files and git objects. They never execute project code.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

export function git(args, opts = {}) {
  return execFileSync("git", args, { cwd: ROOT, encoding: opts.buffer ? "buffer" : "utf8", maxBuffer: 512 * 1024 * 1024 });
}

export function loadConfig() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "guard.config.json");
  const defaults = {
    maxLineLength: 1000,
    maxConfigLineLength: 300,
    longLineAllow: [],
    allowedPrepareScripts: [],
    allowedRegistryHosts: ["registry.npmjs.org"],
    eolOnlyChangeLimit: 5,
  };
  return existsSync(file) ? { ...defaults, ...JSON.parse(readFileSync(file, "utf8")) } : defaults;
}

// glob with * (no slash) and ** (any depth), matched against repo-relative paths
export function globToRegExp(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*\*/g, "\u0001")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?")
    .replace(/\u0001/g, ".*");
  return new RegExp(`^${re}$`);
}
export const matchesAny = (path, globs) => globs.some((g) => globToRegExp(g).test(path));

// --- what we look for --------------------------------------------------------
// Patterns are assembled from fragments so this file does not match itself.
const frag = (...parts) => parts.join("");
export const OBFUSCATION_PATTERNS = [
  { name: "javascript-obfuscator hex identifier", re: new RegExp(frag("\\b_", "0x[0-9a-f]{4,6}\\b"), "i") },
  { name: "loader marker: global bang key", re: new RegExp(frag("global\\s*\\[\\s*['\"]", "!", "['\"]\\s*\\]")) },
  { name: "loader marker: global _V key", re: new RegExp(frag("global\\s*\\[\\s*['\"]", "_V", "['\"]\\s*\\]")) },
  { name: "global.i = loader marker", re: new RegExp(frag("global\\.", "i\\s*=\\s*['\"]")) },
  { name: "_$_xxxx decoder", re: new RegExp(frag("_\\$", "_[0-9a-f]{4}\\b")) },
  { name: "long \\x escape run", re: new RegExp(frag("(?:\\\\", "x[0-9a-fA-F]{2}){20,}")) },
  { name: "long \\u escape run", re: new RegExp(frag("(?:\\\\", "u[0-9a-fA-F]{4}){20,}")) },
  { name: "String.fromCharCode with many codes", re: new RegExp(frag("String\\.from", "CharCode\\((?:\\s*\\d+\\s*,){15,}")) },
  { name: "PolinRider string table", re: new RegExp(frag("rmcej", "%otb%|Cot%3t", "=shtP")) },
  { name: "temp_auto_push propagation script", re: new RegExp(frag("temp_auto", "_push\\.bat"), "i") },
];

// code hidden after a long run of spaces/tabs on the same line
export const PADDING_RE = /[^\s][ \t]{40,}[^\s]/;

export const EXECUTABLE_EXT = /\.(bat|cmd|exe|ps1|scr|vbs|vbe|jar|dll|msi|com|wsf|hta)$/i;
export const KNOWN_BAD_FILENAMES = /(^|\/)(config\.bat|temp_auto_push\.bat)$/i;
export const BINARY_EXT = /\.(woff2?|ttf|otf|eot|png|jpe?g|gif|ico|webp|pdf|mp4|mp3|zip)$/i;
export const CODE_EXT = /\.(m?[jt]sx?|cjs|cts|json|ya?ml|css|scss|html?|sh|prisma|sql|md)$/i;
export const BUILD_CONFIG =
  /(^|\/)((next|postcss|tailwind|eslint|babel|jest|vite|webpack|rollup|prettier|nest-cli|vitest|svelte|astro)\.config|\.eslintrc|\.babelrc|\.prettierrc)\.[a-z]*$/i;
export const MALICIOUS_PACKAGES = ["tailwindcss-style-animate", "tailwind-mainanimation", "tailwind-autoanimation"];

export const isBinaryBuffer = (buf) => buf.subarray(0, 8000).includes(0);

export function report(title, problems, warnings = []) {
  for (const w of warnings) console.log(`warning: ${w.length > 300 ? `${w.slice(0, 300)}…` : w}`);
  if (problems.length) {
    console.error(`\n✖ ${title}: ${problems.length} problem(s)`);
    const clip = (m) => (m.length > 300 ? `${m.slice(0, 300)}…` : m);
    for (const p of problems.slice(0, 200)) console.error(`  - ${clip(p)}`);
    if (problems.length > 200) console.error(`  … and ${problems.length - 200} more`);
    return 1;
  }
  console.log(`✔ ${title}: no problems found`);
  return 0;
}
