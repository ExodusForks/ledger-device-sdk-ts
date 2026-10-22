import { type ContextModule } from "@ledgerhq/context-module";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerTrxBuilder } from "@api/SignerTrxBuilder";
import { APP_NAME, INS, LEDGER_CLA } from "@internal/app-binder/constants";
import { DefaultSignerTrx } from "@internal/DefaultSignerTrx";
import { externalTypes } from "@internal/externalTypes";

describe("SignerTrxBuilder", () => {
  const dmk = {
    getLoggerFactory: vi.fn().mockReturnValue(vi.fn()),
  } as unknown as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "" };

  test("should be an instance of SignerTrxBuilder", () => {
    const builder = new SignerTrxBuilder(defaultConstructorArgs);

    expect(builder).toBeInstanceOf(SignerTrxBuilder);
  });

  test("should build a DefaultSignerTrx", () => {
    const builder = new SignerTrxBuilder(defaultConstructorArgs);

    const signer = builder.build();

    expect(signer).toBeInstanceOf(DefaultSignerTrx);
    expect(builder).not.toHaveProperty("withAddressBook");
    expect(signer).not.toHaveProperty("getECDHSecret");
    expect(signer).not.toHaveProperty("signTransactionHash");
    for (const name of [
      "getAddress",
      "getAppConfiguration",
      "signTransaction",
      "signPersonalMessage",
    ]) {
      expect(signer).toHaveProperty(name, expect.any(Function));
    }
  });
  test("should build with a default Tron context module", () => {
    const builder = new SignerTrxBuilder(defaultConstructorArgs);

    const signer = builder.build();

    expect(
      signer["_container"].get<ContextModule>(externalTypes.ContextModule),
    ).toBeDefined();
  });

  test("should build with a custom context module", () => {
    const contextModule = { getContexts: vi.fn() } as unknown as ContextModule;
    const builder = new SignerTrxBuilder(defaultConstructorArgs);

    const signer = builder.withContextModule(contextModule).build();

    expect(
      signer["_container"].get<ContextModule>(externalTypes.ContextModule),
    ).toBe(contextModule);
  });
});

describe("Tron APDU constants", () => {
  test("APP_NAME should be Tron", () => {
    expect(APP_NAME).toBe("Tron");
  });

  test("LEDGER_CLA should be 0xE0", () => {
    expect(LEDGER_CLA).toBe(0xe0);
  });

  test("INS values should match the Tron app protocol", () => {
    expect(INS.GET_ADDRESS).toBe(0x02);
    expect(INS.SIGN_TRANSACTION).toBe(0x04);
    expect(INS.GET_APP_CONFIGURATION).toBe(0x06);
    expect(INS.SIGN_PERSONAL_MESSAGE).toBe(0x08);
  });
});
