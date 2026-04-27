import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

type UserAction = "edit" | "ban" | "unban";

type UpdateUserPayload = {
  userId?: string;
  action?: UserAction;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  banReason?: string;
};

type DeleteUserPayload = {
  userId?: string;
};

function toNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(request: Request) {
  try {
    await ensureStylehubSchema();
    const db = getDb();

    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const role = (url.searchParams.get("role") || "all").trim();
    const banned = (url.searchParams.get("banned") || "all").trim();
    const sortBy = (url.searchParams.get("sortBy") || "created_at").trim();
    const sortDir = (url.searchParams.get("sortDir") || "desc").trim().toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 10)));

    const users = (await db`
      SELECT
        id,
        account_type,
        first_name,
        last_name,
        business_name,
        phone,
        email,
        email_verified,
        is_banned,
        banned_at,
        ban_reason,
        created_at,
        updated_at
      FROM stylehub_users
      ORDER BY created_at DESC
    `) as Array<{
      id: string;
      account_type: "cliente" | "negocio";
      first_name: string | null;
      last_name: string | null;
      business_name: string | null;
      phone: string | null;
      email: string;
      email_verified: boolean;
      is_banned: boolean;
      banned_at: string | null;
      ban_reason: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const [summary] = (await db`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE account_type = 'cliente')::int AS total_clients,
        COUNT(*) FILTER (WHERE account_type = 'negocio')::int AS total_businesses,
        COUNT(*) FILTER (WHERE email_verified = TRUE)::int AS total_verified,
        COUNT(*) FILTER (WHERE is_banned = TRUE)::int AS total_banned
      FROM stylehub_users
    `) as Array<{
      total_users: number;
      total_clients: number;
      total_businesses: number;
      total_verified: number;
      total_banned: number;
    }>;

    const filteredUsers = users.filter((user) => {
      if (role !== "all" && user.account_type !== role) {
        return false;
      }

      if (banned === "yes" && !user.is_banned) {
        return false;
      }

      if (banned === "no" && user.is_banned) {
        return false;
      }

      if (!search) {
        return true;
      }

      const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
      const text = [fullName, user.business_name, user.email, user.phone, user.account_type].join(" ").toLowerCase();
      return text.includes(search);
    });

    const sortFields: Record<string, (user: (typeof users)[number]) => string | number> = {
      created_at: (user) => new Date(user.created_at).getTime(),
      updated_at: (user) => new Date(user.updated_at).getTime(),
      email: (user) => user.email,
      account_type: (user) => user.account_type,
      name: (user) => [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.business_name || user.email,
    };

    const safeSortBy = Object.prototype.hasOwnProperty.call(sortFields, sortBy) ? sortBy : "created_at";
    const sortedUsers = [...filteredUsers].sort((a, b) => {
      const aValue = sortFields[safeSortBy](a);
      const bValue = sortFields[safeSortBy](b);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDir === "asc" ? aValue - bValue : bValue - aValue;
      }

      const compare = String(aValue).localeCompare(String(bValue), "es", { sensitivity: "base" });
      return sortDir === "asc" ? compare : -compare;
    });

    const totalFiltered = sortedUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const pagedUsers = sortedUsers.slice(start, start + pageSize);

    return NextResponse.json({
      users: pagedUsers,
      summary: {
        total: summary?.total_users ?? 0,
        clients: summary?.total_clients ?? 0,
        businesses: summary?.total_businesses ?? 0,
        verified: summary?.total_verified ?? 0,
        banned: summary?.total_banned ?? 0,
      },
      filters: {
        search,
        role,
        banned,
        sortBy: safeSortBy,
        sortDir: sortDir === "asc" ? "asc" : "desc",
      },
      pagination: {
        page: safePage,
        pageSize,
        totalFiltered,
        totalPages,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar la lista de usuarios." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureStylehubSchema();
    const db = getDb();

    const payload = (await request.json()) as UpdateUserPayload;
    const userId = payload.userId?.trim();
    const action = payload.action;

    if (!userId || !action) {
      return NextResponse.json({ error: "Datos inválidos para actualizar usuario." }, { status: 400 });
    }

    if (action === "edit") {
      const email = normalizeEmail(payload.email);
      if (!email) {
        return NextResponse.json({ error: "El correo es obligatorio." }, { status: 400 });
      }

      const updated = (await db`
        UPDATE stylehub_users
        SET
          first_name = ${toNullableText(payload.firstName)},
          last_name = ${toNullableText(payload.lastName)},
          business_name = ${toNullableText(payload.businessName)},
          phone = ${toNullableText(payload.phone)},
          email = ${email},
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id
      `) as Array<{ id: string }>;

      if (updated.length === 0) {
        return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "ban") {
      const updated = (await db`
        UPDATE stylehub_users
        SET
          is_banned = TRUE,
          banned_at = NOW(),
          ban_reason = ${toNullableText(payload.banReason)},
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id
      `) as Array<{ id: string }>;

      if (updated.length === 0) {
        return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "unban") {
      const updated = (await db`
        UPDATE stylehub_users
        SET
          is_banned = FALSE,
          banned_at = NULL,
          ban_reason = NULL,
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id
      `) as Array<{ id: string }>;

      if (updated.length === 0) {
        return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción no soportada." }, { status: 400 });
  } catch (error) {
    console.error(error);

    const maybeError = error as { code?: string };
    if (maybeError.code === "23505") {
      return NextResponse.json({ error: "Ese correo ya está registrado por otro usuario." }, { status: 409 });
    }

    return NextResponse.json({ error: "No se pudo actualizar el usuario." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureStylehubSchema();
    const db = getDb();

    const payload = (await request.json()) as DeleteUserPayload;
    const userId = payload.userId?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Falta userId para eliminar." }, { status: 400 });
    }

    const deleted = (await db`
      DELETE FROM stylehub_users
      WHERE id = ${userId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (deleted.length === 0) {
      return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    const maybeError = error as { code?: string };
    if (maybeError.code === "23503") {
      return NextResponse.json(
        { error: "No se puede eliminar este usuario porque tiene registros relacionados activos." },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "No se pudo eliminar el usuario." }, { status: 500 });
  }
}
