// Self-tests for the guards: each case builds a throwaway git repo, commits a
// fixture and checks the guard's verdict. Run with: node --test scripts/guard/guard.test.mjs
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GUARD_SRC = dirname(fileURLToPath(import.meta.url));
const PAD = " ".repeat(160);
// payload fragments built at runtime so this test file does not trip the guard itself
const LOADER = ["glo", "bal['", "!", "']='9-4053-1';var _$", "_1e42=function(){};"].join("");
const HEX = ["const _", "0x3a2ebe=_", "0x355e;"].join("");

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "guard-test-"));
  const g = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@test");
  g("config", "user.name", "t");
  g("config", "commit.gpgsign", "false");
  cpSync(GUARD_SRC, join(dir, "scripts/guard"), { recursive: true });
  rmSync(join(dir, "scripts/guard/guard.test.mjs"));
  const write = (path, content) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const commit = (msg = "c") => { g("add", "-A"); g("commit", "-q", "-m", msg, "--allow-empty"); return g("rev-parse", "HEAD").trim(); };
  const run = (script, ...args) => {
    const r = spawnSync(process.execPath, [join(dir, "scripts/guard", script), ...args], { cwd: dir, encoding: "utf8" });
    return { code: r.status, out: r.stdout + r.stderr };
  };
  write("package.json", JSON.stringify({ name: "fixture", scripts: { test: "echo" } }, null, 2));
  write("eslint.config.mjs", "export default [];\n");
  write("src/app.js", "export const ok = 1;\n");
  commit("init");
  return { dir, g, write, commit, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("repo-hygiene", () => {
  let repo;
  before(() => { repo = makeRepo(); });
  after(() => repo.cleanup());

  it("passes a clean repo", () => {
    assert.equal(repo.run("repo-hygiene.mjs").code, 0);
  });

  const failing = [
    ["a payload padded past the right edge of a config", "eslint.config.mjs", `export default [];${PAD}${HEX}\n`, /spaces\/tabs followed by more code/],
    ["the global-bang loader marker", "src/a.js", `${LOADER}\n`, /loader marker/],
    ["javascript-obfuscator hex identifiers", "src/b.js", `${HEX}\n`, /hex identifier/],
    ["a .gitignore entry hiding config.bat", ".gitignore", "node_modules\nconfig.bat\n", /ignores an executable/],
    ["a .gitignore entry hiding *.ps1", ".gitignore", "*.ps1\n", /ignores an executable/],
    ["a committed batch file", "tools/run.bat", "@echo off\n", /executable/],
    ["a font file that is really JavaScript", "public/fonts/a.woff2", "(function(){ require('child_process') })()", /looks like code/],
    ["a VS Code task that runs on folder open", ".vscode/tasks.json", '{"tasks":[{"runOptions":{"runOn":"folderOpen"}}]}', /folder open/],
    ["a postinstall script", "package.json", JSON.stringify({ scripts: { postinstall: "node x.js" } }), /postinstall/],
    ["a known-malicious dependency", "package.json", JSON.stringify({ dependencies: { "tailwindcss-style-animate": "^1.1.6" } }), /known-malicious/],
    ["a lockfile resolving outside the registry", "package-lock.json",
      JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/x": { version: "1.0.0", resolved: "https://evil.example/x.tgz", integrity: "sha512-x" } } }),
      /resolves from https:\/\/evil\.example/],
    ["a lockfile entry without integrity", "package-lock.json",
      JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/x": { version: "1.0.0", resolved: "https://registry.npmjs.org/x/-/x-1.0.0.tgz" } } }),
      /no integrity/],
    ["a build config that no longer parses", "postcss.config.mjs", "const config = {\n", /does not parse/],
    ["a line over the length limit", "src/long.js", `export const x = "${"a".repeat(1200)}";\n`, /line is \d+ characters/],
  ];

  for (const [label, path, content, expected] of failing) {
    it(`fails on ${label}`, () => {
      const r = makeRepo();
      try {
        r.write(path, content);
        r.commit();
        const { code, out } = r.run("repo-hygiene.mjs");
        assert.equal(code, 1, out);
        assert.match(out, expected);
      } finally {
        r.cleanup();
      }
    });
  }

  it("catches a staged payload before it is committed (--staged)", () => {
    const r = makeRepo();
    try {
      r.write("eslint.config.mjs", `export default [];${PAD}${HEX}\n`);
      r.g("add", "eslint.config.mjs");
      const { code, out } = r.run("repo-hygiene.mjs", "--staged");
      assert.equal(code, 1, out);
      assert.match(out, /eslint\.config\.mjs:1/);
    } finally {
      r.cleanup();
    }
  });

  it("scans another commit with --rev", () => {
    const r = makeRepo();
    try {
      r.write("src/a.js", `${LOADER}\n`);
      const bad = r.commit("bad");
      r.write("src/a.js", "export const ok = 2;\n");
      r.commit("fix");
      assert.equal(r.run("repo-hygiene.mjs").code, 0);
      assert.equal(r.run("repo-hygiene.mjs", "--rev", bad).code, 1);
    } finally {
      r.cleanup();
    }
  });

  it("allows long lines in allowlisted generated files", () => {
    const r = makeRepo();
    try {
      r.write("dist/app.min.js", `var a="${"b".repeat(5000)}";\n`);
      r.commit();
      assert.equal(r.run("repo-hygiene.mjs").code, 0);
    } finally {
      r.cleanup();
    }
  });
});

describe("merge-injection", () => {
  function repoWithMerge(extra) {
    const r = makeRepo();
    const base = r.g("rev-parse", "HEAD").trim();
    r.g("checkout", "-q", "-b", "feature");
    r.write("src/feature.js", "export const f = 1;\n");
    r.commit("feature");
    r.g("checkout", "-q", "main");
    r.write("src/main.js", "export const m = 1;\n");
    r.commit("main work");
    r.g("merge", "-q", "--no-ff", "--no-commit", "feature");
    if (extra) extra(r);
    r.g("add", "-A");
    r.g("commit", "-q", "-m", "Merge feature");
    return { r, base };
  }

  it("passes a clean merge", () => {
    const { r, base } = repoWithMerge();
    try {
      assert.equal(r.run("merge-injection.mjs", "--range", `${base}..HEAD`).code, 0);
    } finally {
      r.cleanup();
    }
  });

  it("fails when a payload is written into the merge commit itself", () => {
    const { r, base } = repoWithMerge((r) => appendFileSync(join(r.dir, "eslint.config.mjs"), `${PAD}${HEX}\n`));
    try {
      const { code, out } = r.run("merge-injection.mjs", "--range", `${base}..HEAD`);
      assert.equal(code, 1, out);
      assert.match(out, /eslint\.config\.mjs.*merge-only/);
    } finally {
      r.cleanup();
    }
  });

  it("fails on merge-only lines in a sensitive file even without markers", () => {
    const { r, base } = repoWithMerge((r) => appendFileSync(join(r.dir, ".gitignore"), "something\n"));
    try {
      assert.equal(r.run("merge-injection.mjs", "--range", `${base}..HEAD`).code, 1);
    } finally {
      r.cleanup();
    }
  });

  it("only warns for an ordinary edit inside a merge to application code", () => {
    const { r, base } = repoWithMerge((r) => appendFileSync(join(r.dir, "src/app.js"), "export const resolved = 2;\n"));
    try {
      const { code, out } = r.run("merge-injection.mjs", "--range", `${base}..HEAD`);
      assert.equal(code, 0, out);
      assert.match(out, /warning: .*src\/app\.js/);
    } finally {
      r.cleanup();
    }
  });
});

describe("diff-camouflage", () => {
  function repoWithFiles(n) {
    const r = makeRepo();
    for (let i = 0; i < n; i++) r.write(`src/f${i}.js`, Array.from({ length: 50 }, (_, j) => `export const v${j} = ${j};`).join("\n") + "\n");
    const base = r.commit("files");
    return { r, base };
  }

  it("fails when a range flips line endings on many files", () => {
    const { r, base } = repoWithFiles(8);
    try {
      for (let i = 0; i < 8; i++) {
        const p = join(r.dir, `src/f${i}.js`);
        writeFileSync(p, readFileSync(p, "utf8").replace(/\n/g, "\r\n"));
      }
      r.commit("normalize line endings");
      const { code, out } = r.run("diff-camouflage.mjs", "--range", `${base}..HEAD`);
      assert.equal(code, 1, out);
      assert.match(out, /8 files change only line endings/);
      assert.equal(r.run("diff-camouflage.mjs", "--range", `${base}..HEAD`, "--allow-eol").code, 0);
    } finally {
      r.cleanup();
    }
  });

  it("passes a normal change", () => {
    const { r, base } = repoWithFiles(3);
    try {
      appendFileSync(join(r.dir, "src/f0.js"), "export const extra = 1;\n");
      r.commit("normal");
      assert.equal(r.run("diff-camouflage.mjs", "--range", `${base}..HEAD`).code, 0);
    } finally {
      r.cleanup();
    }
  });
});
