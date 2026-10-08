import * as z from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { AI_MODEL, FALLBACK_BETA, anthropic } from "./client";

export const RECEIPT_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
export type ReceiptMediaType = (typeof RECEIPT_MEDIA_TYPES)[number];
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

export const ReceiptExtraction = z.object({
  is_receipt: z.boolean(),
  vendor: z.string().nullable(),
  date: z.string().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().nullable(),
});
export type ReceiptExtraction = z.infer<typeof ReceiptExtraction>;

const SYSTEM = `You read receipts and invoices for landlords in Puerto Rico and turn them into a draft expense the landlord will review before saving.

Return:
- is_receipt: false if the file is not a receipt, invoice or bill (then leave the other fields null and category "other").
- vendor: the business name as printed.
- date: the purchase or invoice date as YYYY-MM-DD. Puerto Rico receipts usually print dates as MM/DD/YYYY. Null if absent or unreadable.
- total: the final amount paid or due, including IVU (sales tax) and fees, as a number without currency symbols.
- currency: ISO code, normally "USD".
- category: one of ${EXPENSE_CATEGORIES.join(", ")}. Hardware, plumbing and appliance parts or labor are "repairs" when they fix something and "maintenance" when routine (cleaning, landscaping, pest control). Power (LUMA), water (AAA), internet and gas are "utilities". CRIM bills are "taxes". Condominium fees are "hoa". Use "other" when unsure.
- description: a short Spanish summary of what was bought (at most 12 words), without personal data such as card numbers or customer names.

Never guess a value you cannot read; use null instead.`;

export class ReceiptError extends Error {
  constructor(public code: "refused" | "unreadable") {
    super(code);
  }
}

/** One structured-output call. Returns the draft plus token usage for metering. */
export async function extractReceipt(file: { bytes: Buffer; mediaType: ReceiptMediaType }) {
  const data = file.bytes.toString("base64");
  const source =
    file.mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: file.mediaType, data } } as const);

  const response = await anthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ReceiptExtraction) },
    system: SYSTEM,
    messages: [{ role: "user", content: [source, { type: "text", text: "Extract the expense from this file." }] }],
  });

  if (response.stop_reason === "refusal") throw new ReceiptError("refused");
  const out = response.parsed_output;
  if (!out) throw new ReceiptError("unreadable");
  return {
    draft: normalizeReceipt(out),
    usage: { model: response.model, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}

/** Defensive cleanup of model output before it reaches the form. */
export function normalizeReceipt(r: ReceiptExtraction): ReceiptExtraction {
  const date = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && !Number.isNaN(Date.parse(r.date)) ? r.date : null;
  const total = r.total !== null && Number.isFinite(r.total) && r.total > 0 && r.total < 1_000_000 ? Math.round(r.total * 100) / 100 : null;
  const clip = (s: string | null, n: number) => (s ? s.trim().slice(0, n) || null : null);
  return { ...r, date, total, vendor: clip(r.vendor, 200), description: clip(r.description, 300), currency: clip(r.currency, 3)?.toUpperCase() ?? null };
}
