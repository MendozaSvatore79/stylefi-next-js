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
          account_type TEXT NOT NULL CHECK (account_type IN ('cliente', 'negocio')),
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
        CREATE TABLE IF NOT EXISTS stylehub_client_appointments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE CASCADE,
          business_user_id UUID NOT NULL REFERENCES stylehub_users(id) ON DELETE RESTRICT,
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
