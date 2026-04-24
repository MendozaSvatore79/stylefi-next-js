import type { DefaultSession, NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { verifyPassword } from "@/lib/password";

async function ensureAuthCriticalTables() {
  const db = getDb();

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
      onboarding_seen BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verified_at TIMESTAMPTZ
    );
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
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountType: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accountType?: string;
  }
}

export const authConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
          return null;
        }

        await ensureStylehubSchema();
        await ensureAuthCriticalTables();
        const db = getDb();

        const users = (await db`
          SELECT id, email, account_type, password_hash, email_verified, first_name, business_name
          FROM stylehub_users
          WHERE email = ${email}
          LIMIT 1
        `) as Array<{
          id: string;
          email: string;
          account_type: "cliente" | "negocio";
          password_hash: string | null;
          email_verified: boolean;
          first_name: string | null;
          business_name: string | null;
        }>;

        if (users.length === 0) {
          return null;
        }

        const foundUser = users[0];

        if (!foundUser.password_hash || !verifyPassword(password, foundUser.password_hash)) {
          return null;
        }

        if (!foundUser.email_verified) {
          return null;
        }

        return {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.first_name || foundUser.business_name || foundUser.email,
          accountType: foundUser.account_type,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account) {
        return false;
      }

      if (account.provider === "credentials") {
        return true;
      }

      if (account.provider !== "google") {
        return false;
      }

      try {
        await ensureStylehubSchema();
        await ensureAuthCriticalTables();
        const db = getDb();

        const email = user.email?.toLowerCase();
        if (!email) {
          return false;
        }

        // Buscar usuario existente
        let existingUsers: Array<{ id: string; email_verified: boolean; account_type: "cliente" | "negocio" }> = [];

        try {
          existingUsers = (await db`
            SELECT id, email_verified, account_type
            FROM stylehub_users
            WHERE email = ${email}
            LIMIT 1
          `) as Array<{ id: string; email_verified: boolean; account_type: "cliente" | "negocio" }>;
        } catch (lookupError) {
          const errorWithCode = lookupError as { code?: string };

          if (errorWithCode.code === "42P01") {
            await ensureAuthCriticalTables();

            existingUsers = (await db`
              SELECT id, email_verified, account_type
              FROM stylehub_users
              WHERE email = ${email}
              LIMIT 1
            `) as Array<{ id: string; email_verified: boolean; account_type: "cliente" | "negocio" }>;
          } else {
            throw lookupError;
          }
        }

        if (existingUsers.length > 0) {
          const existingUser = existingUsers[0];

          const userId = existingUser.id;

          const oauthAccounts = (await db`
            SELECT id
            FROM stylehub_oauth_accounts
            WHERE user_id = ${userId}
            AND provider = ${account.provider}
            AND provider_account_id = ${account.providerAccountId}
            LIMIT 1
          `) as Array<{ id: string }>;

          if (oauthAccounts.length === 0) {
            await db`
              INSERT INTO stylehub_oauth_accounts (
                user_id,
                provider,
                provider_account_id,
                access_token,
                refresh_token,
                expires_at
              )
              VALUES (
                ${userId},
                ${account.provider},
                ${account.providerAccountId},
                ${account.access_token || null},
                ${account.refresh_token || null},
                ${account.expires_at || null}
              )
            `;
          }

          if (!existingUser.email_verified) {
            await db`
              UPDATE stylehub_users
              SET email_verified = true, verified_at = NOW()
              WHERE id = ${userId}
            `;
          }
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "credentials" && user) {
        const credentialsUser = user as { id?: string; accountType?: string; email?: string | null };
        token.id = credentialsUser.id ?? token.id;
        token.accountType = credentialsUser.accountType ?? token.accountType;
        token.email = credentialsUser.email ?? token.email;
      }

      if (token.email) {
        try {
          await ensureStylehubSchema();
          const db = getDb();
          const users = (await db`
            SELECT id, account_type
            FROM stylehub_users
            WHERE email = ${String(token.email).toLowerCase()}
            LIMIT 1
          `) as Array<{ id: string; account_type: string }>;

          if (users.length > 0) {
            token.id = users[0].id;
            token.accountType = users[0].account_type;
          }
        } catch (error) {
          console.error("Error fetching user info in JWT callback:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.accountType = token.accountType ?? "cliente";
      }
      return session;
    },
  },
  pages: {
    signIn: "/iniciar-sesion",
  },
} satisfies NextAuthOptions;
