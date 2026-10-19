import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildSync } from "esbuild";

import { dependencyGroups } from "./exodus-release.mjs";

const root = process.cwd();
const release = JSON.parse(readFileSync(".exodus-release/release.json"));
const sources = new Map(
  execFileSync("git", ["ls-files", "packages/**/package.json"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .map((filename) => {
      const manifest = JSON.parse(readFileSync(filename));
      return [
        manifest.name.replace("@ledgerhq/", "@exodus/ledger-"),
        path.dirname(filename),
      ];
    }),
);
const consumer = mkdtempSync(path.join(tmpdir(), "dmk-consumer-"));
const names = new Set(release.packages.map((entry) => entry.name));
try {
  writeFileSync(path.join(consumer, "package.json"), '{"private":true}');
  const require = createRequire(path.join(consumer, "package.json"));
  const importable = [];
  for (const entry of release.packages) {
    const directory = path.join(consumer, "node_modules", entry.name);
    mkdirSync(directory, { recursive: true });
    const tarball = path.join(root, ".exodus-release", entry.filename);
    const files = execFileSync("tar", ["-tf", tarball], { encoding: "utf8" })
      .trim()
      .split("\n");
    assert.ok(
      files.every(
        (file) => !file.includes(".test.") && !file.endsWith(".tsbuildinfo"),
      ),
      "Development files in tarball",
    );
    execFileSync("tar", [
      "-xzf",
      tarball,
      "--strip-components=1",
      "-C",
      directory,
    ]);
    const manifest = JSON.parse(
      readFileSync(path.join(directory, "package.json")),
    );
    assert.equal(manifest.name, entry.name);
    assert.equal(manifest.version, entry.version);
    assert.equal(manifest.scripts, undefined);
    assert.equal(manifest.devDependencies, undefined);
    for (const target of Object.values(manifest.exports["."])) {
      assert.ok(
        existsSync(path.join(directory, target)),
        `Missing export: ${entry.name} ${target}`,
      );
    }
    for (const group of dependencyGroups) {
      for (const [name, version] of Object.entries(manifest[group] ?? {})) {
        assert.ok(
          !version.startsWith("workspace:") && !version.startsWith("catalog:"),
          `Unresolved ${name}`,
        );
        if (names.has(name)) {
          assert.equal(version, entry.version);
          continue;
        }
        assert.ok(
          !name.startsWith("@ledgerhq/") ||
            !sources.has(name.replace("@ledgerhq/", "@exodus/ledger-")),
          `Upstream workspace dependency: ${name}`,
        );
        const source = path.join(
          root,
          sources.get(entry.name),
          "node_modules",
          name,
        );
        const destination = path.join(directory, "node_modules", name);
        if (existsSync(source) && !existsSync(destination)) {
          mkdirSync(path.dirname(destination), { recursive: true });
          symlinkSync(source, destination, "dir");
        }
      }
    }
    if (!entry.name.includes("device-transport-kit-"))
      importable.push(entry.name);
  }
  for (const name of importable) {
    assert.ok(
      Object.keys(require(name)).length,
      `Empty CommonJS export: ${name}`,
    );
  }
  const esmEntry = path.join(consumer, "entry.mjs");
  writeFileSync(
    esmEntry,
    importable
      .map(
        (name, index) =>
          `import * as package${index} from ${JSON.stringify(name)}; console.log(Object.keys(package${index}).length);`,
      )
      .join("\n"),
  );
  const bundle = path.join(consumer, "bundle.cjs");
  buildSync({
    entryPoints: [esmEntry],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  execFileSync(process.execPath, [bundle], { stdio: "inherit" });
  console.log(
    `Validated ${release.packages.length} tarballs and ${importable.length} CommonJS/ESM package entry points.`,
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
