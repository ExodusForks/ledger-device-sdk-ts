import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  publishManifest,
  releasePackages,
  renamePackages,
} from "./exodus-release.mjs";

const config = {
  version: "0.1.0",
  access: "public",
  packages: ["@ledgerhq/signer"],
};
const packages = new Map([
  [
    "@ledgerhq/signer",
    {
      manifest: {
        dependencies: { "@ledgerhq/utils": "workspace:^", external: "1.0.0" },
        peerDependencies: { "@ledgerhq/dmk": "workspace:^" },
        devDependencies: { "@ledgerhq/devtools": "workspace:^" },
      },
    },
  ],
  [
    "@ledgerhq/utils",
    { manifest: { peerDependencies: { "@ledgerhq/dmk": "workspace:^" } } },
  ],
  ["@ledgerhq/dmk", { manifest: {} }],
  ["@ledgerhq/devtools", { manifest: { private: true } }],
]);

test("includes runtime and peer dependencies, but not development tools", () => {
  assert.deepEqual(releasePackages(packages, config), [
    "@ledgerhq/dmk",
    "@ledgerhq/utils",
    "@ledgerhq/signer",
  ]);
});

test("rejects missing and private release targets", () => {
  for (const name of ["@ledgerhq/missing", "@ledgerhq/devtools"]) {
    assert.throws(
      () => releasePackages(packages, { ...config, packages: [name] }),
      /Not publishable/,
    );
  }
});

test("rejects unknown workspace dependencies", () => {
  const broken = new Map(packages);
  broken.set("@ledgerhq/signer", {
    manifest: { dependencies: { missing: "workspace:*" } },
  });
  assert.throws(() => releasePackages(broken, config), /Missing missing/);
});

test("validates release version, scope and access", () => {
  assert.throws(
    () => releasePackages(packages, { ...config, version: null }),
    /Invalid version/,
  );
  assert.throws(
    () => releasePackages(packages, { ...config, version: "../bad" }),
    /Invalid version/,
  );
  assert.throws(
    () => releasePackages(packages, { ...config, access: "invalid" }),
    /Invalid access/,
  );
  assert.throws(
    () => releasePackages(packages, { ...config, packages: [] }),
    /Select at least/,
  );
});

test("renames exact workspace names and subpaths without touching external packages", () => {
  const names = new Map([["@ledgerhq/dmk", "@exodus/ledger-dmk"]]);
  assert.equal(
    renamePackages(
      '"@ledgerhq/dmk" "@ledgerhq/dmk/api" "@ledgerhq/dmk-ui" "@exodus/crypto"',
      names,
    ),
    '"@exodus/ledger-dmk" "@exodus/ledger-dmk/api" "@ledgerhq/dmk-ui" "@exodus/crypto"',
  );
});

test("omits development dependencies and lifecycle scripts without mutating the source", () => {
  const manifest = {
    name: "sdk",
    scripts: { postinstall: "bad" },
    devDependencies: { tool: "*" },
    dependencies: { library: "1.0.0" },
  };
  assert.deepEqual(publishManifest(manifest), {
    name: "sdk",
    dependencies: { library: "1.0.0" },
  });
  assert.ok(manifest.scripts);
});

test("publication defaults to dry-run and never executes lifecycle scripts", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmk-publish-test-"));
  try {
    const directory = path.join(root, ".exodus-release");
    const packageDirectory = path.join(root, "package");
    mkdirSync(directory);
    mkdirSync(packageDirectory);
    const sentinel = path.join(root, "script-ran");
    const manifest = {
      name: "@exodus/ledger-test",
      version: "0.1.0",
      scripts: {
        prepublishOnly: `touch ${sentinel}`,
        publish: `touch ${sentinel}`,
        postpublish: `touch ${sentinel}`,
      },
    };
    writeFileSync(
      path.join(packageDirectory, "package.json"),
      JSON.stringify(manifest),
    );
    execFileSync("tar", [
      "-czf",
      path.join(directory, "test.tgz"),
      "-C",
      root,
      "package",
    ]);
    writeFileSync(
      path.join(directory, "release.json"),
      JSON.stringify({
        access: "public",
        packages: [
          {
            name: manifest.name,
            version: manifest.version,
            filename: "test.tgz",
          },
        ],
      }),
    );
    const script = fileURLToPath(
      new URL("./publish-exodus.mjs", import.meta.url),
    );
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        DIST_TAG: "next",
        npm_config_userconfig: "/dev/null",
        npm_config_cache: path.join(root, "cache"),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /dry.run/i);
    assert.equal(existsSync(sentinel), false);
    const invalid = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DIST_TAG: "../bad" },
    });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Invalid tag/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
