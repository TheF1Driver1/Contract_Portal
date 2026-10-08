// ATH Móvil Payment Button API (Evertec), server side only.
// https://github.com/evertec/ATHM-Payment-Button-API
//
// JSON over HTTPS. There is no sandbox: every call moves real money, so tests
// mock `fetch`. Never log tokens or phone numbers from here.

export const ATH_BASE_URL = "https://payments.athmovil.com/api/business-transaction/ecommerce";
export const ATH_MIN_TOTAL = 1;
export const ATH_MAX_TOTAL = 1500;
/** Seconds the payer has to confirm in the app (API allows 120–600). */
export const ATH_TIMEOUT_SECONDS = 600;
const REQUEST_TIMEOUT_MS = 15_000;

export type AthEcommerceStatus = "OPEN" | "CONFIRM" | "COMPLETED" | "CANCEL";

export type AthItem = { name: string; description: string; quantity: string; price: string; tax: string; metadata: string };

export type AthPaymentRequest = {
  publicToken: string;
  total: number;
  phoneNumber: string;
  metadata1: string;
  metadata2: string;
  items: AthItem[];
  timeout?: number;
  subtotal?: number;
  tax?: number;
};

export type AthTransaction = {
  ecommerceStatus: AthEcommerceStatus | string;
  ecommerceId?: string;
  referenceNumber?: string | null;
  transactionDate?: string | null;
  total?: number | null;
  fee?: number | null;
  netAmount?: number | null;
};

/** An error the API answered with (`status: "error"`), or a transport failure (`errorcode` null). */
export class AthMovilError extends Error {
  constructor(
    message: string,
    readonly errorcode: string | null,
    readonly httpStatus: number | null = null
  ) {
    super(message);
    this.name = "AthMovilError";
  }
}

/** Known codes worth branching on. */
export const ATH_ERRORS = {
  amountOverLimits: "BTRA_0004",
  notFound: "BTRA_0031",
  notConfirmed: "BTRA_0032",
  expired: "BTRA_0039",
} as const;

type Fetch = typeof fetch;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const money = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** ATH Móvil phone numbers are 10 digits (787/939 + 7). Returns null when not usable. */
export function normalizeAthPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^\d{10}$/.test(ten) ? ten : null;
}

export function validTotal(total: number): boolean {
  return Number.isFinite(total) && money(total) >= ATH_MIN_TOTAL && money(total) <= ATH_MAX_TOTAL;
}

async function call<T>(path: string, body: unknown, opts: { bearer?: string | null; fetch?: Fetch } = {}): Promise<T> {
  const f = opts.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  let res: Response;
  try {
    res = await f(`${ATH_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError" || controller.signal.aborted;
    throw new AthMovilError(aborted ? "ATH Móvil no respondió a tiempo." : "No se pudo conectar con ATH Móvil.", null);
  } finally {
    clearTimeout(timer);
  }
  type Envelope = { status?: string; message?: string; errorcode?: string; data?: unknown };
  let json: Envelope | null = null;
  try {
    json = (await res.json()) as Envelope | null;
  } catch {
    json = null;
  }
  if (!json || json.status !== "success" || !res.ok) {
    const message = typeof json?.message === "string" && json.message ? clip(json.message, 200) : `ATH Móvil respondió ${res.status}.`;
    throw new AthMovilError(message, typeof json?.errorcode === "string" ? json.errorcode : null, res.status);
  }
  return json.data as T;
}

function toTransaction(d: Record<string, unknown> | null | undefined): AthTransaction {
  const data = d ?? {};
  return {
    ecommerceStatus: String(data.ecommerceStatus ?? ""),
    ecommerceId: data.ecommerceId != null ? String(data.ecommerceId) : undefined,
    referenceNumber: data.referenceNumber != null && data.referenceNumber !== "" ? String(data.referenceNumber) : null,
    transactionDate: data.transactionDate != null ? String(data.transactionDate) : null,
    total: num(data.total),
    fee: num(data.fee),
    netAmount: num(data.netAmount),
  };
}

/** Starts a payment; the payer gets a push notification in the ATH Móvil app. */
export async function createPayment(req: AthPaymentRequest, opts: { fetch?: Fetch } = {}): Promise<{ ecommerceId: string; authToken: string }> {
  if (!validTotal(req.total)) throw new AthMovilError("La cantidad debe estar entre $1.00 y $1,500.00.", ATH_ERRORS.amountOverLimits);
  const total = money(req.total);
  const body = {
    publicToken: req.publicToken,
    timeout: Math.min(Math.max(req.timeout ?? ATH_TIMEOUT_SECONDS, 120), 600),
    total,
    subtotal: money(req.subtotal ?? total),
    tax: money(req.tax ?? 0),
    metadata1: clip(req.metadata1, 40),
    metadata2: clip(req.metadata2, 40),
    items: req.items,
    phoneNumber: req.phoneNumber,
  };
  const data = await call<{ ecommerceId?: unknown; auth_token?: unknown }>("/payment", body, opts);
  if (!data?.ecommerceId || !data?.auth_token) throw new AthMovilError("Respuesta inesperada de ATH Móvil.", null);
  return { ecommerceId: String(data.ecommerceId), authToken: String(data.auth_token) };
}

/** Current status. Sends the payment's auth token too when known (some docs show it). */
export async function findPayment(
  args: { publicToken: string; ecommerceId: string; authToken?: string | null },
  opts: { fetch?: Fetch } = {}
): Promise<AthTransaction> {
  const data = await call<Record<string, unknown>>(
    "/business/findPayment",
    { ecommerceId: args.ecommerceId, publicToken: args.publicToken },
    { ...opts, bearer: args.authToken }
  );
  return toTransaction(data);
}

/** Completes a payment the customer confirmed (status CONFIRM), before the timeout. */
export async function authorizePayment(authToken: string, opts: { fetch?: Fetch } = {}): Promise<AthTransaction> {
  const data = await call<Record<string, unknown>>("/authorization", undefined, { ...opts, bearer: authToken });
  const tx = toTransaction(data);
  return { ...tx, ecommerceStatus: tx.ecommerceStatus || "COMPLETED" };
}

export async function cancelPayment(
  args: { publicToken: string; ecommerceId: string; authToken?: string | null },
  opts: { fetch?: Fetch } = {}
): Promise<void> {
  await call("/business/cancel", { ecommerceId: args.ecommerceId, publicToken: args.publicToken }, { ...opts, bearer: args.authToken });
}

export async function refundPayment(
  args: { publicToken: string; privateToken: string; referenceNumber: string; amount: number; message?: string },
  opts: { fetch?: Fetch } = {}
): Promise<AthTransaction> {
  const data = await call<Record<string, unknown>>(
    "/refund",
    {
      publicToken: args.publicToken,
      privateToken: args.privateToken,
      referenceNumber: args.referenceNumber,
      amount: money(args.amount),
      ...(args.message ? { message: clip(args.message, 50) } : {}),
    },
    opts
  );
  return toTransaction(data);
}
