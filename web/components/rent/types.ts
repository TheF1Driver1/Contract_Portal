import type { Payment, RentCharge, RentLedger } from "@/lib/db";
import type { LedgerSummary, LateFeeType } from "@/lib/rent/schedule";

export type LedgerProps = {
  contractId: string;
  status: string;
  tenantHasEmail: boolean;
  rentAmount: number;
  today: string;
  lateFee: { type: LateFeeType; grace: number; fixed: number; daily: number };
  ledger: RentLedger | null;
  charges: RentCharge[];
  payments: Payment[];
  summary: LedgerSummary;
};
