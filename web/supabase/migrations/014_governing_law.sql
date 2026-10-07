-- 014_governing_law.sql (Plan 26) — apply at merge.
-- "Ley 14-2022" is not a Puerto Rico lease law and Ley 464 (1946) was repealed.
-- Puerto Rico leases are governed by the 2020 Civil Code (Ley 55-2020).

alter table public.contracts drop constraint if exists contracts_governing_law_check;

update public.contracts set governing_law = 'codigo_civil_pr_2020'
  where governing_law in ('ley_14_2022', 'ley_464');

alter table public.contracts
  add constraint contracts_governing_law_check
  check (governing_law in ('codigo_civil_pr_2020', 'us_state', 'other'));
