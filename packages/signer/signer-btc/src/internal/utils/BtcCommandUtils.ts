import {
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  type CommandSuccessResult,
  CommandUtils as DmkCommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type WalletAddress } from "@api/model/Wallet";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { SW_INTERRUPTED_EXECUTION } from "@internal/app-binder/command/utils/constants";
const WALLET_ID_LENGTH = 32;
const WALLET_HMAC_LENGTH = 32;

export type WalletRegistrationResult = {
  walletId: Uint8Array;
  walletHmac: Uint8Array;
};

export class BtcCommandUtils {
  static isContinueResponse(response: ApduResponse) {
    return (
      response.statusCode[0] === SW_INTERRUPTED_EXECUTION[0] &&
      response.statusCode[1] === SW_INTERRUPTED_EXECUTION[1]
    );
  }
  static isSuccessResponse(response: ApduResponse) {
    return (
      DmkCommandUtils.isSuccessResponse(response) ||
      BtcCommandUtils.isContinueResponse(response)
    );
  }

  static getAddress(
    response: CommandSuccessResult<ApduResponse>,
  ): CommandResult<WalletAddress, BtcErrorCodes> {
    const parser = new ApduParser(response.data);
    if (!response.data) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to extract address from response",
        ),
      });
    }

    const address = parser.encodeToString(response.data.data);
    return CommandResultFactory({
      data: {
        address,
      },
    });
  }

  static getWalletRegistration(
    response: CommandSuccessResult<ApduResponse>,
  ): CommandResult<WalletRegistrationResult, BtcErrorCodes> {
    const parser = new ApduParser(response.data);

    const walletId = parser.extractFieldByLength(WALLET_ID_LENGTH);
    if (!walletId) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Wallet ID is missing"),
      });
    }

    const walletHmac = parser.extractFieldByLength(WALLET_HMAC_LENGTH);
    if (!walletHmac) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Wallet HMAC is missing"),
      });
    }

    return CommandResultFactory({
      data: {
        walletId,
        walletHmac,
      },
    });
  }
}
