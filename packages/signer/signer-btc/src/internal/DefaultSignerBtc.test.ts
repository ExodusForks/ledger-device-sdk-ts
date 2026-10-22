import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import {
  DefaultDescriptorTemplate,
  DefaultWallet,
  WalletPolicy,
} from "@api/model/Wallet";
import { DefaultSignerBtc } from "@internal/DefaultSignerBtc";
import { GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";
import { GetMasterFingerprintUseCase } from "@internal/use-cases/get-master-fingerprint/GetMasterFingerprintUseCase";
import { RegisterWalletUseCase } from "@internal/use-cases/register-wallet/RegisterWalletUseCase";
import { SignPsbtUseCase } from "@internal/use-cases/sign-psbt/SignPsbtUseCase";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("DefaultSignerBtc", () => {
  it("should be defined", () => {
    const signer = new DefaultSignerBtc({
      dmk: {} as DeviceManagementKit,
      sessionId: "session-id",
    });
    expect(signer).toBeDefined();
    expect(signer).not.toHaveProperty("signMessage");
    expect(signer).not.toHaveProperty("signTransaction");
    for (const name of [
      "getExtendedPublicKey",
      "getMasterFingerprint",
      "getWalletAddress",
      "registerWallet",
      "signPsbt",
    ]) {
      expect(signer).toHaveProperty(name, expect.any(Function));
    }
  });

  it("should call getExtendedPublicKeyUseCase", () => {
    vi.spyOn(GetExtendedPublicKeyUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: vi.fn(),
      getLoggerFactory: vi.fn().mockReturnValue(mockLoggerFactory),
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    signer.getExtendedPublicKey("44'/0'/0'/0/0", {
      checkOnDevice: true,
    });
    expect(GetExtendedPublicKeyUseCase.prototype.execute).toHaveBeenCalled();
  });

  it("should call getMasterFingerprintUseCase", () => {
    vi.spyOn(GetMasterFingerprintUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: vi.fn(),
      getLoggerFactory: vi.fn().mockReturnValue(mockLoggerFactory),
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    signer.getMasterFingerprint({ skipOpenApp: false });
    expect(GetMasterFingerprintUseCase.prototype.execute).toHaveBeenCalled();
  });

  it("should call registerWalletUseCase", () => {
    vi.spyOn(RegisterWalletUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: vi.fn(),
      getLoggerFactory: vi.fn().mockReturnValue(mockLoggerFactory),
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    const walletPolicy = new WalletPolicy(
      "My Multisig",
      "wsh(sortedmulti(2,@0/**,@1/**))",
      ["[f5acc2fd/48'/1'/0'/2']tpubXXX", "tpubYYY"],
    );
    signer.registerWallet(walletPolicy, { skipOpenApp: false });
    expect(RegisterWalletUseCase.prototype.execute).toHaveBeenCalled();
  });
  it("should call signPsbtUseCase", () => {
    vi.spyOn(SignPsbtUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: vi.fn(),
      getLoggerFactory: vi.fn().mockReturnValue(mockLoggerFactory),
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    signer.signPsbt(
      new DefaultWallet("44'/0'/0'", DefaultDescriptorTemplate.NATIVE_SEGWIT),
      "",
      { skipOpenApp: false },
    );
    expect(SignPsbtUseCase.prototype.execute).toHaveBeenCalled();
  });
});
