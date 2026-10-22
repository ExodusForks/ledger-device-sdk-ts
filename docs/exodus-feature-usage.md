# DMK features used by Exodus Mobile and Treasury

Source review: 2026-10-21. SDK `develop` at `4f17dbbe`, Mobile at `35c01dc58a`,
Treasury at `55542ef`, including the local DMK integration changes. This inventory
describes current application paths, not every possible caller of the SDK's public API.
Hardware verification in Treasury is deferred. The local cleanup described below
changes the SDK only; the applications still use their previous local tarballs.

## Local cleanup

- Removed Bitcoin raw-message signing and final-transaction signing. PSBT signing,
  wallet registration, HMACs, Taproot partial signatures and BIP-322 remain supported.
- Removed Ethereum standalone Safe-address verification and EIP-7702 delegation
  signing. Transaction, personal-message and typed-data signing remain unchanged.
- Removed Tron ECDH and direct transaction-hash signing, and XRP's standalone
  app-configuration API. Normal transaction and address operations remain.
- Removed ETH/Tron Ledger-contact provisioning, builder options, DI bindings and
  contacts-kit dependencies together. Neither app's own address book is affected.
- Removed `OpenAppWithDependenciesDeviceAction` and `ListAppsWithMetadataDeviceAction`,
  including implementations, types, exports and demo callers. Basic listing,
  opening/closing, firmware metadata, certificates and session handling remain.
- Updated affected SDK demos, CLI and clear-signing test tooling. Contact-signing
  scenarios now fail explicitly rather than silently ignoring their address book.
- Solana source and dependencies are unchanged, including v1 handling.

The broader Manager/firmware removal is not part of this pass: the upstream
`ledger-wallet` package still depends on installation, language, firmware and
custom-lock-screen operations. Removing those coherently requires deleting or
separating that tooling, not leaving it with broken imports. Its code is outside
the Exodus apps' runtime dependency closure, but shared Manager code in core remains.

## Method and scope

Compared the apps' adapters, shared `@exodus/hw-ledger` dispatch, Treasury's BTC/ETH/SOL
multisig calls, Mobile's message-signing consumers, SDK signer APIs and internal calls.
Traversed workspace dependencies, peer dependencies and optional dependencies from
the five used signer kits, core DMK and Mobile's RN BLE transport. Dev dependencies
and demo applications are not production roots. Source-only matches are not enough
to call something removable: default context loaders, DI bindings, public exports
and firmware-dependent branches also matter.

Nine packages from this SDK repository are in the combined DMK runtime dependency
closure (upstream names are rewritten to the Exodus scope by the release script):

- `@exodus/ledger-device-management-kit`
- `@exodus/ledger-signer-utils`
- `@exodus/ledger-context-module`
- `@exodus/ledger-device-signer-kit-bitcoin`
- `@exodus/ledger-device-signer-kit-ethereum`
- `@exodus/ledger-device-signer-kit-solana`
- `@exodus/ledger-device-signer-kit-tron`
- `@exodus/ledger-device-signer-kit-xrp`
- `@exodus/ledger-device-transport-kit-react-native-ble`

`@exodus/device-reactivity` comes from a separate repository and is additionally
required. Treasury uses the existing WebUSB transport through its local DMK bridge;
it does not add another DMK transport package. Treasury only uses three signer
families, but the shared adapter imports all five. Tron and XRP remain needed by Mobile.

## Solana and contacts clarification

### Solana v1 and the extra decoder dependency

Neither app currently constructs SIMD-0385/v1 transactions. Treasury constructs
v0 messages (including ALTs and durable nonces); the Exodus Solana web3 fork used
by both apps exposes legacy/v0 deserialization, not v1.

DMK nevertheless supports v1 through `TransactionInputNormaliser` and
`BlockhashService`, importing `@solana/transaction-messages`.
**That package is not used only for v1.**
`services/utils/solanaDecoding.ts` also invokes its decoder to validate legacy/v0
messages, and `BlockhashService.getRefreshBlocker` uses it for nonce/multisigner checks.
Deleting the import or replacing validation with a permissive parser is unsafe.

Here "v1" means the SIMD-0385 transaction wire format, not web3.js 1.x and not
v0/lookup-table transactions, which Treasury uses. No Solana functionality or
dependency is removed in this pass. Any future decoder replacement must preserve
strict malformed-length/shortvec validation, original bytes, durable nonces and
multisigner protections; it is not a prerequisite for the other cleanup.

Treasury currently resolves its subtree to 13 `@solana/*` packages at 8.5.0, plus
`chalk` and an already configured stub. This is a dependency-subtree count, **not**
a claim that all those packages are exclusively used here, unaudited, or removable
without checking other incoming dependencies. Mobile's resolved versions may differ.

Sources: `packages/signer/signer-solana/src/internal/app-binder/services/TransactionInputNormaliser.ts`,
`BlockhashService.ts`, and `services/utils/solanaDecoding.ts`.

### Ledger device contacts

Neither app creates a `ContactsManager`, registers/renames Ledger contacts, or calls
`withAddressBook`. Previously ETH/TRX builders bound empty address books by default. These are
Ledger on-device contacts, not either app's own address book or Treasury recipients.

Previously the contacts kit was pulled in by ETH/TRX's contact-provision helpers.
This cleanup removes those optional branches and their DI/API wiring in the same
change as the dependency. There was no requirement for a separate prerequisite PR.
The standalone contacts package remains available to upstream SDK tools but is no
longer in the selected Exodus release closure. Its main third-party dependencies
are also used by core, so this does not eliminate Inversify or reactivity or establish
any new third-party audit-status claim.

## Usage rationale and remaining candidates

- **Removed Bitcoin final-transaction convenience API:** the adapter calls `signPsbt`, not
  `SignerBtc.signTransaction`. Exodus assembles the transaction. PSBT parsing,
  normalization and serialization are still used; this does not make bitcoinjs-lib
  removable merely by deleting the convenience method.
- **Removed Bitcoin raw message signing:** the DMK adapter deliberately rejects it. DMK's
  `signMessage` entry point is unused; BIP-322 is a separate PSBT-based path.
- **Bitcoin MuSig2:** Treasury uses Taproot `sortedmulti_a`, not MuSig2. MuSig2
  nonce/partial-signature variants are not consumed; the adapter rejects those
  variants. Keep Schnorr/tapleaf signatures and wallet policy registration.
- **Removed Ethereum standalone Safe-address verification and EIP-7702 delegation signing:**
  neither adapter calls `verifySafeAddress` or `signDelegationAuthorization`.
  Safe context helpers and ordinary contract transactions are a separate question.
- **Removed Tron ECDH and direct hash signing:** neither app calls `getECDHSecret` or
  `signTransactionHash`. Keep ordinary `signTransaction`; its configuration and
  clear-signing steps are still internal consumers.
- **Solana delayed signing/blockhash refresh:** both apps use the shared client with
  `delayed: false`, and do not supply a refresh RPC or `fetchBlockhash`. The Exchange
  app orchestration path is not selected by their Ledger asset handlers. Do not
  confuse removing this optional mode with dropping durable-nonce transactions.
- **Standalone configuration APIs:** XRP's removed `getAppConfig` is not called by
  either adapter. Solana/TRX configuration queries are called internally by signing,
  even though their public configuration APIs are not called directly.
- **Device management:** neither app asks DMK to install/update applications, install
  language packs, manage firmware/custom lock screens, or run Ledger Manager secure
  channel operations. App metadata, listing/opening/quitting and session status are
  still needed. Signers use generic DMK action/task infrastructure even with
  `skipOpenApp: true`; exports, DI and shared helpers need disentangling before pruning.

## Product-unused but still exposed: message formats

The shared adapter exposes ETH typed data, Solana raw off-chain messages, Tron
personal messages and Bitcoin BIP-322. Do not silently remove these as dead code.

Mobile still contains message-signing consumers despite WalletConnect's removal:
Polymarket signs EIP-712, while dividends and Pay Card use message proofs. In the
reviewed paths Polymarket/Pay Card choose the default software account and dividends
explicitly filters to it; this does not establish a current Ledger EIP-712 requirement.
Treasury does require Ethereum personal signing: it computes the Safe EIP-712 hash
locally, then signs the hash as a personal message (`ethereum.ts:984`). It does not
call Ledger typed-data signing for that flow.

If narrowing the hardware adapter's public contract, confirm those message formats
are intentionally unsupported for Ledger and add explicit unsupported-operation
tests. Their absence from current hardware UI paths is not permission to change a
shared library's contract unnoticed.

Sources in Mobile: `apps/mobile/src/background/features/polymarket/module/keychain-signer.ts:36`,
`polymarket.ts:1394`, `libs/features/dividends/module/dividends.ts:74`,
`libs/features/dividends/module/registration.ts:75`, and
`libs/features/pay-card/module/pay-card.ts:358`.

## Keep: indirect signing dependencies

- BTC wallet registration, cached HMACs, PSBT inputs/change, tapleaf hashes and partial
  signatures are required by Treasury, even if Mobile's normal sends do not use them.
- Solana legacy/v0, lookup tables, durable nonces, original bytes and co-signer
  signatures are required. Newer firmware can select clear-signing branches not
  exercised by the offline fixture's basic-signing configuration.
- ETH token/NFT transaction contexts, certificates, transaction decoding, and
  conditional clear-signing checks must not be deleted just because the app calls
  only `signTransaction`. NFT approval is a transaction, not EIP-712.
- Default context builders may load trusted names, transaction checks, plugins,
  network metadata and related signing context internally. These are not proven
  unused by absence of direct app calls.
- Sentry is removed, but this does not imply every reporting path is absent:
  `DefaultContextModule.report` has an ETH blind-signing reporter; `signReport` is
  currently a no-op because its reporter is initialized to null. Removing reporting
  is a separate explicit behavior change, not an unused-feature assumption.

## Packages outside both apps' runtime dependency closure

After removing contacts wiring, 25 public SDK workspace packages are outside the
selected runtime roots:

- The Ledger contacts kit, now used only by separate SDK tooling.

- Seven signer kits: Aleo, Concordium, Cosmos, Hyperliquid, ICP, Polkadot and Zcash.
- Four device transports: Node HID, RN HID, Web BLE and Web HID. These remain in the
  release selection but are not installed for this integration. Trimming the release
  selection is sensible; it does not reduce either app's already installed closure.
- Six devtools packages: core, rozenite, UI, websocket-common, websocket-connector
  and websocket-server.
- Five simulator packages: mockserver client, mockserver React, mockserver transport,
  Speculos transport and Speculos device controller. Retain useful test tooling;
  non-production is not the same as useless.
- `@ledgerhq/dmk-ledger-wallet` and the Ledger keyring protocol kit.

The Concordium signer is outside the closure, but Concordium context code is still
imported by the shared context module. Removing unused chain-specific context code
is another possible source reduction; it requires updating that module's DI/exports.

## Suggested order

1. Build/test the pruned SDK and repack it before retesting either app; existing
   installed tarballs do not change when SDK source changes.
2. Finish Treasury's deferred real-device tests before claiming hardware parity.
3. Decide whether to remove or separate upstream Manager/firmware tooling before
   further pruning the shared core management APIs.
4. Consider decoder or release-selection reductions separately; retain Solana
   support and simulator/devtool code needed for maintenance.

## Validation of this local cleanup

- All SDK libraries build and type-check.
- SDK-wide unit tests: 6,418 passed, 11 skipped. This includes all five signer
  families, Solana v1/v0 support, BLE and the retained Manager/firmware tooling.
- Clear-signing tool: 80 unit tests passed; its type check and the web sample's
  type check pass. Contact-signing scenarios explicitly reject unsupported input.
- The CLI type check still reports an unrelated error in unchanged
  `apps/ldmk-cli/app/handlers/signer/handlers/eth-signer/handlers/SignTransactionEthSignerActionHandler.ts:68`:
  it passes `domain`, but `TransactionOptions` accepts only `skipOpenApp`.
- No new app tarballs were installed and no physical signing was performed.
  Treasury's hardware checks remain deferred; these tests do not establish
  real-device signing parity.
