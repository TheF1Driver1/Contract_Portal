-- =============================================
-- Contract Portal - Supabase Schema
-- Run this in the Supabase SQL editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES (extends Supabase auth.users)
-- =============================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  phone text,
  email text not null,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================
-- PROPERTIES
-- =============================================
create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  state text not null default 'PR',
  zip text,
  unit_count integer not null default 1,
  created_at timestamptz default now()
);

-- =============================================
-- TENANTS
-- =============================================
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  ssn_last4 text,
  license_number text,
  current_address text,
  created_at timestamptz default now()
);

-- =============================================
-- CONTRACTS
-- =============================================
create type contract_status as enum ('draft', 'sent', 'signed', 'expired');
create type contract_type as enum ('lease', 'rental', 'addendum');

create table if not exists contracts (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  property_id uuid not null references properties(id) on delete restrict,
  tenant_id uuid not null references tenants(id) on delete restrict,
  contract_type contract_type not null default 'lease',
  status contract_status not null default 'draft',

  -- Unit
  unit_number text,

  -- Lease dates
  lease_start date not null,
  lease_end date not null,
  lease_months integer not null,

  -- Payment
  rent_amount numeric(10,2) not null,
  rent_amount_verbal text,
  security_deposit numeric(10,2) not null default 0,
  payment_due_day integer not null default 1,
  late_fee_day integer not null default 5,

  -- Occupants
  occupant_names text[] default '{}',
  occupant_count integer not null default 1,

  -- Amenities stored as JSONB
  amenities jsonb default '{}',

  -- Keys
  key_count integer not null default 2,

  -- Signatures (base64 PNG data URLs)
  landlord_signature text,
  tenant_signature text,
  signed_at timestamptz,

  -- Document URLs (Supabase Storage)
  docx_url text,
  pdf_url text,

  -- Delivery tracking
  sent_at timestamptz,
  opened_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contracts_updated_at
  before update on contracts
  for each row execute procedure update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table profiles enable row level security;
alter table properties enable row level security;
alter table tenants enable row level security;
alter table contracts enable row level security;

-- Profiles: users see own profile only
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Properties: owners see their own
create policy "properties_all_own" on properties
  for all using (auth.uid() = owner_id);

-- Tenants: owners see their own
create policy "tenants_all_own" on tenants
  for all using (auth.uid() = owner_id);

-- Contracts: owners see their own
create policy "contracts_all_own" on contracts
  for all using (auth.uid() = owner_id);

-- =============================================
-- INDEXES
-- =============================================
create index if not exists contracts_owner_id_idx on contracts(owner_id);
create index if not exists contracts_status_idx on contracts(status);
create index if not exists contracts_lease_end_idx on contracts(lease_end);
create index if not exists properties_owner_id_idx on properties(owner_id);
create index if not exists tenants_owner_id_idx on tenants(owner_id);

-- =============================================
-- CONTRACT ATTACHMENTS
-- =============================================
create table if not exists contract_attachments (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references contracts(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  storage_path text not null,
  file_size integer,
  created_at timestamptz default now()
);

alter table contract_attachments enable row level security;

create policy "attachments_all_own" on contract_attachments
  for all using (auth.uid() = owner_id);

create index if not exists contract_attachments_contract_id_idx on contract_attachments(contract_id);

-- =============================================
-- CONTRACT CUSTOM SECTIONS (user-written clauses)
-- Named contract_custom_sections to avoid conflict
-- with existing contract_sections (section_code/enabled) table
-- =============================================
create table if not exists contract_custom_sections (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references contracts(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  order_index integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table contract_sections enable row level security;

create policy "custom_sections_all_own" on contract_custom_sections
  for all using (auth.uid() = owner_id);

create trigger contract_custom_sections_updated_at
  before update on contract_custom_sections
  for each row execute procedure update_updated_at();

create index if not exists contract_custom_sections_contract_id_idx on contract_custom_sections(contract_id);

-- =============================================
-- USER SECTION TEMPLATES
-- =============================================
create table if not exists user_section_templates (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_section_templates enable row level security;

create policy "section_templates_all_own" on user_section_templates
  for all using (auth.uid() = owner_id);

create trigger user_section_templates_updated_at
  before update on user_section_templates
  for each row execute procedure update_updated_at();

create index if not exists user_section_templates_owner_id_idx on user_section_templates(owner_id);

-- =============================================
-- STORAGE BUCKETS (run in dashboard or via API)
-- =============================================
-- Create bucket "contracts" with public=false
-- insert into storage.buckets (id, name, public)
-- values ('contracts', 'contracts', false);
