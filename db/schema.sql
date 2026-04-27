CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stylehub_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type TEXT NOT NULL CHECK (account_type IN ('cliente', 'negocio')),
  first_name TEXT,
  last_name TEXT,
  business_name TEXT,
  rfc TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  profile_image_name TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  banned_at TIMESTAMPTZ,
  ban_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stylehub_users_is_banned ON stylehub_users(is_banned);

CREATE TABLE IF NOT EXISTS stylehub_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stylehub_otps_user_id ON stylehub_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_stylehub_otps_created_at ON stylehub_otps(created_at DESC);

CREATE TABLE IF NOT EXISTS stylehub_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_salt TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_salt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stylehub_password_resets_user_id ON stylehub_password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_stylehub_password_resets_created_at ON stylehub_password_resets(created_at DESC);

CREATE TABLE IF NOT EXISTS stylehub_live_dashboard_modules (
  module_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  path_prefix TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stylehub_live_dashboard_modules_enabled_order
ON stylehub_live_dashboard_modules(is_enabled, display_order);

CREATE INDEX IF NOT EXISTS idx_stylehub_live_dashboard_modules_path_prefix
ON stylehub_live_dashboard_modules(path_prefix);

CREATE TABLE IF NOT EXISTS stylehub_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID REFERENCES stylehub_users(id) ON DELETE SET NULL,
  account_type TEXT CHECK (account_type IN ('cliente', 'negocio')),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  source_route TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_admin', 'in_progress', 'escalated', 'resolved', 'closed')),
  escalated_to_admin BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_reason TEXT,
  oracle_summary TEXT,
  oracle_confidence NUMERIC(4, 2),
  assigned_admin_email TEXT,
  last_message_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stylehub_support_tickets_status_updated
ON stylehub_support_tickets(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_stylehub_support_tickets_requester
ON stylehub_support_tickets(requester_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stylehub_support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES stylehub_support_tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'oracle', 'admin', 'system')),
  sender_name TEXT,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stylehub_support_messages_ticket_created
ON stylehub_support_messages(ticket_id, created_at ASC);
