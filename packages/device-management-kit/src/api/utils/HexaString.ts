import { fromHex, toHex } from "@exodus/bytes/hex.js";

export type HexaString = `0x${string}`;

export function isHexaString(value: unknown): value is HexaString {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

export function hexaStringToBuffer(value: string): Uint8Array | null {
  if (value.startsWith("0x")) {
    value = value.slice(2);
  }
  if (value.length % 2 !== 0) {
    value = "0" + value;
  }
  try {
    return fromHex(value);
  } catch {
    return null;
  }
}

export function bufferToHexaString(
  value: Uint8Array,
  withPrefix?: true,
): HexaString;
export function bufferToHexaString(
  value: Uint8Array,
  withPrefix?: false,
): string;
export function bufferToHexaString(
  value: Uint8Array,
  withPrefix: boolean = true,
): HexaString | string {
  const prefix = withPrefix ? "0x" : "";
  return `${prefix}${toHex(value)}`;
}
