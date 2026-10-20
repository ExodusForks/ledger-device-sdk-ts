import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import semver from "semver";

export const dependencyGroups = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
];

export function releasePackages(packages, config) {
  assert.ok(
    typeof config.version === "string" &&
      semver.valid(config.version) === config.version,
    "Invalid version",
  );
  assert.ok(["public", "restricted"].includes(config.access), "Invalid access");
  assert.ok(
    Array.isArray(config.packages) && config.packages.length,
    "Select at least one package",
  );
  const selected = new Set();
  const ordered = [];
  const visit = (name) => {
    if (selected.has(name)) return;
    const entry = packages.get(name);
    assert.ok(entry && !entry.manifest.private, `Not publishable: ${name}`);
    selected.add(name);
    for (const group of dependencyGroups) {
      for (const [dependency, version] of Object.entries(
        entry.manifest[group] ?? {},
      )) {
        if (packages.has(dependency)) visit(dependency);
        else
          assert.ok(!version.startsWith("workspace:"), `Missing ${dependency}`);
      }
    }
    ordered.push(name);
  };
  config.packages.forEach(visit);
  return ordered;
}

export function renamePackages(text, names) {
  return text.replace(
    /@ledgerhq\/[a-z0-9._-]+/g,
    (name) => names.get(name) ?? name,
  );
}

export function publishManifest(manifest) {
  const result = { ...manifest };
  delete result.devDependencies;
  delete result.scripts;
  return result;
}

const readJson = (filename) => JSON.parse(readFileSync(filename, "utf8"));
const writeJson = (filename, value) =>
  writeFileSync(filename, JSON.stringify(value, null, 2) + "\n");

export function prepareRelease(root) {
  const config = readJson(path.join(root, "exodus-release.json"));
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  const packages = new Map(
    files
      .filter((file) => /^packages\/.+\/package\.json$/.test(file))
      .map((file) => {
        const manifest = readJson(path.join(root, file));
        return [manifest.name, { file, manifest }];
      }),
  );
  const selected = releasePackages(packages, config);
  const names = new Map(
    [...packages]
      .filter(([, entry]) => !entry.manifest.private)
      .map(([name]) => {
        assert.ok(name.startsWith("@ledgerhq/"), `Unexpected name: ${name}`);
        return [name, name.replace("@ledgerhq/", "@exodus/ledger-")];
      }),
  );
  const staging = mkdtempSync(path.join(tmpdir(), "exodus-dmk-release-"));
  const output = path.join(root, ".exodus-release");
  const run = (command, args, cwd = staging, options = {}) =>
    execFileSync(command, args, { cwd, stdio: "inherit", ...options });

  try {
    for (const file of files) {
      const source = path.join(root, file);
      const destination = path.join(staging, file);
      mkdirSync(path.dirname(destination), { recursive: true });
      const stat = lstatSync(source);
      if (stat.isSymbolicLink()) {
        const target = readlinkSync(source);
        assert.ok(!path.isAbsolute(target), `Absolute symlink: ${file}`);
        assert.ok(
          path
            .resolve(path.dirname(destination), target)
            .startsWith(staging + path.sep),
          `External symlink: ${file}`,
        );
        symlinkSync(target, destination);
        continue;
      }
      if (/\.(?:[cm]?[jt]sx?|json|ya?ml|mdx?)$/i.test(file)) {
        writeFileSync(
          destination,
          renamePackages(readFileSync(path.join(root, file), "utf8"), names),
        );
      } else {
        copyFileSync(path.join(root, file), destination);
      }
      chmodSync(destination, stat.mode);
    }
    for (const name of selected) {
      const { file } = packages.get(name);
      const filename = path.join(staging, file);
      const manifest = readJson(filename);
      manifest.version = config.version;
      manifest.repository = {
        type: "git",
        url: "git+https://github.com/ExodusForks/ledger-device-sdk-ts.git",
        directory: path.dirname(file),
      };
      manifest.publishConfig = {
        access: config.access,
        registry: "https://registry.npmjs.org",
      };
      writeJson(filename, manifest);
    }
    run("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"]);
    const filters = selected.flatMap((name) => [
      "--filter",
      `${names.get(name)}...`,
    ]);
    run("pnpm", [
      "exec",
      "turbo",
      "run",
      "build",
      "--concurrency=2",
      ...filters,
    ]);
    rmSync(output, { recursive: true, force: true });
    mkdirSync(output);
    const artifacts = [];
    for (const name of selected) {
      const directory = path.join(
        staging,
        path.dirname(packages.get(name).file),
      );
      const manifest = publishManifest(
        readJson(path.join(directory, "package.json")),
      );
      for (const group of dependencyGroups) {
        for (const dependency of Object.keys(manifest[group] ?? {})) {
          if ([...names.values()].includes(dependency)) {
            manifest[group][dependency] = "workspace:*";
          }
        }
      }
      writeJson(path.join(directory, "package.json"), manifest);
      for (const file of readdirSync(path.join(directory, "lib"), {
        recursive: true,
      })) {
        if (file.includes(".test.") || file.endsWith(".tsbuildinfo")) {
          rmSync(path.join(directory, "lib", file));
        }
      }
      for (const [format, type] of [
        ["esm", "module"],
        ["cjs", "commonjs"],
      ]) {
        const filename = path.join(directory, "lib", format, "package.json");
        if (existsSync(filename)) writeJson(filename, { type });
      }
      copyFileSync(
        path.join(root, "LICENSE.MD"),
        path.join(directory, "LICENSE.MD"),
      );
      const filename = `${manifest.name.replace("@", "").replace("/", "-")}-${config.version}.tgz`;
      run("pnpm", ["pack", "--out", path.join(output, filename)], directory, {
        env: { ...process.env, npm_config_ignore_scripts: "true" },
      });
      artifacts.push({
        name: manifest.name,
        version: config.version,
        filename,
      });
    }
    writeJson(path.join(output, "release.json"), {
      access: config.access,
      packages: artifacts,
    });
    return artifacts;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  prepareRelease(process.cwd());
}
