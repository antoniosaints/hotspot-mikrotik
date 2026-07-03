import { describe, expect, it } from "vitest";
import { normalizeCpf, normalizeVoucherCode } from "../../utils/normalization.js";

describe("crud normalization", () => {
  it("normalizes CPF and voucher codes before persistence", () => {
    expect(normalizeCpf(" 123.456.789-00 ")).toBe("12345678900");
    expect(normalizeVoucherCode(" abcd 12 ")).toBe("ABCD12");
  });
});
