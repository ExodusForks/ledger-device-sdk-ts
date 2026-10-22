export enum EthSignerActionTypes {
  GET_ADDRESS = "get-address",
  SIGN_MESSAGE = "sign-message",
  SIGN_TRANSACTION = "sign-transaction",
  SIGN_TYPED_DATA = "sign-typed-data",
}

export type EthSignerActionType = EthSignerActionTypes;
