import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase-server";

// Landlord signature images live in the private `signed-documents` bucket
// (migration 020, service role only). The contracts row keeps a short
// reference, "sig:<path>", instead of a ~100 KB base64 image. Rows written
// before this change still hold a data URL, which keeps working.

type Admin = ReturnType<typeof createAdminClient>;

const BUCKET = "signed-documents";
const PREFIX = "sig:";
const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/;

export function isStoredSignature(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** A reference is only accepted back from a client if it is in that owner's folder. */
export function ownsSignature(ref: string, ownerId: string): boolean {
  return isStoredSignature(ref) && ref.slice(PREFIX.length).startsWith(`landlord-signatures/${ownerId}/`) && !ref.includes("..");
}

/** Path for an image: content-addressed, so saving the same signature twice is a no-op. */
export function signaturePath(ownerId: string, bytes: Buffer, ext: "png" | "jpeg"): string {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  return `landlord-signatures/${ownerId}/${hash}.${ext === "jpeg" ? "jpg" : "png"}`;
}

/**
 * Normalizes a landlord signature for storage: data URL -> uploaded + "sig:" ref;
 * own ref -> kept; anything else -> null.
 */
export async function storeSignature(admin: Admin, ownerId: string, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (isStoredSignature(value)) return ownsSignature(value, ownerId) ? value : null;
  const m = DATA_URL.exec(value);
  if (!m) return null;
  const ext = m[1] as "png" | "jpeg";
  const bytes = Buffer.from(m[2], "base64");
  const path = signaturePath(ownerId, bytes, ext);
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: `image/${ext}`, upsert: true });
  if (error) throw new Error(`signature upload failed: ${error.message}`);
  return PREFIX + path;
}

/**
 * Image for rendering (data URL), from a stored ref or a legacy data URL.
 * A stored ref is only followed inside the contract owner's folder, so a row
 * edited to point at someone else's object reads nothing.
 */
export async function loadSignature(admin: Admin, value: string | null | undefined, ownerId: string): Promise<string | null> {
  if (!value) return null;
  if (!isStoredSignature(value)) return /^data:image\/(png|jpeg);base64,/.test(value) ? value : null;
  if (!ownsSignature(value, ownerId)) return null;
  const path = value.slice(PREFIX.length);
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) {
    console.error(JSON.stringify({ level: "error", msg: "signature download failed", err: error?.message ?? "empty" }));
    return null;
  }
  const type = path.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return `data:${type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}
