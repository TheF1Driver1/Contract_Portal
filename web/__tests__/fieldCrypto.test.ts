import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptField, encryptField, fieldEncryptionEnabled, isEncrypted, revealPii, sealPii } from "@/lib/crypto/fields";
import { needsSealing } from "@/lib/crypto/backfill";

const KEY = randomBytes(32).toString("base64");
const OTHER = randomBytes(32).toString("base64");

beforeEach(() => vi.stubEnv("FIELD_ENCRYPTION_KEY", KEY));
afterEach(() => vi.unstubAllEnvs());

describe("encryptField / decryptField", () => {
  it("round-trips and never stores the plaintext", () => {
    const enc = encryptField("PR-123456789")!;
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("123456789");
    expect(decryptField(enc)).toBe("PR-123456789");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptField("x")).not.toBe(encryptField("x"));
  });

  it("passes plaintext and nulls through", () => {
    expect(decryptField("legacy-plain")).toBe("legacy-plain");
    expect(decryptField(null)).toBeNull();
    expect(encryptField("")).toBeNull();
    expect(encryptField(null)).toBeNull();
  });

  it("does not double-encrypt", () => {
    const enc = encryptField("A1")!;
    expect(encryptField(enc)).toBe(enc);
  });

  it("returns null for tampered ciphertext or the wrong key", () => {
    const enc = encryptField("A1")!;
    const tampered = enc.slice(0, -4) + (enc.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(decryptField(tampered)).toBeNull();
    vi.stubEnv("FIELD_ENCRYPTION_KEY", OTHER);
    expect(decryptField(enc)).toBeNull();
  });

  it("decrypts with the previous key during rotation", () => {
    const enc = encryptField("A1")!;
    vi.stubEnv("FIELD_ENCRYPTION_KEY", OTHER);
    vi.stubEnv("FIELD_ENCRYPTION_KEY_PREVIOUS", KEY);
    expect(decryptField(enc)).toBe("A1");
  });

  it("is a no-op without a key", () => {
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "");
    expect(fieldEncryptionEnabled()).toBe(false);
    expect(encryptField("A1")).toBe("A1");
  });

  it("rejects a key of the wrong length", () => {
    vi.stubEnv("FIELD_ENCRYPTION_KEY", Buffer.from("short").toString("base64"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(fieldEncryptionEnabled()).toBe(false);
  });
});

describe("sealPii / revealPii", () => {
  it("moves the birth date into the encrypted column and back", () => {
    const sealed = sealPii({ full_name: "Ana", license_number: "L-1", date_of_birth: "1990-04-02" });
    expect(sealed.date_of_birth).toBeNull();
    expect(isEncrypted(sealed.license_number)).toBe(true);
    expect(isEncrypted(sealed.date_of_birth_enc)).toBe(true);
    const shown = revealPii(sealed);
    expect(shown).toMatchObject({ full_name: "Ana", license_number: "L-1", date_of_birth: "1990-04-02" });
    expect(shown).not.toHaveProperty("date_of_birth_enc");
  });

  it("only touches the keys present (partial updates)", () => {
    expect(sealPii({ email: "a@b.co" })).toEqual({ email: "a@b.co" });
    expect(sealPii({ date_of_birth: null })).toEqual({ date_of_birth: null, date_of_birth_enc: null });
  });

  it("reads legacy plaintext rows unchanged", () => {
    expect(revealPii({ license_number: "OLD", date_of_birth: "1980-01-01" })).toEqual({ license_number: "OLD", date_of_birth: "1980-01-01" });
  });

  it("flags rows that still need sealing", () => {
    expect(needsSealing({ license_number: "OLD" })).toBe(true);
    expect(needsSealing({ date_of_birth: "1980-01-01" })).toBe(true);
    expect(needsSealing(sealPii({ license_number: "L", date_of_birth: "1980-01-01" }))).toBe(false);
    expect(needsSealing({})).toBe(false);
  });
});
