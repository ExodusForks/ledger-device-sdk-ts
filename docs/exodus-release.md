# Exodus CI and npm publishing

## Checks

`Exodus Checks` runs on pull requests, pushes to `develop`, merge queues, and
manual dispatches. GitHub-hosted runners install the frozen lockfile with
dependency lifecycle scripts disabled. Installation uses the read-only repository
secret `NPM_READ_TOKEN` for private dependencies. No npm or GitHub write token is
needed. The token is exposed only during installation, not builds, tests, or
publication. Fork pull requests cannot access this secret and cannot install
private dependencies; review their changes before running them on a trusted
branch in this repository.

Checks cover release-tool tests, library builds, formatting, lint, TypeScript,
unit tests, and the actual release tarballs. The package checks load CommonJS
exports and bundle ESM exports using the locked dependencies; they do not
exercise native transports or replace real-device smoke tests.

Ledger's existing workflows remain in the repository, but their jobs are
restricted to `LedgerHQ/device-sdk-ts`. They do not run Ledger deployments,
scheduled jobs, or private runners in this fork.

## Packages and versions

`exodus-release.json` selects the release version, npm access, and root packages.
It currently includes DMK, the Bitcoin/Ethereum/Solana/Tron/XRP signers, and the
Node HID, React Native BLE/HID, and browser BLE/HID transports. Their workspace
runtime and peer dependencies are included automatically: 14 packages total.

Packages publish as `@exodus/ledger-*`, for example
`@exodus/ledger-device-management-kit`. All packages in a release share the
version in this configuration; their internal dependency versions are exact.

The release script builds an isolated temporary checkout with renamed workspace
packages, imports, and types. The source checkout, lockfile, audited Exodus
dependencies, and upstream version numbers are not modified. Source maps are
generated from that renamed checkout, not rewritten after compilation.

Tarballs contain built libraries, metadata, and licenses, but no lifecycle
scripts, development dependencies, compiled test files, or build caches.
They are written to the disposable `.exodus-release/` directory, which is
replaced on each release build.

The source lockfile overrides and declaration patch do not propagate to npm
consumers. See [dependency requirements](exodus-dependencies.md) when integrating
these packages into an application.

## One-time administrator setup

1. Enable GitHub Actions in `ExodusForks/ledger-device-sdk-ts` if workflows are
   disabled for the fork.
   Under **Settings > Secrets and variables > Actions**, add the repository secret
   `NPM_READ_TOKEN`: a granular npm token with read-only access to private
   dependencies, including `@exodus/solana-buffer-layout`.
2. Create the GitHub environment `Publish`. Allow deployments only from
   `develop`, and require approval from the release maintainers.
3. Require the new `SDK checks` status in the `develop` branch ruleset. Do not
   rely on the skipped upstream Ledger check names.
4. Bootstrap each new npm package from a maintainer's machine as described below.
   npm trusted publishing must be configured on an existing package.
5. For each package, add a GitHub Actions trusted publisher in npm:
   - Organization: `ExodusForks`
   - Repository: `ledger-device-sdk-ts`
   - Workflow filename: `exodus-publish.yml`
   - Environment: `Publish`
6. Keep package access consistent with `exodus-release.json` (`public` initially).
   Require 2FA for interactive publishing and disallow publishing tokens once
   trusted publishing is configured.

No long-lived npm publishing token is stored in GitHub. The publish job uses
GitHub OIDC with the npm CLI shipped with Node 24 (npm 11.5.1 or newer).

## Bootstrap from a maintainer's machine

Use Node 24 and the pnpm version pinned in `package.json`, from reviewed
`develop`:

```sh
npm login --scope=@exodus
pnpm install --frozen-lockfile --ignore-scripts
node scripts/exodus-release.mjs
node scripts/check-exodus-packages.mjs
node scripts/publish-exodus.mjs
DIST_TAG=next node scripts/publish-exodus.mjs --publish
```

The first publication requires npm permission to create packages in `@exodus`.
The preview command never publishes. Package lifecycle scripts are disabled
even during actual publication. Save the generated tarballs if a partial
publication needs retrying: identical published versions are skipped, while
different content at an existing version is rejected before any upload.

## Subsequent releases

1. Update the version in `exodus-release.json` in a reviewed PR. Use a prerelease
   version when appropriate; prereleases cannot use the `latest` tag.
2. Merge into `develop`.
3. Run **Exodus Publish** on `develop` with **dry-run** enabled (the default).
   Inspect the checks and the `exodus-npm-packages` artifact.
4. Run it again with **dry-run** disabled and the intended dist-tag (`next` by
   default). Approve the `Publish` environment deployment.

The publication job downloads the exact tarballs built and checked in the same
workflow run; it does not rebuild them. Real publishing is limited to `develop`
in the Exodus fork. There is no automatic publication on push, and this workflow
does not create Git tags or GitHub releases.
