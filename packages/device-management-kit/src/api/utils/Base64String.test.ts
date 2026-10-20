import {
  base64StringToBuffer,
  bufferToBase64String,
  isBase64String,
} from "./Base64String";

describe("Base64String", () => {
  it.each([
    ["", []],
    ["Zg==", [0x66]],
    ["Zm8=", [0x66, 0x6f]],
    ["Zm9v", [0x66, 0x6f, 0x6f]],
    ["+/8=", [0xfb, 0xff]],
    ["AQID\nkAA=", [0x01, 0x02, 0x03, 0x90, 0x00]],
    [" \t\r\n\v\f\u00a0\u2003", []],
    [" Z\tg=\r\n=\u00a0\u2003", [0x66]],
  ])("accepts and decodes %j", (encoded, expected) => {
    expect(isBase64String(encoded)).toBe(true);
    expect(base64StringToBuffer(encoded)).toStrictEqual(
      Uint8Array.from(expected),
    );
  });

  it.each([
    "invalid string",
    "Zg",
    "Zg=",
    "Zg===",
    "A===",
    "====",
    "Z=g=",
    "AA=A",
    "-w==",
    "_w==",
    "AA\u200b==",
  ])("rejects %j without throwing", (encoded) => {
    expect(isBase64String(encoded)).toBe(false);
    expect(base64StringToBuffer(encoded)).toBeNull();
  });

  it.each(Array.from("wxyz0123456789+/"))(
    "ignores unused bits in the final sextet of /%s==",
    (last) => {
      const encoded = `/${last}==`;
      expect(isBase64String(encoded)).toBe(true);
      const decoded = base64StringToBuffer(encoded);
      expect(decoded).toStrictEqual(Uint8Array.of(0xff));
      expect(decoded?.buffer.byteLength).toBe(1);
    },
  );

  it.each(Array.from("89+/"))(
    "ignores unused bits in the final sextet of //%s=",
    (last) => {
      const encoded = `//${last}=`;
      expect(isBase64String(encoded)).toBe(true);
      const decoded = base64StringToBuffer(encoded);
      expect(decoded).toStrictEqual(Uint8Array.of(0xff, 0xff));
      expect(decoded?.buffer.byteLength).toBe(2);
    },
  );

  it.each([
    [[], ""],
    [[0x66], "Zg=="],
    [[0x66, 0x6f], "Zm8="],
    [[0x66, 0x6f, 0x6f], "Zm9v"],
    [[0xfb, 0xff], "+/8="],
  ])("encodes %j with padding", (bytes, expected) => {
    expect(bufferToBase64String(Uint8Array.from(bytes))).toBe(expected);
  });

  it("encodes only the selected subarray", () => {
    const bytes = Uint8Array.of(0x00, 0xfb, 0xff, 0x00);
    expect(bufferToBase64String(bytes.subarray(1, 3))).toBe("+/8=");
  });

  it("round-trips every byte with each padding length", () => {
    const bytes = Uint8Array.from({ length: 258 }, (_, index) => index % 256);
    for (const length of [256, 257, 258]) {
      const input = bytes.slice(0, length);
      expect(base64StringToBuffer(bufferToBase64String(input))).toStrictEqual(
        input,
      );
    }
  });

  it("rejects non-byte-array encoder input", () => {
    expect(() =>
      bufferToBase64String({ length: 1, 0: 0xff } as unknown as Uint8Array),
    ).toThrow();
  });
});
