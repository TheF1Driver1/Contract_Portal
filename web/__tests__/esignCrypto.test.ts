// @vitest-environment node
import { describe, expect, it } from "vitest";
import { agreementHash, canonicalJson, hashOtp, hashToken, newOtp, newToken, safeEqualHex } from "@/lib/esign/crypto";

describe("e-sign crypto", () => {
  it("makes unguessable tokens and stores only their hash", () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("issues six-digit codes bound to a signer", () => {
    const code = newOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(hashOtp("s1", code)).not.toBe(hashOtp("s2", code));
    expect(safeEqualHex(hashOtp("s1", code), hashOtp("s1", ` ${code} `))).toBe(true);
    expect(safeEqualHex(hashOtp("s1", code), hashOtp("s1", "000000" === code ? "111111" : "000000"))).toBe(false);
    expect(safeEqualHex(null, hashOtp("s1", code))).toBe(false);
  });

  it("hashes agreements independent of key order and sensitive to terms", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 0 }] })).toBe('{"a":[2,{"c":0,"d":1}],"b":1}');
    const base = { id: "c1", rent_amount: 1150, lease_start: "2026-11-01", ignored: "x" };
    const h1 = agreementHash(base, [{ title: "Mascotas", body: "No" }]);
    expect(agreementHash({ lease_start: "2026-11-01", rent_amount: 1150, id: "c1" }, [{ title: "Mascotas", body: "No" }])).toBe(h1);
    expect(agreementHash({ ...base, rent_amount: 1200 }, [{ title: "Mascotas", body: "No" }])).not.toBe(h1);
    expect(agreementHash(base, [{ title: "Mascotas", body: "Sí" }])).not.toBe(h1);
  });
});
