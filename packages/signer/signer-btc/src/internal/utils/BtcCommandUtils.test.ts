import {
  ApduResponse,
  CommandResultFactory,
  type CommandSuccessResult,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";

describe("BtcCommandUtils", () => {
  describe("isSuccessResponse", () => {
    it("should return true if statusCode is e000", () => {
      // given
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0xe0, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = BtcCommandUtils.isSuccessResponse(apduResponse);
      // then
      expect(result).toBe(true);
    });
    it("should return true if statusCode is 9000", () => {
      // given
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = BtcCommandUtils.isSuccessResponse(apduResponse);
      // then
      expect(result).toBe(true);
    });
    it("should return false if statusCode is not allowed", () => {
      // given
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x43, 0x04]),
        data: Uint8Array.from([]),
      });
      // when
      const result = BtcCommandUtils.isSuccessResponse(apduResponse);
      // then
      expect(result).toBe(false);
    });
  });
  describe("isContinueResponse", () => {
    it("should return true if statusCode is e000", () => {
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0xe0, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = BtcCommandUtils.isContinueResponse(apduResponse);
      // then
      expect(result).toBe(true);
    });
    it("should return false if statusCode is 9000", () => {
      const apduResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = BtcCommandUtils.isContinueResponse(apduResponse);
      // then
      expect(result).toBe(false);
    });
  });

  describe("getAddress", () => {
    it("should return an address from valid response data", () => {
      // given
      const addressBytes = new TextEncoder().encode(
        "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
      );
      const result = CommandResultFactory({
        data: new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: addressBytes,
        }),
      });

      // when
      const address = BtcCommandUtils.getAddress(
        result as CommandSuccessResult<ApduResponse>,
      );

      // then
      expect(address).toStrictEqual(
        CommandResultFactory({
          data: {
            address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
          },
        }),
      );
    });
  });

  describe("getWalletRegistration", () => {
    const WALLET_ID = new Uint8Array([
      0x7c, 0x67, 0xe8, 0x4f, 0x99, 0x74, 0x46, 0x71, 0x14, 0x93, 0xef, 0x8b,
      0x74, 0x70, 0xb1, 0x0f, 0x60, 0x4b, 0x02, 0xd2, 0x58, 0x4f, 0xa0, 0x44,
      0x6f, 0xce, 0xf7, 0xd9, 0x89, 0x83, 0xe3, 0xdc,
    ]);
    const WALLET_HMAC = new Uint8Array([
      0x1d, 0x15, 0x0e, 0xd4, 0x25, 0xa8, 0x71, 0xa5, 0xca, 0x7e, 0x2c, 0x55,
      0xdb, 0x1b, 0x32, 0x95, 0xc1, 0xfd, 0x97, 0x14, 0x7f, 0xd0, 0xa7, 0xb1,
      0x88, 0xd4, 0x32, 0x7f, 0x4b, 0xa7, 0x40, 0x2a,
    ]);

    it("should return an error if wallet ID is missing", () => {
      // given
      const result = CommandResultFactory({
        data: new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array([]),
        }),
      });

      // when
      const registration = BtcCommandUtils.getWalletRegistration(
        result as CommandSuccessResult<ApduResponse>,
      );

      // then
      expect(registration).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Wallet ID is missing"),
        }),
      );
    });

    it("should return an error if wallet HMAC is missing", () => {
      // given
      const result = CommandResultFactory({
        data: new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: WALLET_ID, // Only 32 bytes, missing HMAC
        }),
      });

      // when
      const registration = BtcCommandUtils.getWalletRegistration(
        result as CommandSuccessResult<ApduResponse>,
      );

      // then
      expect(registration).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Wallet HMAC is missing"),
        }),
      );
    });

    it("should return wallet ID and HMAC from valid response", () => {
      // given
      const result = CommandResultFactory({
        data: new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array([...WALLET_ID, ...WALLET_HMAC]),
        }),
      });

      // when
      const registration = BtcCommandUtils.getWalletRegistration(
        result as CommandSuccessResult<ApduResponse>,
      );

      // then
      expect(registration).toStrictEqual(
        CommandResultFactory({
          data: {
            walletId: WALLET_ID,
            walletHmac: WALLET_HMAC,
          },
        }),
      );
    });
  });
});
