-- 016_check_constraints.sql (Plan 28) — apply at merge.
-- Mirror lib/schemas.ts in the database so a direct browser write through
-- PostgREST cannot store values the API would reject. Existing rows verified.

alter table public.contracts
  add constraint contracts_rent_positive check (rent_amount is null or rent_amount > 0),
  add constraint contracts_deposit_nonneg check (security_deposit is null or security_deposit >= 0),
  add constraint contracts_dates_ordered check (lease_start is null or lease_end is null or lease_end > lease_start),
  add constraint contracts_due_day_range check (payment_due_day is null or payment_due_day between 1 and 31),
  add constraint contracts_late_fee_day_range check (late_fee_day is null or late_fee_day between 1 and 31),
  add constraint contracts_lease_months_positive check (lease_months is null or lease_months > 0);

alter table public.properties
  add constraint properties_unit_count_positive check (unit_count is null or unit_count >= 1),
  add constraint properties_bathroom_count_nonneg check (bathroom_count is null or bathroom_count >= 0),
  add constraint properties_parking_count_nonneg check (parking_count is null or parking_count >= 0);
