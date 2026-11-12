// Esquema de la base de StyleFi. Generado con `drizzle-kit pull` sobre la base que creaba la app
// (ensureStylehubSchema + ensureAuthCriticalTables) y revisado a mano. Lo que Drizzle no expresa
// (extensiones y la restricción EXCLUDE contra citas encimadas) está en drizzle/0000_esquema_inicial.sql.
// Cualquier cambio de esquema: edita este archivo y corre `npm run db:generar -w @stylefi/api`.
import { pgTable, index, foreignKey, check, uuid, text, integer, jsonb, timestamp, uniqueIndex, unique, boolean, numeric, smallint, time, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { customType } from "drizzle-orm/pg-core"

/** bytea (archivos guardados en la base): Drizzle no trae este tipo. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" })



export const stylehubUserTwoFactorChallenges = pgTable("stylehub_user_two_factor_challenges", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	method: text().notNull(),
	purpose: text().notNull(),
	challengeToken: text("challenge_token"),
	codeHash: text("code_hash"),
	codeSalt: text("code_salt"),
	attempts: integer().default(0).notNull(),
	metadata: jsonb().default({}).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_two_factor_challenges_expires").using("btree", table.expiresAt.desc().nullsFirst()),
	index("idx_stylehub_two_factor_challenges_user").using("btree", table.userId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_user_two_factor_challenges_user_id_fkey"
		}).onDelete("cascade"),
	check("stylehub_user_two_factor_challenges_method_check", sql`method = ANY (ARRAY['email'::text, 'authenticator'::text])`),
	check("stylehub_user_two_factor_challenges_purpose_check", sql`purpose = ANY (ARRAY['enable_email'::text, 'enable_authenticator'::text, 'verify_session'::text, 'disable'::text])`),
]);

export const stylehubUsers = pgTable("stylehub_users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	accountType: text("account_type").notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	businessName: text("business_name"),
	rfc: text(),
	phone: text(),
	email: text().notNull(),
	passwordHash: text("password_hash"),
	profileImageName: text("profile_image_name"),
	emailVerified: boolean("email_verified").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	onboardingSeen: boolean("onboarding_seen").default(false).notNull(),
	isBanned: boolean("is_banned").default(false).notNull(),
	bannedAt: timestamp("banned_at", { withTimezone: true, mode: 'string' }),
	banReason: text("ban_reason"),
	stripeCustomerId: text("stripe_customer_id"),
}, (table) => [
	index("idx_stylehub_users_is_banned").using("btree", table.isBanned.asc().nullsLast()),
	uniqueIndex("idx_stylehub_users_stripe_customer_id").using("btree", table.stripeCustomerId.asc().nullsLast()).where(sql`(stripe_customer_id IS NOT NULL)`),
	unique("stylehub_users_email_key").on(table.email),
	check("stylehub_users_account_type_check", sql`account_type = ANY (ARRAY['cliente'::text, 'negocio'::text, 'admin'::text])`),
]);

export const stylehubOtps = pgTable("stylehub_otps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	codeHash: text("code_hash").notNull(),
	codeSalt: text("code_salt").notNull(),
	attempts: integer().default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_otps_created_at").using("btree", table.createdAt.desc().nullsFirst()),
	index("idx_stylehub_otps_user_id").using("btree", table.userId.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_otps_user_id_fkey"
		}).onDelete("cascade"),
]);

export const stylehubPasswordResets = pgTable("stylehub_password_resets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	tokenSalt: text("token_salt").notNull(),
	otpHash: text("otp_hash").notNull(),
	otpSalt: text("otp_salt").notNull(),
	attempts: integer().default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_password_resets_created_at").using("btree", table.createdAt.desc().nullsFirst()),
	index("idx_stylehub_password_resets_user_id").using("btree", table.userId.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_password_resets_user_id_fkey"
		}).onDelete("cascade"),
]);

export const stylehubAccountDeletionTokens = pgTable("stylehub_account_deletion_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	tokenSalt: text("token_salt").notNull(),
	attempts: integer().default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_account_deletion_tokens_created_at").using("btree", table.createdAt.desc().nullsFirst()),
	index("idx_stylehub_account_deletion_tokens_user_id").using("btree", table.userId.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_account_deletion_tokens_user_id_fkey"
		}).onDelete("cascade"),
]);

export const stylehubOauthAccounts = pgTable("stylehub_oauth_accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	provider: text().notNull(),
	providerAccountId: text("provider_account_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	expiresAt: integer("expires_at"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_oauth_accounts_provider").using("btree", table.provider.asc().nullsLast()),
	index("idx_stylehub_oauth_accounts_user_id").using("btree", table.userId.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_oauth_accounts_user_id_fkey"
		}).onDelete("cascade"),
	unique("stylehub_oauth_accounts_provider_provider_account_id_key").on(table.provider, table.providerAccountId),
]);

export const stylehubSupportMessages = pgTable("stylehub_support_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ticketId: uuid("ticket_id").notNull(),
	senderRole: text("sender_role").notNull(),
	senderName: text("sender_name"),
	message: text().notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_support_messages_ticket_created").using("btree", table.ticketId.asc().nullsLast(), table.createdAt.asc().nullsLast()),
	foreignKey({
			columns: [table.ticketId],
			foreignColumns: [stylehubSupportTickets.id],
			name: "stylehub_support_messages_ticket_id_fkey"
		}).onDelete("cascade"),
	check("stylehub_support_messages_sender_role_check", sql`sender_role = ANY (ARRAY['user'::text, 'oracle'::text, 'admin'::text, 'system'::text])`),
]);

export const stylehubSupportTickets = pgTable("stylehub_support_tickets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	requesterUserId: uuid("requester_user_id"),
	accountType: text("account_type"),
	contactName: text("contact_name").notNull(),
	contactEmail: text("contact_email").notNull(),
	contactPhone: text("contact_phone"),
	sourceRoute: text("source_route"),
	subject: text().notNull(),
	status: text().default('open').notNull(),
	escalatedToAdmin: boolean("escalated_to_admin").default(false).notNull(),
	escalationReason: text("escalation_reason"),
	oracleSummary: text("oracle_summary"),
	oracleConfidence: numeric("oracle_confidence", { precision: 4, scale:  2 }),
	assignedAdminEmail: text("assigned_admin_email"),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'string' }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_support_tickets_requester").using("btree", table.requesterUserId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	index("idx_stylehub_support_tickets_status_updated").using("btree", table.status.asc().nullsLast(), table.updatedAt.desc().nullsFirst()),
	foreignKey({
			columns: [table.requesterUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_support_tickets_requester_user_id_fkey"
		}).onDelete("set null"),
	check("stylehub_support_tickets_account_type_check", sql`account_type = ANY (ARRAY['cliente'::text, 'negocio'::text])`),
	check("stylehub_support_tickets_status_check", sql`status = ANY (ARRAY['open'::text, 'waiting_admin'::text, 'in_progress'::text, 'escalated'::text, 'resolved'::text, 'closed'::text])`),
]);

export const stylehubClientWallets = pgTable("stylehub_client_wallets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	balance: numeric({ precision: 12, scale:  2 }).default(sql`0`).notNull(),
	currency: text().default('MXN').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_client_wallets_user_id").using("btree", table.userId.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_client_wallets_user_id_fkey"
		}).onDelete("cascade"),
	unique("stylehub_client_wallets_user_id_key").on(table.userId),
]);

export const stylehubBusinessBranches = pgTable("stylehub_business_branches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	businessUserId: uuid("business_user_id").notNull(),
	branchName: text("branch_name").notNull(),
	description: text(),
	address: text(),
	city: text(),
	state: text(),
	postalCode: text("postal_code"),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	phone: text(),
	website: text(),
	imageUrl: text("image_url"),
	ownershipProofUrl: text("ownership_proof_url"),
	validationStatus: text("validation_status").default('pending').notNull(),
	validationNotes: text("validation_notes"),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	verifiedBy: text("verified_by"),
	openingHours: text("opening_hours"),
	closingHours: text("closing_hours"),
	isPrimary: boolean("is_primary").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_business_branches_business_user_id").using("btree", table.businessUserId.asc().nullsLast()),
	index("idx_stylehub_business_branches_validation_status").using("btree", table.validationStatus.asc().nullsLast()),
	foreignKey({
			columns: [table.businessUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_business_branches_business_user_id_fkey"
		}).onDelete("cascade"),
	check("stylehub_business_branches_validation_status_check", sql`validation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);

export const stylehubBusinessInfo = pgTable("stylehub_business_info", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	businessUserId: uuid("business_user_id").notNull(),
	salonName: text("salon_name").notNull(),
	description: text(),
	address: text(),
	city: text(),
	state: text(),
	postalCode: text("postal_code"),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	phone: text(),
	website: text(),
	imageUrl: text("image_url"),
	openingHours: text("opening_hours"),
	closingHours: text("closing_hours"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_business_info_business_user_id").using("btree", table.businessUserId.asc().nullsLast()),
	foreignKey({
			columns: [table.businessUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_business_info_business_user_id_fkey"
		}).onDelete("cascade"),
	unique("stylehub_business_info_business_user_id_key").on(table.businessUserId),
]);

export const stylehubBusinessServices = pgTable("stylehub_business_services", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	businessUserId: uuid("business_user_id").notNull(),
	branchId: uuid("branch_id"),
	serviceName: text("service_name").notNull(),
	description: text(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	durationMinutes: integer("duration_minutes"),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_business_services_branch_id").using("btree", table.branchId.asc().nullsLast()),
	index("idx_stylehub_business_services_business_user_id").using("btree", table.businessUserId.asc().nullsLast()),
	foreignKey({
			columns: [table.businessUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_business_services_business_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [stylehubBusinessBranches.id],
			name: "stylehub_business_services_branch_id_fkey"
		}).onDelete("set null"),
]);

export const stylehubBusinessStylists = pgTable("stylehub_business_stylists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	businessUserId: uuid("business_user_id").notNull(),
	branchId: uuid("branch_id"),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	email: text(),
	phone: text(),
	specialization: text(),
	yearsExperience: integer("years_experience"),
	imageUrl: text("image_url"),
	available: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_business_stylists_branch_id").using("btree", table.branchId.asc().nullsLast()),
	index("idx_stylehub_business_stylists_business_user_id").using("btree", table.businessUserId.asc().nullsLast()),
	foreignKey({
			columns: [table.businessUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_business_stylists_business_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [stylehubBusinessBranches.id],
			name: "stylehub_business_stylists_branch_id_fkey"
		}).onDelete("set null"),
]);

export const stylehubClientWalletTransactions = pgTable("stylehub_client_wallet_transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	walletId: uuid("wallet_id").notNull(),
	userId: uuid("user_id").notNull(),
	transactionType: text("transaction_type").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	paymentMethodId: uuid("payment_method_id"),
	paymentProvider: text("payment_provider"),
	status: text().default('completed').notNull(),
	externalReference: text("external_reference"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appointmentId: uuid("appointment_id"),
}, (table) => [
	uniqueIndex("idx_stylehub_wallet_tx_external_reference").using("btree", table.externalReference.asc().nullsLast()).where(sql`(external_reference IS NOT NULL)`),
	uniqueIndex("idx_stylehub_wallet_tx_one_refund_per_appointment").using("btree", table.appointmentId.asc().nullsLast()).where(sql`((transaction_type = 'refund'::text) AND (appointment_id IS NOT NULL))`),
	index("idx_stylehub_wallet_tx_user_id").using("btree", table.userId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	foreignKey({
			columns: [table.walletId],
			foreignColumns: [stylehubClientWallets.id],
			name: "stylehub_client_wallet_transactions_wallet_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_client_wallet_transactions_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.paymentMethodId],
			foreignColumns: [stylehubClientPaymentMethods.id],
			name: "stylehub_client_wallet_transactions_payment_method_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.appointmentId],
			foreignColumns: [stylehubClientAppointments.id],
			name: "stylehub_client_wallet_transactions_appointment_id_fkey"
		}).onDelete("set null"),
	check("stylehub_client_wallet_transactions_transaction_type_check", sql`transaction_type = ANY (ARRAY['recharge'::text, 'debit'::text, 'refund'::text])`),
	check("stylehub_client_wallet_transactions_status_check", sql`status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])`),
]);

export const stylehubLiveDashboardModules = pgTable("stylehub_live_dashboard_modules", {
	moduleKey: text("module_key").primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	pathPrefix: text("path_prefix"),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	isMaintenance: boolean("is_maintenance").default(false).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_live_dashboard_modules_enabled_order").using("btree", table.isEnabled.asc().nullsLast(), table.displayOrder.asc().nullsLast()),
	index("idx_stylehub_live_dashboard_modules_path_prefix").using("btree", table.pathPrefix.asc().nullsLast()),
]);

export const stylehubStylistScheduleBlocks = pgTable("stylehub_stylist_schedule_blocks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	stylistId: uuid("stylist_id").notNull(),
	dayOfWeek: smallint("day_of_week").notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
}, (table) => [
	index("idx_stylehub_schedule_blocks_stylist").using("btree", table.stylistId.asc().nullsLast(), table.dayOfWeek.asc().nullsLast()),
	foreignKey({
			columns: [table.stylistId],
			foreignColumns: [stylehubBusinessStylists.id],
			name: "stylehub_stylist_schedule_blocks_stylist_id_fkey"
		}).onDelete("cascade"),
	check("stylehub_stylist_schedule_blocks_day_of_week_check", sql`(day_of_week >= 0) AND (day_of_week <= 6)`),
	check("stylehub_stylist_schedule_blocks_check", sql`start_time < end_time`),
]);

export const stylehubClientAppointments = pgTable("stylehub_client_appointments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientUserId: uuid("client_user_id").notNull(),
	businessUserId: uuid("business_user_id").notNull(),
	branchId: uuid("branch_id"),
	serviceId: uuid("service_id"),
	serviceName: text("service_name").notNull(),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('pending').notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	paymentMethodId: uuid("payment_method_id"),
	paymentProvider: text("payment_provider"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	stylistId: uuid("stylist_id"),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }).notNull(),
	timeZone: text("time_zone").default('America/Mexico_City').notNull(),
}, (table) => [
	index("idx_stylehub_client_appointments_branch_id").using("btree", table.branchId.asc().nullsLast()),
	index("idx_stylehub_client_appointments_business_user_id").using("btree", table.businessUserId.asc().nullsLast()),
	index("idx_stylehub_client_appointments_client_user_id").using("btree", table.clientUserId.asc().nullsLast()),
	index("idx_stylehub_client_appointments_scheduled_at").using("btree", table.scheduledAt.desc().nullsFirst()),
	index("idx_stylehub_client_appointments_service_id").using("btree", table.serviceId.asc().nullsLast()),
	index("idx_stylehub_client_appointments_stylist").using("btree", table.stylistId.asc().nullsLast(), table.scheduledAt.asc().nullsLast()),
	foreignKey({
			columns: [table.clientUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_client_appointments_client_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.businessUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_client_appointments_business_user_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.paymentMethodId],
			foreignColumns: [stylehubClientPaymentMethods.id],
			name: "stylehub_client_appointments_payment_method_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.stylistId],
			foreignColumns: [stylehubBusinessStylists.id],
			name: "stylehub_client_appointments_stylist_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [stylehubBusinessBranches.id],
			name: "stylehub_client_appointments_branch_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [stylehubBusinessServices.id],
			name: "stylehub_client_appointments_service_id_fkey"
		}).onDelete("set null"),
	check("stylehub_client_appointments_status_check", sql`status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])`),
]);

export const stylehubStylistAbsences = pgTable("stylehub_stylist_absences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	stylistId: uuid("stylist_id").notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }).notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_stylist_absences_stylist").using("btree", table.stylistId.asc().nullsLast(), table.startsAt.asc().nullsLast()),
	foreignKey({
			columns: [table.stylistId],
			foreignColumns: [stylehubBusinessStylists.id],
			name: "stylehub_stylist_absences_stylist_id_fkey"
		}).onDelete("cascade"),
	check("stylehub_stylist_absences_check", sql`starts_at < ends_at`),
]);

export const stylehubFiles = pgTable("stylehub_files", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerUserId: uuid("owner_user_id").notNull(),
	kind: text().notNull(),
	contentType: text("content_type").notNull(),
	sizeBytes: integer("size_bytes").notNull(),
	data: bytea("data").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_files_owner").using("btree", table.ownerUserId.asc().nullsLast()),
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_files_owner_user_id_fkey"
		}).onDelete("cascade"),
	check("stylehub_files_kind_check", sql`kind = ANY (ARRAY['branch_image'::text, 'branch_proof'::text])`),
	check("stylehub_files_size_bytes_check", sql`(size_bytes > 0) AND (size_bytes <= 4194304)`),
]);

export const stylehubClientFavoriteBusinesses = pgTable("stylehub_client_favorite_businesses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	businessUserId: uuid("business_user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_client_favorites_business_user_id").using("btree", table.businessUserId.asc().nullsLast()),
	index("idx_stylehub_client_favorites_user_id").using("btree", table.userId.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_client_favorite_businesses_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.businessUserId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_client_favorite_businesses_business_user_id_fkey"
		}).onDelete("cascade"),
	unique("stylehub_client_favorite_businesse_user_id_business_user_id_key").on(table.userId, table.businessUserId),
]);

export const stylehubUserTwoFactorSettings = pgTable("stylehub_user_two_factor_settings", {
	userId: uuid("user_id").primaryKey().notNull(),
	enabled: boolean().default(false).notNull(),
	preferredMethod: text("preferred_method"),
	totpSecret: text("totp_secret"),
	reverifyIntervalMinutes: integer("reverify_interval_minutes").default(180).notNull(),
	lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_user_two_factor_settings_user_id_fkey"
		}).onDelete("cascade"),
	check("stylehub_user_two_factor_settings_preferred_method_check", sql`(preferred_method = ANY (ARRAY['email'::text, 'authenticator'::text])) OR (preferred_method IS NULL)`),
]);

export const stylehubClientPaymentMethods = pgTable("stylehub_client_payment_methods", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	provider: text().notNull(),
	cardBrand: text("card_brand"),
	cardLast4: text("card_last4"),
	holderName: text("holder_name"),
	paypalEmail: text("paypal_email"),
	isDefault: boolean("is_default").default(false).notNull(),
	tokenReference: text("token_reference"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stylehub_client_payment_methods_user_id").using("btree", table.userId.asc().nullsLast()),
	uniqueIndex("idx_stylehub_payment_methods_user_token").using("btree", table.userId.asc().nullsLast(), table.tokenReference.asc().nullsLast()).where(sql`(token_reference IS NOT NULL)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [stylehubUsers.id],
			name: "stylehub_client_payment_methods_user_id_fkey"
		}).onDelete("cascade"),
	check("stylehub_client_payment_methods_provider_check", sql`provider = ANY (ARRAY['card'::text, 'transfer'::text, 'cash'::text, 'wallet'::text, 'paypal'::text])`),
]);

export const stylehubStylistServices = pgTable("stylehub_stylist_services", {
	stylistId: uuid("stylist_id").notNull(),
	serviceId: uuid("service_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.stylistId],
			foreignColumns: [stylehubBusinessStylists.id],
			name: "stylehub_stylist_services_stylist_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [stylehubBusinessServices.id],
			name: "stylehub_stylist_services_service_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.stylistId, table.serviceId], name: "stylehub_stylist_services_pkey"}),
]);
