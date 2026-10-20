import { runInNewContext } from "node:vm";

import { buildSync } from "esbuild";

describe("browser byte helpers", () => {
  it("works without Buffer, atob, btoa, or native byte codecs", () => {
    const bundle = buildSync({
      stdin: {
        contents: `
          export * from "./Base64String";
          export * from "./HexaString";
        `,
        resolveDir: __dirname,
      },
      bundle: true,
      platform: "browser",
      format: "iife",
      globalName: "helpers",
      write: false,
    });

    const result: unknown = runInNewContext(
      `
      Uint8Array.fromBase64 = undefined;
      Uint8Array.fromHex = undefined;
      Uint8Array.prototype.toBase64 = undefined;
      Uint8Array.prototype.toHex = undefined;
      ${bundle.outputFiles[0]!.text}
      JSON.stringify({
        encoded: helpers.bufferToBase64String(Uint8Array.of(0xfb, 0xff)),
        decoded: Array.from(helpers.base64StringToBuffer(" / / 9 = ")),
        hex: helpers.bufferToHexaString(helpers.hexaStringToBuffer("0xf")),
        invalid: helpers.base64StringToBuffer("Zg"),
        globals: [typeof Buffer, typeof atob, typeof btoa, typeof window],
      });
    `,
      { TextEncoder, TextDecoder },
    );

    expect(result).toBe(
      JSON.stringify({
        encoded: "+/8=",
        decoded: [0xff, 0xff],
        hex: "0x0f",
        invalid: null,
        globals: ["undefined", "undefined", "undefined", "undefined"],
      }),
    );
  });
});
