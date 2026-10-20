import { fromBase64, toBase64 } from "@exodus/bytes/base64.js";

function normalizeBase64String(value: string): string {
  return value.replace(/\s/g, "");
}

export function isBase64String(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    normalizeBase64String(value),
  );
}

export function base64StringToBuffer(value: string): Uint8Array | null {
  const normalizedValue = normalizeBase64String(value);
  if (!isBase64String(normalizedValue)) {
    return null;
  }
  const unpadded = normalizedValue.replace(/=+$/, "");
  return fromBase64(unpadded.padEnd(normalizedValue.length, "A")).slice(
    0,
    Math.floor((unpadded.length * 3) / 4),
  );
}

export function bufferToBase64String(bytes: Uint8Array): string {
  return toBase64(bytes);
}
