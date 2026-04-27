import { getServerSession } from "next-auth";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export type SupportCurrentUser = {
  id: string;
  accountType: "cliente" | "negocio";
  name: string;
  email: string;
  phone: string | null;
} | null;

export async function getCurrentSupportUser(): Promise<SupportCurrentUser> {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return null;
  }

  await ensureStylehubSchema();
  const db = getDb();

  const email = session.user.email?.trim().toLowerCase() ?? "";
  const sessionUserId = session.user.id || null;

  if (sessionUserId) {
    const [userById] = (await db`
      SELECT id, account_type, first_name, last_name, business_name, email, phone
      FROM stylehub_users
      WHERE id = ${sessionUserId}
      LIMIT 1
    `) as Array<{
      id: string;
      account_type: "cliente" | "negocio";
      first_name: string | null;
      last_name: string | null;
      business_name: string | null;
      email: string;
      phone: string | null;
    }>;

    if (userById) {
      const name = [userById.first_name, userById.last_name].filter(Boolean).join(" ").trim() || userById.business_name || userById.email;
      return { id: userById.id, accountType: userById.account_type, name, email: userById.email, phone: userById.phone };
    }
  }

  if (!email) {
    return null;
  }

  const [userByEmail] = (await db`
    SELECT id, account_type, first_name, last_name, business_name, email, phone
    FROM stylehub_users
    WHERE email = ${email}
    LIMIT 1
  `) as Array<{
    id: string;
    account_type: "cliente" | "negocio";
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    email: string;
    phone: string | null;
  }>;

  if (!userByEmail) {
    return null;
  }

  const name = [userByEmail.first_name, userByEmail.last_name].filter(Boolean).join(" ").trim() || userByEmail.business_name || userByEmail.email;
  return { id: userByEmail.id, accountType: userByEmail.account_type, name, email: userByEmail.email, phone: userByEmail.phone };
}
