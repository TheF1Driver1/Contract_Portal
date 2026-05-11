-- ── Backfill missing contract columns ─────────────────────────────────────────
-- (referenced in types.ts and RenewalModal.tsx but missing from DB)
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS parent_contract_id     uuid REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_renewal             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppress_notifications boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS contracts_parent_contract_idx ON contracts(parent_contract_id);

-- ── Per-user notification schedule ────────────────────────────────────────────
-- Each row = one trigger (e.g. "send SMS + email 30 days before expiry")
CREATE TABLE notification_triggers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  days_before integer     NOT NULL CHECK (days_before > 0 AND days_before <= 365),
  send_sms    boolean     NOT NULL DEFAULT true,
  send_email  boolean     NOT NULL DEFAULT true,
  label       text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, days_before)
);

ALTER TABLE notification_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_triggers_owner_only" ON notification_triggers
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX notification_triggers_owner_active_idx
  ON notification_triggers(owner_id) WHERE is_active = true;

-- ── Notification send log ──────────────────────────────────────────────────────
-- Tracks every attempted notification per (contract × trigger × channel).
-- Used for deduplication: cron skips if status='sent' row already exists.
-- Allows retry after 'failed' rows.
CREATE TABLE contract_notification_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   uuid        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  owner_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trigger_id    uuid        REFERENCES notification_triggers(id) ON DELETE SET NULL,
  days_before   integer     NOT NULL,
  channel       text        NOT NULL CHECK (channel IN ('sms', 'email')),
  status        text        NOT NULL CHECK (status IN ('sent', 'failed', 'suppressed')),
  error_message text,
  sent_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contract_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_notification_logs_owner_only" ON contract_notification_logs
  FOR ALL USING (auth.uid() = owner_id);

-- Composite index for the cron dedup check
CREATE INDEX notif_log_lookup_idx
  ON contract_notification_logs(contract_id, trigger_id, channel, status);

CREATE INDEX notif_log_owner_idx
  ON contract_notification_logs(owner_id, sent_at DESC);
