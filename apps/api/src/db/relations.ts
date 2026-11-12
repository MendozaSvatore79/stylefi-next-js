// Relaciones entre tablas para las consultas de Drizzle (generado con drizzle-kit pull).
import { relations } from "drizzle-orm/relations";
import { stylehubUsers, stylehubUserTwoFactorChallenges, stylehubOtps, stylehubPasswordResets, stylehubAccountDeletionTokens, stylehubOauthAccounts, stylehubSupportTickets, stylehubSupportMessages, stylehubClientWallets, stylehubBusinessBranches, stylehubBusinessInfo, stylehubBusinessServices, stylehubBusinessStylists, stylehubClientWalletTransactions, stylehubClientPaymentMethods, stylehubClientAppointments, stylehubStylistScheduleBlocks, stylehubStylistAbsences, stylehubFiles, stylehubClientFavoriteBusinesses, stylehubUserTwoFactorSettings, stylehubStylistServices } from "./schema.js";

export const stylehubUserTwoFactorChallengesRelations = relations(stylehubUserTwoFactorChallenges, ({one}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubUserTwoFactorChallenges.userId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubUsersRelations = relations(stylehubUsers, ({many}) => ({
	stylehubUserTwoFactorChallenges: many(stylehubUserTwoFactorChallenges),
	stylehubOtps: many(stylehubOtps),
	stylehubPasswordResets: many(stylehubPasswordResets),
	stylehubAccountDeletionTokens: many(stylehubAccountDeletionTokens),
	stylehubOauthAccounts: many(stylehubOauthAccounts),
	stylehubSupportTickets: many(stylehubSupportTickets),
	stylehubClientWallets: many(stylehubClientWallets),
	stylehubBusinessBranches: many(stylehubBusinessBranches),
	stylehubBusinessInfos: many(stylehubBusinessInfo),
	stylehubBusinessServices: many(stylehubBusinessServices),
	stylehubBusinessStylists: many(stylehubBusinessStylists),
	stylehubClientWalletTransactions: many(stylehubClientWalletTransactions),
	stylehubClientAppointments_clientUserId: many(stylehubClientAppointments, {
		relationName: "stylehubClientAppointments_clientUserId_stylehubUsers_id"
	}),
	stylehubClientAppointments_businessUserId: many(stylehubClientAppointments, {
		relationName: "stylehubClientAppointments_businessUserId_stylehubUsers_id"
	}),
	stylehubFiles: many(stylehubFiles),
	stylehubClientFavoriteBusinesses_userId: many(stylehubClientFavoriteBusinesses, {
		relationName: "stylehubClientFavoriteBusinesses_userId_stylehubUsers_id"
	}),
	stylehubClientFavoriteBusinesses_businessUserId: many(stylehubClientFavoriteBusinesses, {
		relationName: "stylehubClientFavoriteBusinesses_businessUserId_stylehubUsers_id"
	}),
	stylehubUserTwoFactorSettings: many(stylehubUserTwoFactorSettings),
	stylehubClientPaymentMethods: many(stylehubClientPaymentMethods),
}));

export const stylehubOtpsRelations = relations(stylehubOtps, ({one}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubOtps.userId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubPasswordResetsRelations = relations(stylehubPasswordResets, ({one}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubPasswordResets.userId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubAccountDeletionTokensRelations = relations(stylehubAccountDeletionTokens, ({one}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubAccountDeletionTokens.userId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubOauthAccountsRelations = relations(stylehubOauthAccounts, ({one}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubOauthAccounts.userId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubSupportMessagesRelations = relations(stylehubSupportMessages, ({one}) => ({
	stylehubSupportTicket: one(stylehubSupportTickets, {
		fields: [stylehubSupportMessages.ticketId],
		references: [stylehubSupportTickets.id]
	}),
}));

export const stylehubSupportTicketsRelations = relations(stylehubSupportTickets, ({one, many}) => ({
	stylehubSupportMessages: many(stylehubSupportMessages),
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubSupportTickets.requesterUserId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubClientWalletsRelations = relations(stylehubClientWallets, ({one, many}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubClientWallets.userId],
		references: [stylehubUsers.id]
	}),
	stylehubClientWalletTransactions: many(stylehubClientWalletTransactions),
}));

export const stylehubBusinessBranchesRelations = relations(stylehubBusinessBranches, ({one, many}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubBusinessBranches.businessUserId],
		references: [stylehubUsers.id]
	}),
	stylehubBusinessServices: many(stylehubBusinessServices),
	stylehubBusinessStylists: many(stylehubBusinessStylists),
	stylehubClientAppointments: many(stylehubClientAppointments),
}));

export const stylehubBusinessInfoRelations = relations(stylehubBusinessInfo, ({one}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubBusinessInfo.businessUserId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubBusinessServicesRelations = relations(stylehubBusinessServices, ({one, many}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubBusinessServices.businessUserId],
		references: [stylehubUsers.id]
	}),
	stylehubBusinessBranch: one(stylehubBusinessBranches, {
		fields: [stylehubBusinessServices.branchId],
		references: [stylehubBusinessBranches.id]
	}),
	stylehubClientAppointments: many(stylehubClientAppointments),
	stylehubStylistServices: many(stylehubStylistServices),
}));

export const stylehubBusinessStylistsRelations = relations(stylehubBusinessStylists, ({one, many}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubBusinessStylists.businessUserId],
		references: [stylehubUsers.id]
	}),
	stylehubBusinessBranch: one(stylehubBusinessBranches, {
		fields: [stylehubBusinessStylists.branchId],
		references: [stylehubBusinessBranches.id]
	}),
	stylehubStylistScheduleBlocks: many(stylehubStylistScheduleBlocks),
	stylehubClientAppointments: many(stylehubClientAppointments),
	stylehubStylistAbsences: many(stylehubStylistAbsences),
	stylehubStylistServices: many(stylehubStylistServices),
}));

export const stylehubClientWalletTransactionsRelations = relations(stylehubClientWalletTransactions, ({one}) => ({
	stylehubClientWallet: one(stylehubClientWallets, {
		fields: [stylehubClientWalletTransactions.walletId],
		references: [stylehubClientWallets.id]
	}),
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubClientWalletTransactions.userId],
		references: [stylehubUsers.id]
	}),
	stylehubClientPaymentMethod: one(stylehubClientPaymentMethods, {
		fields: [stylehubClientWalletTransactions.paymentMethodId],
		references: [stylehubClientPaymentMethods.id]
	}),
	stylehubClientAppointment: one(stylehubClientAppointments, {
		fields: [stylehubClientWalletTransactions.appointmentId],
		references: [stylehubClientAppointments.id]
	}),
}));

export const stylehubClientPaymentMethodsRelations = relations(stylehubClientPaymentMethods, ({one, many}) => ({
	stylehubClientWalletTransactions: many(stylehubClientWalletTransactions),
	stylehubClientAppointments: many(stylehubClientAppointments),
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubClientPaymentMethods.userId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubClientAppointmentsRelations = relations(stylehubClientAppointments, ({one, many}) => ({
	stylehubClientWalletTransactions: many(stylehubClientWalletTransactions),
	stylehubUser_clientUserId: one(stylehubUsers, {
		fields: [stylehubClientAppointments.clientUserId],
		references: [stylehubUsers.id],
		relationName: "stylehubClientAppointments_clientUserId_stylehubUsers_id"
	}),
	stylehubUser_businessUserId: one(stylehubUsers, {
		fields: [stylehubClientAppointments.businessUserId],
		references: [stylehubUsers.id],
		relationName: "stylehubClientAppointments_businessUserId_stylehubUsers_id"
	}),
	stylehubClientPaymentMethod: one(stylehubClientPaymentMethods, {
		fields: [stylehubClientAppointments.paymentMethodId],
		references: [stylehubClientPaymentMethods.id]
	}),
	stylehubBusinessStylist: one(stylehubBusinessStylists, {
		fields: [stylehubClientAppointments.stylistId],
		references: [stylehubBusinessStylists.id]
	}),
	stylehubBusinessBranch: one(stylehubBusinessBranches, {
		fields: [stylehubClientAppointments.branchId],
		references: [stylehubBusinessBranches.id]
	}),
	stylehubBusinessService: one(stylehubBusinessServices, {
		fields: [stylehubClientAppointments.serviceId],
		references: [stylehubBusinessServices.id]
	}),
}));

export const stylehubStylistScheduleBlocksRelations = relations(stylehubStylistScheduleBlocks, ({one}) => ({
	stylehubBusinessStylist: one(stylehubBusinessStylists, {
		fields: [stylehubStylistScheduleBlocks.stylistId],
		references: [stylehubBusinessStylists.id]
	}),
}));

export const stylehubStylistAbsencesRelations = relations(stylehubStylistAbsences, ({one}) => ({
	stylehubBusinessStylist: one(stylehubBusinessStylists, {
		fields: [stylehubStylistAbsences.stylistId],
		references: [stylehubBusinessStylists.id]
	}),
}));

export const stylehubFilesRelations = relations(stylehubFiles, ({one}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubFiles.ownerUserId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubClientFavoriteBusinessesRelations = relations(stylehubClientFavoriteBusinesses, ({one}) => ({
	stylehubUser_userId: one(stylehubUsers, {
		fields: [stylehubClientFavoriteBusinesses.userId],
		references: [stylehubUsers.id],
		relationName: "stylehubClientFavoriteBusinesses_userId_stylehubUsers_id"
	}),
	stylehubUser_businessUserId: one(stylehubUsers, {
		fields: [stylehubClientFavoriteBusinesses.businessUserId],
		references: [stylehubUsers.id],
		relationName: "stylehubClientFavoriteBusinesses_businessUserId_stylehubUsers_id"
	}),
}));

export const stylehubUserTwoFactorSettingsRelations = relations(stylehubUserTwoFactorSettings, ({one}) => ({
	stylehubUser: one(stylehubUsers, {
		fields: [stylehubUserTwoFactorSettings.userId],
		references: [stylehubUsers.id]
	}),
}));

export const stylehubStylistServicesRelations = relations(stylehubStylistServices, ({one}) => ({
	stylehubBusinessStylist: one(stylehubBusinessStylists, {
		fields: [stylehubStylistServices.stylistId],
		references: [stylehubBusinessStylists.id]
	}),
	stylehubBusinessService: one(stylehubBusinessServices, {
		fields: [stylehubStylistServices.serviceId],
		references: [stylehubBusinessServices.id]
	}),
}));