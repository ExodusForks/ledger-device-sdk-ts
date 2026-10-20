import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import semver from "semver";

const directory = path.resolve(".exodus-release");
const release = JSON.parse(readFileSync(path.join(directory, "release.json")));
const publish = process.argv.includes("--publish");
const tag = process.env.DIST_TAG ?? "next";
assert.ok(
  ["latest", "next", "alpha", "beta", "rc"].includes(tag),
  "Invalid tag",
);
assert.ok(["public", "restricted"].includes(release.access), "Invalid access");
assert.ok(release.packages?.length, "No packages to publish");
const pending = [];
for (const entry of release.packages) {
  assert.match(entry.name, /^@exodus\/ledger-[a-z0-9-]+$/);
  assert.ok(
    typeof entry.version === "string" &&
      semver.valid(entry.version) === entry.version,
    "Invalid version",
  );
  assert.ok(
    tag !== "latest" || !semver.prerelease(entry.version),
    "Use a prerelease tag",
  );
  assert.equal(
    path.basename(entry.filename),
    entry.filename,
    "Invalid filename",
  );
  const filename = path.join(directory, entry.filename);
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOf", filename, "package/package.json"]),
  );
  assert.equal(manifest.name, entry.name, "Tarball name mismatch");
  assert.equal(manifest.version, entry.version, "Tarball version mismatch");
  if (publish) {
    const existing = spawnSync(
      "npm",
      [
        "view",
        `${entry.name}@${entry.version}`,
        "dist.integrity",
        "--json",
        "--registry=https://registry.npmjs.org",
      ],
      { encoding: "utf8" },
    );
    if (existing.status === 0) {
      const integrity =
        "sha512-" +
        createHash("sha512").update(readFileSync(filename)).digest("base64");
      assert.equal(
        JSON.parse(existing.stdout),
        integrity,
        `Different content already published: ${entry.name}@${entry.version}`,
      );
      console.log(`Already published: ${entry.name}@${entry.version}`);
      continue;
    }
    const error = JSON.parse(existing.stdout || "{}").error;
    assert.equal(error?.code, "E404", existing.stderr);
  }
  pending.push(filename);
}
for (const filename of pending) {
  execFileSync(
    "npm",
    [
      "publish",
      filename,
      "--ignore-scripts",
      "--access",
      release.access,
      "--tag",
      tag,
      "--registry=https://registry.npmjs.org",
      ...(publish ? [] : ["--dry-run"]),
    ],
    { stdio: "inherit" },
  );
}
