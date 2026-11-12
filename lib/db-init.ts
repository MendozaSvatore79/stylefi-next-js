import { getDb } from "@/lib/db";

let schemaInitPromise: Promise<void> | null = null;

export function ensureStylehubSchema() {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const db = getDb();

      await db`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          account_type TEXT NOT NULL CHECK (account_type IN ('cliente', 'negocio', 'admin')),
          first_name TEXT,
          last_name TEXT,
          business_name TEXT,
          rfc TEXT,
          phone TEXT,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          profile_image_name TEXT,
          email_verified BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          verified_at TIMESTAMPTZ
        );
      `;

      await db`
        ALTER TABLE stylehub_users
        ALTER COLUMN phone DROP NOT NULL,
        ALTER COLUMN password_hash DROP NOT NULL;
      `;

      await db`
        ALTER TABLE stylehub_users
        ADD COLUMN IF NOT EXISTS onboarding_seen BOOLEAN NOT NULL DEFAULT FALSE;
      `;

      // Cuentas de administración (npm run crear-admin). En bases creadas antes, la restricción
      // solo aceptaba cliente y negocio: se reemplaza una sola vez por la que también acepta admin
      // (condicional, para no quitarla y volver a ponerla en cada arranque).
      await db`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'stylehub_users_account_type_check'
              AND pg_get_constraintdef(oid) LIKE '%admin%'
          ) THEN
            ALTER TABLE stylehub_users DROP CONSTRAINT IF EXISTS stylehub_users_account_type_check;
            ALTER TABLE stylehub_users ADD CONSTRAINT stylehub_users_account_type_check
              CHECK (account_type IN ('cliente', 'negocio', 'admin'));
          END IF;
        END $$;
      `;

      await db`
        ALTER TABLE stylehub_users
        ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS ban_reason TEXT;
      `;

      await db`
        ALTER TABLE stylehub_users
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
      `;

      await db`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_stylehub_users_stripe_customer_id
        ON stylehub_users(stripe_customer_id)
        WHERE stripe_customer_id IS NOT NULL;
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_users_is_banned
        ON stylehub_users(is_banned);
      `;

      await db`
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
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_otps_user_id ON stylehub_otps(user_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_otps_created_at ON stylehub_otps(created_at DESC);
      `;

      await db`
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
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_password_resets_user_id ON stylehub_password_resets(user_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_password_resets_created_at ON stylehub_password_resets(created_at DESC);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_account_deletion_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL,
          token_salt TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_account_deletion_tokens_user_id
        ON stylehub_account_deletion_tokens(user_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_account_deletion_tokens_created_at
        ON stylehub_account_deletion_tokens(created_at DESC);
      `;

      await db`
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
      `;

      await db`
        ALTER TABLE stylehub_user_two_factor_settings
        ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS preferred_method TEXT,
        ADD COLUMN IF NOT EXISTS totp_secret TEXT,
        ADD COLUMN IF NOT EXISTS reverify_interval_minutes INTEGER NOT NULL DEFAULT 180,
        ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      `;

      await db`
        ALTER TABLE stylehub_user_two_factor_settings
        DROP CONSTRAINT IF EXISTS stylehub_user_two_factor_settings_preferred_method_check;
      `;

      await db`
        ALTER TABLE stylehub_user_two_factor_settings
        ADD CONSTRAINT stylehub_user_two_factor_settings_preferred_method_check
        CHECK (preferred_method IN ('email', 'authenticator') OR preferred_method IS NULL);
      `;

      await db`
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
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_two_factor_challenges_user
        ON stylehub_user_two_factor_challenges(user_id, created_at DESC);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_two_factor_challenges_expires
        ON stylehub_user_two_factor_challenges(expires_at DESC);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_oauth_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          provider_account_id TEXT NOT NULL,
          access_token TEXT,
          refresh_token TEXT,
          expires_at INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(provider, provider_account_id)
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_oauth_accounts_user_id ON stylehub_oauth_accounts(user_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_oauth_accounts_provider ON stylehub_oauth_accounts(provider);
      `;

      await db`
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
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_support_tickets_status_updated
        ON stylehub_support_tickets(status, updated_at DESC);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_support_tickets_requester
        ON stylehub_support_tickets(requester_user_id, created_at DESC);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_support_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_id UUID NOT NULL REFERENCES stylehub_support_tickets(id) ON DELETE CASCADE,
          sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'oracle', 'admin', 'system')),
          sender_name TEXT,
          message TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_support_messages_ticket_created
        ON stylehub_support_messages(ticket_id, created_at ASC);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_client_payment_methods (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL CHECK (provider IN ('card', 'transfer', 'cash', 'wallet', 'paypal')),
          card_brand TEXT,
          card_last4 TEXT,
          holder_name TEXT,
          paypal_email TEXT,
          is_default BOOLEAN NOT NULL DEFAULT FALSE,
          token_reference TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        ALTER TABLE stylehub_client_payment_methods
        ADD COLUMN IF NOT EXISTS paypal_email TEXT;
      `;

      await db`
        ALTER TABLE stylehub_client_payment_methods
        DROP CONSTRAINT IF EXISTS stylehub_client_payment_methods_provider_check;
      `;

      await db`
        ALTER TABLE stylehub_client_payment_methods
        ADD CONSTRAINT stylehub_client_payment_methods_provider_check
        CHECK (provider IN ('card', 'transfer', 'cash', 'wallet', 'paypal'));
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_payment_methods_user_id
        ON stylehub_client_payment_methods(user_id);
      `;

      await db`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_stylehub_payment_methods_user_token
        ON stylehub_client_payment_methods(user_id, token_reference)
        WHERE token_reference IS NOT NULL;
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_client_wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE REFERENCES stylehub_users(id) ON DELETE CASCADE,
          balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'MXN',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_wallets_user_id
        ON stylehub_client_wallets(user_id);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_client_wallet_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          wallet_id UUID NOT NULL REFERENCES stylehub_client_wallets(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          transaction_type TEXT NOT NULL CHECK (transaction_type IN ('recharge', 'debit', 'refund')),
          amount NUMERIC(12, 2) NOT NULL,
          payment_method_id UUID REFERENCES stylehub_client_payment_methods(id) ON DELETE SET NULL,
          payment_provider TEXT,
          status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
          external_reference TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        ALTER TABLE stylehub_client_wallet_transactions
        ADD COLUMN IF NOT EXISTS payment_provider TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
        ADD COLUMN IF NOT EXISTS external_reference TEXT;
      `;

      await db`
        ALTER TABLE stylehub_client_wallet_transactions
        DROP CONSTRAINT IF EXISTS stylehub_client_wallet_transactions_status_check;
      `;

      await db`
        ALTER TABLE stylehub_client_wallet_transactions
        ADD CONSTRAINT stylehub_client_wallet_transactions_status_check
        CHECK (status IN ('pending', 'completed', 'failed'));
      `;

      await db`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_stylehub_wallet_tx_external_reference
        ON stylehub_client_wallet_transactions(external_reference)
        WHERE external_reference IS NOT NULL;
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_wallet_tx_user_id
        ON stylehub_client_wallet_transactions(user_id, created_at DESC);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_business_info (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_user_id UUID NOT NULL UNIQUE REFERENCES stylehub_users(id) ON DELETE CASCADE,
          salon_name TEXT NOT NULL,
          description TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          postal_code TEXT,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          phone TEXT,
          website TEXT,
          image_url TEXT,
          opening_hours TEXT,
          closing_hours TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_business_info_business_user_id
        ON stylehub_business_info(business_user_id);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_business_branches (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          branch_name TEXT NOT NULL,
          description TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          postal_code TEXT,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          phone TEXT,
          website TEXT,
          image_url TEXT,
          ownership_proof_url TEXT,
          validation_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (validation_status IN ('pending', 'approved', 'rejected')),
          validation_notes TEXT,
          verified_at TIMESTAMPTZ,
          verified_by TEXT,
          opening_hours TEXT,
          closing_hours TEXT,
          is_primary BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_business_branches_business_user_id
        ON stylehub_business_branches(business_user_id);
      `;

      await db`
        ALTER TABLE stylehub_business_branches
        ADD COLUMN IF NOT EXISTS ownership_proof_url TEXT,
        ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS validation_notes TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS verified_by TEXT;
      `;

      await db`
        ALTER TABLE stylehub_business_branches
        DROP CONSTRAINT IF EXISTS stylehub_business_branches_validation_status_check;
      `;

      await db`
        ALTER TABLE stylehub_business_branches
        ADD CONSTRAINT stylehub_business_branches_validation_status_check
        CHECK (validation_status IN ('pending', 'approved', 'rejected'));
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_business_branches_validation_status
        ON stylehub_business_branches(validation_status);
      `;

      await db`
        ALTER TABLE stylehub_business_info
        ALTER COLUMN latitude TYPE DECIMAL(10, 8) USING latitude::DECIMAL(10, 8),
        ALTER COLUMN longitude TYPE DECIMAL(11, 8) USING longitude::DECIMAL(11, 8);
      `;

      await db`
        ALTER TABLE stylehub_business_branches
        ALTER COLUMN latitude TYPE DECIMAL(10, 8) USING latitude::DECIMAL(10, 8),
        ALTER COLUMN longitude TYPE DECIMAL(11, 8) USING longitude::DECIMAL(11, 8);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_business_services (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          branch_id UUID REFERENCES stylehub_business_branches(id) ON DELETE SET NULL,
          service_name TEXT NOT NULL,
          description TEXT,
          price NUMERIC(10, 2) NOT NULL,
          duration_minutes INTEGER,
          image_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_business_services_business_user_id
        ON stylehub_business_services(business_user_id);
      `;

      await db`
        ALTER TABLE stylehub_business_services
        ADD COLUMN IF NOT EXISTS branch_id UUID;
      `;

      await db`
        ALTER TABLE stylehub_business_services
        DROP CONSTRAINT IF EXISTS stylehub_business_services_branch_id_fkey;
      `;

      await db`
        ALTER TABLE stylehub_business_services
        ADD CONSTRAINT stylehub_business_services_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES stylehub_business_branches(id) ON DELETE SET NULL;
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_business_services_branch_id
        ON stylehub_business_services(branch_id);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_business_stylists (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          branch_id UUID REFERENCES stylehub_business_branches(id) ON DELETE SET NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          specialization TEXT,
          years_experience INTEGER,
          image_url TEXT,
          available BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_business_stylists_business_user_id
        ON stylehub_business_stylists(business_user_id);
      `;

      await db`
        ALTER TABLE stylehub_business_stylists
        ADD COLUMN IF NOT EXISTS branch_id UUID;
      `;

      await db`
        ALTER TABLE stylehub_business_stylists
        DROP CONSTRAINT IF EXISTS stylehub_business_stylists_branch_id_fkey;
      `;

      await db`
        ALTER TABLE stylehub_business_stylists
        ADD CONSTRAINT stylehub_business_stylists_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES stylehub_business_branches(id) ON DELETE SET NULL;
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_business_stylists_branch_id
        ON stylehub_business_stylists(branch_id);
      `;

      await db`
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
      `;

      await db`
        ALTER TABLE stylehub_live_dashboard_modules
        ADD COLUMN IF NOT EXISTS path_prefix TEXT,
        ADD COLUMN IF NOT EXISTS is_maintenance BOOLEAN NOT NULL DEFAULT FALSE;
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_live_dashboard_modules_enabled_order
        ON stylehub_live_dashboard_modules(is_enabled, display_order);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_live_dashboard_modules_path_prefix
        ON stylehub_live_dashboard_modules(path_prefix);
      `;

      // Citas: van después de sucursales, servicios y estilistas porque hacen referencia a ellas.
      // Antes se creaban primero y una base vacía fallaba (42P01); ver tests/esquema-orden.test.ts.
      await db`
        CREATE TABLE IF NOT EXISTS stylehub_client_appointments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          business_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE RESTRICT,
          branch_id UUID REFERENCES stylehub_business_branches(id) ON DELETE SET NULL,
          service_id UUID,
          service_name TEXT NOT NULL,
          scheduled_at TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
          total_amount NUMERIC(10, 2) NOT NULL,
          payment_method_id UUID REFERENCES stylehub_client_payment_methods(id) ON DELETE SET NULL,
          payment_provider TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        ALTER TABLE stylehub_client_appointments
        ADD COLUMN IF NOT EXISTS payment_provider TEXT;
      `;

      await db`
        ALTER TABLE stylehub_client_appointments
        ADD COLUMN IF NOT EXISTS branch_id UUID;
      `;

      await db`
        ALTER TABLE stylehub_client_appointments
        ADD COLUMN IF NOT EXISTS service_id UUID;
      `;

      await db`
        ALTER TABLE stylehub_client_appointments
        DROP CONSTRAINT IF EXISTS stylehub_client_appointments_branch_id_fkey;
      `;

      await db`
        ALTER TABLE stylehub_client_appointments
        DROP CONSTRAINT IF EXISTS stylehub_client_appointments_service_id_fkey;
      `;

      await db`
        ALTER TABLE stylehub_client_appointments
        ADD CONSTRAINT stylehub_client_appointments_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES stylehub_business_branches(id) ON DELETE SET NULL;
      `;

      await db`
        ALTER TABLE stylehub_client_appointments
        ADD CONSTRAINT stylehub_client_appointments_service_id_fkey
        FOREIGN KEY (service_id) REFERENCES stylehub_business_services(id) ON DELETE SET NULL;
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_appointments_branch_id
        ON stylehub_client_appointments(branch_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_appointments_service_id
        ON stylehub_client_appointments(service_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_appointments_client_user_id
        ON stylehub_client_appointments(client_user_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_appointments_business_user_id
        ON stylehub_client_appointments(business_user_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_appointments_scheduled_at
        ON stylehub_client_appointments(scheduled_at DESC);
      `;

      // --- Motor de citas (cambio 4): servicios por estilista, horario semanal, ausencias, y citas con
      // estilista, hora de fin y zona horaria. Ver lib/availability.ts y lib/booking.ts.
      await db`
        CREATE TABLE IF NOT EXISTS stylehub_stylist_services (
          stylist_id UUID NOT NULL REFERENCES stylehub_business_stylists(id) ON DELETE CASCADE,
          service_id UUID NOT NULL REFERENCES stylehub_business_services(id) ON DELETE CASCADE,
          PRIMARY KEY (stylist_id, service_id)
        );
      `;

      // day_of_week: 0 = lunes … 6 = domingo. El descanso es el hueco entre dos bloques del mismo día.
      await db`
        CREATE TABLE IF NOT EXISTS stylehub_stylist_schedule_blocks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          stylist_id UUID NOT NULL REFERENCES stylehub_business_stylists(id) ON DELETE CASCADE,
          day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          CHECK (start_time < end_time)
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_schedule_blocks_stylist
        ON stylehub_stylist_schedule_blocks(stylist_id, day_of_week);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_stylist_absences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          stylist_id UUID NOT NULL REFERENCES stylehub_business_stylists(id) ON DELETE CASCADE,
          starts_at TIMESTAMPTZ NOT NULL,
          ends_at TIMESTAMPTZ NOT NULL,
          reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (starts_at < ends_at)
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_stylist_absences_stylist
        ON stylehub_stylist_absences(stylist_id, starts_at);
      `;

      // Citas: estilista (RESTRICT: un estilista con citas no se borra), fin y zona horaria del negocio
      await db`
        ALTER TABLE stylehub_client_appointments
        ADD COLUMN IF NOT EXISTS stylist_id UUID REFERENCES stylehub_business_stylists(id) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'America/Mexico_City';
      `;

      // Citas anteriores: fin = inicio + duración del servicio (30 min si no tiene)
      await db`
        UPDATE stylehub_client_appointments a
        SET ends_at = a.scheduled_at + make_interval(mins => COALESCE(s.duration_minutes, 30))
        FROM (SELECT a2.id, sv.duration_minutes
              FROM stylehub_client_appointments a2
              LEFT JOIN stylehub_business_services sv ON sv.id = a2.service_id
              WHERE a2.ends_at IS NULL) s
        WHERE a.id = s.id;
      `;

      await db`
        ALTER TABLE stylehub_client_appointments
        ALTER COLUMN ends_at SET NOT NULL;
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_appointments_stylist
        ON stylehub_client_appointments(stylist_id, scheduled_at);
      `;

      // Estado "no asistió" (se reemplaza la restricción una sola vez)
      await db`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'stylehub_client_appointments_status_check'
              AND pg_get_constraintdef(oid) LIKE '%no_show%'
          ) THEN
            ALTER TABLE stylehub_client_appointments DROP CONSTRAINT IF EXISTS stylehub_client_appointments_status_check;
            ALTER TABLE stylehub_client_appointments ADD CONSTRAINT stylehub_client_appointments_status_check
              CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));
          END IF;
        END $$;
      `;

      // Sin citas encimadas del mismo estilista (todas menos las canceladas), en la propia base.
      // Es la segunda capa; la primera es el bloqueo dentro de la transacción (lib/booking.ts).
      // Si la extensión btree_gist no estuviera disponible, la app sigue arrancando con la primera capa.
      await db`
        DO $$
        BEGIN
          CREATE EXTENSION IF NOT EXISTS btree_gist;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stylehub_appointments_no_overlap') THEN
            ALTER TABLE stylehub_client_appointments ADD CONSTRAINT stylehub_appointments_no_overlap
              EXCLUDE USING gist (stylist_id WITH =, tstzrange(scheduled_at, ends_at, '[)') WITH &&)
              WHERE (stylist_id IS NOT NULL AND status <> 'cancelled');
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'No se pudo crear stylehub_appointments_no_overlap: %', SQLERRM;
        END $$;
      `;

      // Movimientos del monedero ligados a su cita; una cita se reembolsa una sola vez
      await db`
        ALTER TABLE stylehub_client_wallet_transactions
        ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES stylehub_client_appointments(id) ON DELETE SET NULL;
      `;

      await db`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_stylehub_wallet_tx_one_refund_per_appointment
        ON stylehub_client_wallet_transactions(appointment_id)
        WHERE transaction_type = 'refund' AND appointment_id IS NOT NULL;
      `;

      // Archivos subidos (lib/storage.ts): comprobantes privados e imágenes públicas, hasta 4 MB
      await db`
        CREATE TABLE IF NOT EXISTS stylehub_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('branch_image', 'branch_proof')),
          content_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 4194304),
          data BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_files_owner ON stylehub_files(owner_user_id);
      `;

      await db`
        CREATE TABLE IF NOT EXISTS stylehub_client_favorite_businesses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          business_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, business_user_id)
        );
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_favorites_user_id
        ON stylehub_client_favorite_businesses(user_id);
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_stylehub_client_favorites_business_user_id
        ON stylehub_client_favorite_businesses(business_user_id);
      `;
    })().catch((error) => {
      schemaInitPromise = null;
      throw error;
    });
  }

  return schemaInitPromise;
}
