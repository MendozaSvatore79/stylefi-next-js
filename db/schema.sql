CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- account_type 'admin': cuentas de administración, creadas con `npm run crear-admin`.

CREATE TABLE IF NOT EXISTS stylehub_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type TEXT NOT NULL CHECK (account_type IN ('cliente', 'negocio', 'admin')),
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

CREATE TABLE IF NOT EXISTS stylehub_user_two_factor_settings (
  user_id UUID PRIMARY KEY REFERENCES stylehub_users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_method TEXT CHECK (preferred_method IN ('email', 'authenticator')),
  totp_secret TEXT,
  reverify_interval_minutes INTEGER NOT NULL DEFAULT 180,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stylehub_user_two_factor_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('email', 'authenticator')),
  purpose TEXT NOT NULL CHECK (purpose IN ('enable_email', 'enable_authenticator', 'verify_session', 'disable')),
  challenge_token TEXT,
  code_hash TEXT,
  code_salt TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stylehub_two_factor_challenges_user
ON stylehub_user_two_factor_challenges(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stylehub_two_factor_challenges_expires
ON stylehub_user_two_factor_challenges(expires_at DESC);

-- Archivos subidos (lib/storage.ts): comprobantes privados e imágenes públicas, hasta 4 MB.
-- Se sirven desde /api/files/[id]; nunca desde public/.
CREATE TABLE IF NOT EXISTS stylehub_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('branch_image', 'branch_proof')),
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 4194304),
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stylehub_files_owner ON stylehub_files(owner_user_id);

-- Motor de citas (lib/availability.ts y lib/booking.ts). En una base existente estas tablas y
-- columnas las crea ensureStylehubSchema(); aquí quedan como referencia.
CREATE TABLE IF NOT EXISTS stylehub_stylist_services (
  stylist_id UUID NOT NULL REFERENCES stylehub_business_stylists(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES stylehub_business_services(id) ON DELETE CASCADE,
  PRIMARY KEY (stylist_id, service_id)
);

-- day_of_week: 0 = lunes … 6 = domingo; el descanso es el hueco entre bloques del mismo día
CREATE TABLE IF NOT EXISTS stylehub_stylist_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id UUID NOT NULL REFERENCES stylehub_business_stylists(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS stylehub_stylist_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id UUID NOT NULL REFERENCES stylehub_business_stylists(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (starts_at < ends_at)
);

-- Citas: stylist_id UUID REFERENCES stylehub_business_stylists(id) ON DELETE RESTRICT,
--        ends_at TIMESTAMPTZ NOT NULL, time_zone TEXT NOT NULL DEFAULT 'America/Mexico_City',
--        status también acepta 'no_show', y la restricción stylehub_appointments_no_overlap
--        (btree_gist) impide citas encimadas del mismo estilista salvo las canceladas.
