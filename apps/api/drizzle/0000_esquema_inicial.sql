-- Esquema inicial de StyleFi: reproduce la base que creaba la app (ensureStylehubSchema +
-- ensureAuthCriticalTables). Generado con drizzle-kit a partir de src/db/schema.ts; lo que Drizzle no
-- expresa va a mano al principio (extensiones) y al final (restricción contra citas encimadas).
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TABLE "stylehub_account_deletion_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token_salt" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stylehub_business_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_user_id" uuid NOT NULL,
	"branch_name" text NOT NULL,
	"description" text,
	"address" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"phone" text,
	"website" text,
	"image_url" text,
	"ownership_proof_url" text,
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"validation_notes" text,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"opening_hours" text,
	"closing_hours" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_business_branches_validation_status_check" CHECK (validation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "stylehub_business_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_user_id" uuid NOT NULL,
	"salon_name" text NOT NULL,
	"description" text,
	"address" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"phone" text,
	"website" text,
	"image_url" text,
	"opening_hours" text,
	"closing_hours" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_business_info_business_user_id_key" UNIQUE("business_user_id")
);
--> statement-breakpoint
CREATE TABLE "stylehub_business_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_user_id" uuid NOT NULL,
	"branch_id" uuid,
	"service_name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"duration_minutes" integer,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stylehub_business_stylists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_user_id" uuid NOT NULL,
	"branch_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"specialization" text,
	"years_experience" integer,
	"image_url" text,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stylehub_client_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_user_id" uuid NOT NULL,
	"business_user_id" uuid NOT NULL,
	"branch_id" uuid,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_method_id" uuid,
	"payment_provider" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stylist_id" uuid,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" text DEFAULT 'America/Mexico_City' NOT NULL,
	CONSTRAINT "stylehub_client_appointments_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]))
);
--> statement-breakpoint
CREATE TABLE "stylehub_client_favorite_businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_client_favorite_businesse_user_id_business_user_id_key" UNIQUE("user_id","business_user_id")
);
--> statement-breakpoint
CREATE TABLE "stylehub_client_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"card_brand" text,
	"card_last4" text,
	"holder_name" text,
	"paypal_email" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"token_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_client_payment_methods_provider_check" CHECK (provider = ANY (ARRAY['card'::text, 'transfer'::text, 'cash'::text, 'wallet'::text, 'paypal'::text]))
);
--> statement-breakpoint
CREATE TABLE "stylehub_client_wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method_id" uuid,
	"payment_provider" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"external_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"appointment_id" uuid,
	CONSTRAINT "stylehub_client_wallet_transactions_transaction_type_check" CHECK (transaction_type = ANY (ARRAY['recharge'::text, 'debit'::text, 'refund'::text])),
	CONSTRAINT "stylehub_client_wallet_transactions_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]))
);
--> statement-breakpoint
CREATE TABLE "stylehub_client_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" numeric(12, 2) DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_client_wallets_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "stylehub_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_files_kind_check" CHECK (kind = ANY (ARRAY['branch_image'::text, 'branch_proof'::text])),
	CONSTRAINT "stylehub_files_size_bytes_check" CHECK ((size_bytes > 0) AND (size_bytes <= 4194304))
);
--> statement-breakpoint
CREATE TABLE "stylehub_live_dashboard_modules" (
	"module_key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"path_prefix" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_maintenance" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stylehub_oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_oauth_accounts_provider_provider_account_id_key" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "stylehub_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"code_salt" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stylehub_password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token_salt" text NOT NULL,
	"otp_hash" text NOT NULL,
	"otp_salt" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stylehub_stylist_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stylist_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_stylist_absences_check" CHECK (starts_at < ends_at)
);
--> statement-breakpoint
CREATE TABLE "stylehub_stylist_schedule_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stylist_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "stylehub_stylist_schedule_blocks_day_of_week_check" CHECK ((day_of_week >= 0) AND (day_of_week <= 6)),
	CONSTRAINT "stylehub_stylist_schedule_blocks_check" CHECK (start_time < end_time)
);
--> statement-breakpoint
CREATE TABLE "stylehub_stylist_services" (
	"stylist_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "stylehub_stylist_services_pkey" PRIMARY KEY("stylist_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "stylehub_support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender_role" text NOT NULL,
	"sender_name" text,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_support_messages_sender_role_check" CHECK (sender_role = ANY (ARRAY['user'::text, 'oracle'::text, 'admin'::text, 'system'::text]))
);
--> statement-breakpoint
CREATE TABLE "stylehub_support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_user_id" uuid,
	"account_type" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"source_route" text,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"escalated_to_admin" boolean DEFAULT false NOT NULL,
	"escalation_reason" text,
	"oracle_summary" text,
	"oracle_confidence" numeric(4, 2),
	"assigned_admin_email" text,
	"last_message_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_support_tickets_account_type_check" CHECK (account_type = ANY (ARRAY['cliente'::text, 'negocio'::text])),
	CONSTRAINT "stylehub_support_tickets_status_check" CHECK (status = ANY (ARRAY['open'::text, 'waiting_admin'::text, 'in_progress'::text, 'escalated'::text, 'resolved'::text, 'closed'::text]))
);
--> statement-breakpoint
CREATE TABLE "stylehub_user_two_factor_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"purpose" text NOT NULL,
	"challenge_token" text,
	"code_hash" text,
	"code_salt" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_user_two_factor_challenges_method_check" CHECK (method = ANY (ARRAY['email'::text, 'authenticator'::text])),
	CONSTRAINT "stylehub_user_two_factor_challenges_purpose_check" CHECK (purpose = ANY (ARRAY['enable_email'::text, 'enable_authenticator'::text, 'verify_session'::text, 'disable'::text]))
);
--> statement-breakpoint
CREATE TABLE "stylehub_user_two_factor_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"preferred_method" text,
	"totp_secret" text,
	"reverify_interval_minutes" integer DEFAULT 180 NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylehub_user_two_factor_settings_preferred_method_check" CHECK ((preferred_method = ANY (ARRAY['email'::text, 'authenticator'::text])) OR (preferred_method IS NULL))
);
--> statement-breakpoint
CREATE TABLE "stylehub_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_type" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"business_name" text,
	"rfc" text,
	"phone" text,
	"email" text NOT NULL,
	"password_hash" text,
	"profile_image_name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"onboarding_seen" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"ban_reason" text,
	"stripe_customer_id" text,
	CONSTRAINT "stylehub_users_email_key" UNIQUE("email"),
	CONSTRAINT "stylehub_users_account_type_check" CHECK (account_type = ANY (ARRAY['cliente'::text, 'negocio'::text, 'admin'::text]))
);
--> statement-breakpoint
ALTER TABLE "stylehub_account_deletion_tokens" ADD CONSTRAINT "stylehub_account_deletion_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_business_branches" ADD CONSTRAINT "stylehub_business_branches_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_business_info" ADD CONSTRAINT "stylehub_business_info_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_business_services" ADD CONSTRAINT "stylehub_business_services_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_business_services" ADD CONSTRAINT "stylehub_business_services_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."stylehub_business_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_business_stylists" ADD CONSTRAINT "stylehub_business_stylists_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_business_stylists" ADD CONSTRAINT "stylehub_business_stylists_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."stylehub_business_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_appointments" ADD CONSTRAINT "stylehub_client_appointments_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_appointments" ADD CONSTRAINT "stylehub_client_appointments_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_appointments" ADD CONSTRAINT "stylehub_client_appointments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."stylehub_client_payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_appointments" ADD CONSTRAINT "stylehub_client_appointments_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylehub_business_stylists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_appointments" ADD CONSTRAINT "stylehub_client_appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."stylehub_business_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_appointments" ADD CONSTRAINT "stylehub_client_appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."stylehub_business_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_favorite_businesses" ADD CONSTRAINT "stylehub_client_favorite_businesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_favorite_businesses" ADD CONSTRAINT "stylehub_client_favorite_businesses_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_payment_methods" ADD CONSTRAINT "stylehub_client_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_wallet_transactions" ADD CONSTRAINT "stylehub_client_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."stylehub_client_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_wallet_transactions" ADD CONSTRAINT "stylehub_client_wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_wallet_transactions" ADD CONSTRAINT "stylehub_client_wallet_transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."stylehub_client_payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_wallet_transactions" ADD CONSTRAINT "stylehub_client_wallet_transactions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."stylehub_client_appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_client_wallets" ADD CONSTRAINT "stylehub_client_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_files" ADD CONSTRAINT "stylehub_files_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_oauth_accounts" ADD CONSTRAINT "stylehub_oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_otps" ADD CONSTRAINT "stylehub_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_password_resets" ADD CONSTRAINT "stylehub_password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_stylist_absences" ADD CONSTRAINT "stylehub_stylist_absences_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylehub_business_stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_stylist_schedule_blocks" ADD CONSTRAINT "stylehub_stylist_schedule_blocks_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylehub_business_stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_stylist_services" ADD CONSTRAINT "stylehub_stylist_services_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylehub_business_stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_stylist_services" ADD CONSTRAINT "stylehub_stylist_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."stylehub_business_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_support_messages" ADD CONSTRAINT "stylehub_support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."stylehub_support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_support_tickets" ADD CONSTRAINT "stylehub_support_tickets_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_user_two_factor_challenges" ADD CONSTRAINT "stylehub_user_two_factor_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylehub_user_two_factor_settings" ADD CONSTRAINT "stylehub_user_two_factor_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."stylehub_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stylehub_account_deletion_tokens_created_at" ON "stylehub_account_deletion_tokens" USING btree ("created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_account_deletion_tokens_user_id" ON "stylehub_account_deletion_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_business_branches_business_user_id" ON "stylehub_business_branches" USING btree ("business_user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_business_branches_validation_status" ON "stylehub_business_branches" USING btree ("validation_status");--> statement-breakpoint
CREATE INDEX "idx_stylehub_business_info_business_user_id" ON "stylehub_business_info" USING btree ("business_user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_business_services_branch_id" ON "stylehub_business_services" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_business_services_business_user_id" ON "stylehub_business_services" USING btree ("business_user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_business_stylists_branch_id" ON "stylehub_business_stylists" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_business_stylists_business_user_id" ON "stylehub_business_stylists" USING btree ("business_user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_appointments_branch_id" ON "stylehub_client_appointments" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_appointments_business_user_id" ON "stylehub_client_appointments" USING btree ("business_user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_appointments_client_user_id" ON "stylehub_client_appointments" USING btree ("client_user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_appointments_scheduled_at" ON "stylehub_client_appointments" USING btree ("scheduled_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_appointments_service_id" ON "stylehub_client_appointments" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_appointments_stylist" ON "stylehub_client_appointments" USING btree ("stylist_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_favorites_business_user_id" ON "stylehub_client_favorite_businesses" USING btree ("business_user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_favorites_user_id" ON "stylehub_client_favorite_businesses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_payment_methods_user_id" ON "stylehub_client_payment_methods" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stylehub_payment_methods_user_token" ON "stylehub_client_payment_methods" USING btree ("user_id","token_reference") WHERE (token_reference IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stylehub_wallet_tx_external_reference" ON "stylehub_client_wallet_transactions" USING btree ("external_reference") WHERE (external_reference IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stylehub_wallet_tx_one_refund_per_appointment" ON "stylehub_client_wallet_transactions" USING btree ("appointment_id") WHERE ((transaction_type = 'refund'::text) AND (appointment_id IS NOT NULL));--> statement-breakpoint
CREATE INDEX "idx_stylehub_wallet_tx_user_id" ON "stylehub_client_wallet_transactions" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_client_wallets_user_id" ON "stylehub_client_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_files_owner" ON "stylehub_files" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_live_dashboard_modules_enabled_order" ON "stylehub_live_dashboard_modules" USING btree ("is_enabled","display_order");--> statement-breakpoint
CREATE INDEX "idx_stylehub_live_dashboard_modules_path_prefix" ON "stylehub_live_dashboard_modules" USING btree ("path_prefix");--> statement-breakpoint
CREATE INDEX "idx_stylehub_oauth_accounts_provider" ON "stylehub_oauth_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_stylehub_oauth_accounts_user_id" ON "stylehub_oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_otps_created_at" ON "stylehub_otps" USING btree ("created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_otps_user_id" ON "stylehub_otps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_password_resets_created_at" ON "stylehub_password_resets" USING btree ("created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_password_resets_user_id" ON "stylehub_password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stylehub_stylist_absences_stylist" ON "stylehub_stylist_absences" USING btree ("stylist_id","starts_at");--> statement-breakpoint
CREATE INDEX "idx_stylehub_schedule_blocks_stylist" ON "stylehub_stylist_schedule_blocks" USING btree ("stylist_id","day_of_week");--> statement-breakpoint
CREATE INDEX "idx_stylehub_support_messages_ticket_created" ON "stylehub_support_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_stylehub_support_tickets_requester" ON "stylehub_support_tickets" USING btree ("requester_user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_support_tickets_status_updated" ON "stylehub_support_tickets" USING btree ("status","updated_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_two_factor_challenges_expires" ON "stylehub_user_two_factor_challenges" USING btree ("expires_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_two_factor_challenges_user" ON "stylehub_user_two_factor_challenges" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_stylehub_users_is_banned" ON "stylehub_users" USING btree ("is_banned");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stylehub_users_stripe_customer_id" ON "stylehub_users" USING btree ("stripe_customer_id") WHERE (stripe_customer_id IS NOT NULL);
--> statement-breakpoint
-- Un estilista no puede tener dos citas activas que se encimen (la usa el motor de reservas).
ALTER TABLE "stylehub_client_appointments" ADD CONSTRAINT "stylehub_appointments_no_overlap"
  EXCLUDE USING gist (stylist_id WITH =, tstzrange(scheduled_at, ends_at, '[)') WITH &&)
  WHERE (stylist_id IS NOT NULL AND status <> 'cancelled');
