import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Application-layer encryption for sensitive tenant fields (license / ID
// number, date of birth). AES-256-GCM with a server-held key, so a database
// dump or a leaked anon/service query alone does not reveal them.
//
// Stored form: "enc:v1:" + base64(iv[12] | tag[16] | ciphertext).
// Plaintext values written before encryption was enabled still read as-is.
// Without FIELD_ENCRYPTION_KEY nothing is encrypted (dev and pre-rollout).

const PREFIX = "enc:v1:";

function parseKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    console.error(JSON.stringify({ level: "error", msg: "field encryption key must be 32 bytes (base64)" }));
    return null;
  }
  return key;
}

/** Current key first; the previous key (if any) is only used to decrypt during rotation. */
function keys(): { current: Buffer | null; all: Buffer[] } {
  const current = parseKey(process.env.FIELD_ENCRYPTION_KEY);
  const previous = parseKey(process.env.FIELD_ENCRYPTION_KEY_PREVIOUS);
  return { current, all: [current, previous].filter((k): k is Buffer => !!k) };
}

export function fieldEncryptionEnabled(): boolean {
  return keys().current !== null;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Encrypts a value; null/empty stays null, already-encrypted values pass through. */
export function encryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (isEncrypted(value)) return value;
  const { current } = keys();
  if (!current) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", current, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

/** Decrypts a stored value; plaintext passes through; undecryptable values become null. */
export function decryptField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncrypted(value)) return String(value);
  const buf = Buffer.from(value.slice(PREFIX.length), "base64");
  if (buf.length < 29) return null;
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  for (const key of keys().all) {
    try {
      const d = createDecipheriv("aes-256-gcm", key, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
    } catch {
      // Try the next key.
    }
  }
  return null;
}

type PiiFields = { license_number?: string | null; date_of_birth?: string | null; date_of_birth_enc?: string | null };

/**
 * Prepares tenant/occupant values for writing: encrypts the license number and
 * moves the date of birth into `date_of_birth_enc` (the `date` column can't hold
 * ciphertext). Only keys present in `values` are touched, so partial updates work.
 */
export function sealPii<T extends Record<string, unknown>>(values: T): T & { date_of_birth_enc?: string | null } {
  const v = values as PiiFields;
  const out: PiiFields = { ...values };
  if ("license_number" in values) out.license_number = encryptField(v.license_number);
  if ("date_of_birth" in values) {
    if (fieldEncryptionEnabled() && v.date_of_birth) {
      out.date_of_birth_enc = encryptField(v.date_of_birth);
      out.date_of_birth = null;
    } else {
      out.date_of_birth_enc = null;
    }
  }
  return out as T & { date_of_birth_enc?: string | null };
}

/** Readable copy for server-side rendering and display. */
export function revealPii<T extends PiiFields | null | undefined>(row: T): T {
  if (!row) return row;
  const { date_of_birth_enc, ...rest } = row as PiiFields & Record<string, unknown>;
  return {
    ...rest,
    license_number: decryptField(row.license_number),
    date_of_birth: decryptField(date_of_birth_enc) ?? row.date_of_birth ?? null,
  } as unknown as T;
}
