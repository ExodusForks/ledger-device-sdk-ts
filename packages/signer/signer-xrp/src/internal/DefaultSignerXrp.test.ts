import { from } from "@exodus/device-reactivity";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { DefaultSignerXrp } from "./DefaultSignerXrp";

describe("DefaultSignerXrp", () => {
  const sessionId = "test-session-id" as DeviceSessionId;

  const setup = () => {
    const expectedResult = { observable: from([]), cancel: vi.fn() };
    const executeDeviceAction = vi.fn().mockReturnValue(expectedResult);
    const dmk = {
      executeDeviceAction,
      getLoggerFactory: () => () => ({}),
    } as unknown as DeviceManagementKit;

    return {
      executeDeviceAction,
      expectedResult,
      signer: new DefaultSignerXrp({ dmk, sessionId }),
    };
  };

  it("should be defined", () => {
    const signer = new DefaultSignerXrp({
      dmk: {} as DeviceManagementKit,
      sessionId,
    });

    expect(signer).toBeDefined();
  });

  it("keeps address retrieval without app configuration", () => {
    const { signer, expectedResult, executeDeviceAction } = setup();
    expect(signer.getAddress("44'/144'/0'/0/0", { skipOpenApp: true })).toBe(
      expectedResult,
    );
    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    expect(signer).not.toHaveProperty("getAppConfig");
  });

  it("keeps transaction signing without app configuration", () => {
    const { signer, expectedResult, executeDeviceAction } = setup();
    expect(
      signer.signTransaction("44'/144'/0'/0/0", new Uint8Array([0x12]), {
        skipOpenApp: true,
      }),
    ).toBe(expectedResult);
    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
  });
});
