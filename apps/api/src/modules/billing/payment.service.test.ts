import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMercadoPagoSignature } from "./payment.service.js";

const SECRET = "test-webhook-secret";

function signManifest(manifest: string) {
  return createHmac("sha256", SECRET).update(manifest).digest("hex");
}

describe("verifyMercadoPagoSignature", () => {
  it("accepts a valid signature", () => {
    const ts = "1704908010";
    const dataId = "123456789";
    const requestId = "req-abc";
    const hash = signManifest(`id:${dataId};request-id:${requestId};ts:${ts};`);

    expect(
      verifyMercadoPagoSignature({
        secret: SECRET,
        xSignature: `ts=${ts},v1=${hash}`,
        xRequestId: requestId,
        dataId,
      }),
    ).toBe(true);
  });

  it("accepts a valid signature without request id", () => {
    const ts = "1704908010";
    const dataId = "123456789";
    const hash = signManifest(`id:${dataId};ts:${ts};`);

    expect(
      verifyMercadoPagoSignature({
        secret: SECRET,
        xSignature: `ts=${ts},v1=${hash}`,
        xRequestId: undefined,
        dataId,
      }),
    ).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const ts = "1704908010";
    const dataId = "123456789";
    const hash = signManifest(`id:${dataId};ts:${ts};`);

    expect(
      verifyMercadoPagoSignature({
        secret: SECRET,
        xSignature: `ts=${ts},v1=${hash}`,
        xRequestId: undefined,
        dataId: "999999",
      }),
    ).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(
      verifyMercadoPagoSignature({ secret: SECRET, xSignature: undefined, xRequestId: undefined, dataId: "1" }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({ secret: SECRET, xSignature: "garbage", xRequestId: undefined, dataId: "1" }),
    ).toBe(false);
  });
});
