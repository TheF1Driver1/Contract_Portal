import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { fieldEncryptionEnabled } from "@/lib/crypto/fields";
import { backfillPiiBatch } from "@/lib/crypto/backfill";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-off: encrypts license numbers and birth dates written before
 * FIELD_ENCRYPTION_KEY was set, and moves inline landlord signature images
 * into private storage. Not scheduled; call it until `done` is true:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/encrypt-pii
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!fieldEncryptionEnabled()) {
    return NextResponse.json({ error: "FIELD_ENCRYPTION_KEY is not set" }, { status: 400 });
  }
  const result = await backfillPiiBatch(createAdminClient());
  return NextResponse.json(result);
}
