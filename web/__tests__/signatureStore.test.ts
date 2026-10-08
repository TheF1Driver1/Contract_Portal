import { describe, expect, it, vi } from "vitest";
import { isStoredSignature, loadSignature, ownsSignature, signaturePath, storeSignature } from "@/lib/esign/signature-store";

const OWNER = "11111111-1111-1111-1111-111111111111";
const PNG = `data:image/png;base64,${Buffer.from("fake-png-bytes").toString("base64")}`;

function fakeAdmin() {
  const files = new Map<string, Buffer>();
  const upload = vi.fn(async (path: string, bytes: Buffer) => {
    files.set(path, bytes);
    return { error: null };
  });
  const download = vi.fn(async (path: string) =>
    files.has(path) ? { data: new Blob([new Uint8Array(files.get(path)!)]), error: null } : { data: null, error: { message: "not found" } }
  );
  const admin = { storage: { from: vi.fn(() => ({ upload, download })) } };
  return { admin: admin as never, files, upload };
}

describe("signature store", () => {
  it("uploads a data URL and returns a reference in the owner's folder", async () => {
    const { admin, files } = fakeAdmin();
    const ref = await storeSignature(admin, OWNER, PNG);
    expect(isStoredSignature(ref)).toBe(true);
    expect(ref).toMatch(new RegExp(`^sig:landlord-signatures/${OWNER}/[0-9a-f]{32}\\.png$`));
    expect(files.size).toBe(1);
  });

  it("is content-addressed (same image, same path)", () => {
    const bytes = Buffer.from("x");
    expect(signaturePath(OWNER, bytes, "png")).toBe(signaturePath(OWNER, bytes, "png"));
    expect(signaturePath(OWNER, bytes, "jpeg")).toMatch(/\.jpg$/);
  });

  it("keeps the owner's own reference and drops anyone else's", async () => {
    const { admin, upload } = fakeAdmin();
    const own = `sig:landlord-signatures/${OWNER}/abc.png`;
    expect(await storeSignature(admin, OWNER, own)).toBe(own);
    expect(await storeSignature(admin, OWNER, "sig:landlord-signatures/22222222-2222-2222-2222-222222222222/abc.png")).toBeNull();
    expect(ownsSignature(`sig:landlord-signatures/${OWNER}/../other/x.png`, OWNER)).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects anything that is not a PNG/JPEG data URL", async () => {
    const { admin } = fakeAdmin();
    expect(await storeSignature(admin, OWNER, "data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(await storeSignature(admin, OWNER, "https://example.com/x.png")).toBeNull();
    expect(await storeSignature(admin, OWNER, "")).toBeNull();
  });

  it("loads stored images back as data URLs and passes legacy values through", async () => {
    const { admin } = fakeAdmin();
    const ref = (await storeSignature(admin, OWNER, PNG))!;
    expect(await loadSignature(admin, ref)).toBe(PNG);
    expect(await loadSignature(admin, PNG)).toBe(PNG);
    expect(await loadSignature(admin, null)).toBeNull();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await loadSignature(admin, `sig:landlord-signatures/${OWNER}/missing.png`)).toBeNull();
  });
});
