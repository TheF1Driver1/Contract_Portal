-- Plan 31: application-layer encryption of tenant PII.
-- License/ID numbers are stored encrypted in place ("enc:v1:…", text column).
-- Dates of birth move to a text column because `date_of_birth` is a `date`;
-- the app writes the ciphertext here and leaves `date_of_birth` null.
-- The key lives only on the server (FIELD_ENCRYPTION_KEY); see lib/crypto/fields.ts.
alter table public.tenants add column if not exists date_of_birth_enc text;
alter table public.contract_occupants add column if not exists date_of_birth_enc text;

comment on column public.tenants.date_of_birth_enc is 'AES-256-GCM ciphertext of the date of birth (enc:v1:…); decrypted by the app server only.';
comment on column public.contract_occupants.date_of_birth_enc is 'AES-256-GCM ciphertext of the date of birth (enc:v1:…); decrypted by the app server only.';
comment on column public.tenants.license_number is 'License/ID number; encrypted by the app (enc:v1:…) once FIELD_ENCRYPTION_KEY is set.';
