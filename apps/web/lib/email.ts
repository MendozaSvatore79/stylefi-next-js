import nodemailer from "nodemailer";

import { getOptionalEnv } from "@/lib/env";

function normalizeEnv(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.trim().replace(/^['"]+|['"]+$/g, "");
}

type SendOtpEmailInput = {
  to: string;
  code: string;
  recipientName?: string;
};

type SendPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  otp: string;
  recipientName?: string;
};

type SendAccountDeletionTokenEmailInput = {
  to: string;
  token: string;
  recipientName?: string;
};

type SendTwoFactorCodeEmailInput = {
  to: string;
  code: string;
  recipientName?: string;
  purposeLabel?: string;
};

type SendAppointmentConfirmationEmailInput = {
  businessEmail: string;
  businessName: string;
  clientEmail: string;
  clientName: string;
  serviceName: string;
  scheduledAt: string;
  totalAmount: number;
};

type SupportConversationEntry = {
  role: "user" | "oracle" | "admin" | "system";
  name?: string | null;
  message: string;
  createdAt?: string;
};

type SendSupportConversationEmailInput = {
  to: string;
  subject: string;
  ticketId: string;
  contactName: string;
  contactEmail: string;
  route?: string | null;
  summary?: string | null;
  conversation: SupportConversationEntry[];
};

export async function sendOtpEmail({ to, code, recipientName }: SendOtpEmailInput) {
  const host = normalizeEnv(getOptionalEnv("SMTP_HOST"));
  const user = normalizeEnv(getOptionalEnv("SMTP_USER"));
  const pass = normalizeEnv(getOptionalEnv("SMTP_PASSWORD"));
  const port = Number(normalizeEnv(getOptionalEnv("SMTP_PORT")) ?? "587");
  const secure = normalizeEnv(getOptionalEnv("SMTP_SECURE")) === "true" || port === 465;
  const from = normalizeEnv(getOptionalEnv("SMTP_FROM")) ?? user ?? "STYLEHUB <no-reply@stylehub.local>";

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[OTP DEV] Code sent to ${to}: ${code}`);
      return;
    }

    throw new Error("SMTP configuration is incomplete.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const greeting = recipientName ? `Hola ${recipientName}` : "Hola";

  await transporter.sendMail({
    from,
    to,
    subject: "Tu código OTP de STYLEHUB",
    text: `${greeting}, tu código de verificación es ${code}. Vence en 10 minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; color:#171135;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px; border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:#6b7280;">STYLEHUB</p>
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#130b3a;">Tu código OTP</h1>
          <p style="margin:0 0 24px; font-size:16px; color:#374151;">${greeting}, usa este código para completar tu registro:</p>
          <div style="display:inline-block; padding:16px 24px; border-radius:16px; background:#130b3a; color:#ffffff; font-size:32px; font-weight:800; letter-spacing:.2em;">${code}</div>
          <p style="margin:24px 0 0; font-size:14px; color:#6b7280;">Este código vence en 10 minutos.</p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({ to, resetUrl, otp, recipientName }: SendPasswordResetEmailInput) {
  const host = normalizeEnv(getOptionalEnv("SMTP_HOST"));
  const user = normalizeEnv(getOptionalEnv("SMTP_USER"));
  const pass = normalizeEnv(getOptionalEnv("SMTP_PASSWORD"));
  const port = Number(normalizeEnv(getOptionalEnv("SMTP_PORT")) ?? "587");
  const secure = normalizeEnv(getOptionalEnv("SMTP_SECURE")) === "true" || port === 465;
  const from = normalizeEnv(getOptionalEnv("SMTP_FROM")) ?? user ?? "STYLEHUB <no-reply@stylehub.local>";

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[RESET DEV] Link sent to ${to}: ${resetUrl}`);
      console.warn(`[RESET DEV] OTP sent to ${to}: ${otp}`);
      return;
    }

    throw new Error("SMTP configuration is incomplete.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const greeting = recipientName ? `Hola ${recipientName}` : "Hola";

  await transporter.sendMail({
    from,
    to,
    subject: "Recupera tu contraseña de STYLEHUB",
    text: `${greeting}, solicitaste restablecer tu contraseña. Abre este enlace: ${resetUrl}. Tu OTP de validación es ${otp}.`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; color:#171135;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px; border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:#6b7280;">STYLEHUB</p>
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#130b3a;">Restablecer contraseña</h1>
          <p style="margin:0 0 16px; font-size:16px; color:#374151;">${greeting}, usa este enlace para abrir la pantalla de recuperación:</p>
          <p style="margin:0 0 24px;"><a href="${resetUrl}" style="display:inline-block; background:#130b3a; color:#ffffff; text-decoration:none; padding:14px 20px; border-radius:14px; font-weight:700;">Restablecer contraseña</a></p>
          <p style="margin:0 0 12px; font-size:14px; color:#374151;">Tu OTP de validación es:</p>
          <div style="display:inline-block; padding:16px 24px; border-radius:16px; background:#130b3a; color:#ffffff; font-size:32px; font-weight:800; letter-spacing:.2em;">${otp}</div>
          <p style="margin:24px 0 0; font-size:14px; color:#6b7280;">Este enlace y código vencen en 15 minutos.</p>
        </div>
      </div>
    `,
  });
}

export async function sendAccountDeletionTokenEmail({
  to,
  token,
  recipientName,
}: SendAccountDeletionTokenEmailInput) {
  const host = normalizeEnv(getOptionalEnv("SMTP_HOST"));
  const user = normalizeEnv(getOptionalEnv("SMTP_USER"));
  const pass = normalizeEnv(getOptionalEnv("SMTP_PASSWORD"));
  const port = Number(normalizeEnv(getOptionalEnv("SMTP_PORT")) ?? "587");
  const secure = normalizeEnv(getOptionalEnv("SMTP_SECURE")) === "true" || port === 465;
  const from = normalizeEnv(getOptionalEnv("SMTP_FROM")) ?? user ?? "STYLEHUB <no-reply@stylehub.local>";

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ACCOUNT DELETE DEV] Token sent to ${to}: ${token}`);
      return;
    }

    throw new Error("SMTP configuration is incomplete.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const greeting = recipientName ? `Hola ${recipientName}` : "Hola";

  await transporter.sendMail({
    from,
    to,
    subject: "Código para eliminar tu cuenta en STYLEHUB",
    text: `${greeting}, tu código para confirmar la eliminación de cuenta es ${token}. Vence en 10 minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; color:#171135;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px; border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:#6b7280;">STYLEHUB</p>
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#130b3a;">Confirmar eliminación de cuenta</h1>
          <p style="margin:0 0 24px; font-size:16px; color:#374151;">${greeting}, usa este código para confirmar la eliminación de tu cuenta:</p>
          <div style="display:inline-block; padding:16px 24px; border-radius:16px; background:#7f1d1d; color:#ffffff; font-size:32px; font-weight:800; letter-spacing:.2em;">${token}</div>
          <p style="margin:24px 0 0; font-size:14px; color:#6b7280;">Este código vence en 10 minutos. Si no solicitaste esta acción, ignora este correo.</p>
        </div>
      </div>
    `,
  });
}

export async function sendTwoFactorCodeEmail({
  to,
  code,
  recipientName,
  purposeLabel,
}: SendTwoFactorCodeEmailInput) {
  const host = normalizeEnv(getOptionalEnv("SMTP_HOST"));
  const user = normalizeEnv(getOptionalEnv("SMTP_USER"));
  const pass = normalizeEnv(getOptionalEnv("SMTP_PASSWORD"));
  const port = Number(normalizeEnv(getOptionalEnv("SMTP_PORT")) ?? "587");
  const secure = normalizeEnv(getOptionalEnv("SMTP_SECURE")) === "true" || port === 465;
  const from = normalizeEnv(getOptionalEnv("SMTP_FROM")) ?? user ?? "STYLEHUB <no-reply@stylehub.local>";

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[2FA DEV] Code sent to ${to}: ${code}`);
      return;
    }

    throw new Error("SMTP configuration is incomplete.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const greeting = recipientName ? `Hola ${recipientName}` : "Hola";
  const reason = purposeLabel ? ` para ${purposeLabel}` : "";

  await transporter.sendMail({
    from,
    to,
    subject: "Código de verificación 2FA de STYLEHUB",
    text: `${greeting}, tu código de verificación 2FA${reason} es ${code}. Vence en 10 minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; color:#171135;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px; border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:#6b7280;">STYLEHUB</p>
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#130b3a;">Verificación en dos pasos</h1>
          <p style="margin:0 0 24px; font-size:16px; color:#374151;">${greeting}, usa este código${reason}:</p>
          <div style="display:inline-block; padding:16px 24px; border-radius:16px; background:#130b3a; color:#ffffff; font-size:32px; font-weight:800; letter-spacing:.2em;">${code}</div>
          <p style="margin:24px 0 0; font-size:14px; color:#6b7280;">Este código vence en 10 minutos.</p>
        </div>
      </div>
    `,
  });
}

export async function sendAppointmentConfirmationEmails({
  businessEmail,
  businessName,
  clientEmail,
  clientName,
  serviceName,
  scheduledAt,
  totalAmount,
}: SendAppointmentConfirmationEmailInput) {
  const host = normalizeEnv(getOptionalEnv("SMTP_HOST"));
  const user = normalizeEnv(getOptionalEnv("SMTP_USER"));
  const pass = normalizeEnv(getOptionalEnv("SMTP_PASSWORD"));
  const port = Number(normalizeEnv(getOptionalEnv("SMTP_PORT")) ?? "587");
  const secure = normalizeEnv(getOptionalEnv("SMTP_SECURE")) === "true" || port === 465;
  const from = normalizeEnv(getOptionalEnv("SMTP_FROM")) ?? user ?? "STYLEHUB <no-reply@stylehub.local>";

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[APPOINTMENT DEV] Confirmación para cliente: ${clientEmail}`);
      console.warn(`[APPOINTMENT DEV] Confirmación para negocio: ${businessEmail}`);
      return;
    }

    throw new Error("SMTP configuration is incomplete.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const dateLabel = new Date(scheduledAt).toLocaleString("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const amountLabel = totalAmount.toFixed(2);

  await transporter.sendMail({
    from,
    to: clientEmail,
    subject: "Tu cita en STYLEHUB ha sido confirmada",
    text: `Hola ${clientName}, tu cita para ${serviceName} con ${businessName} fue confirmada para ${dateLabel}. Total: $${amountLabel}.`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; color:#171135;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px; border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:#6b7280;">STYLEHUB</p>
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#130b3a;">Tu cita está confirmada</h1>
          <p style="margin:0 0 20px; font-size:16px; color:#374151;">Hola ${clientName}, el negocio <strong>${businessName}</strong> confirmó tu cita.</p>
          <p style="margin:0 0 8px; font-size:15px; color:#374151;"><strong>Servicio:</strong> ${serviceName}</p>
          <p style="margin:0 0 8px; font-size:15px; color:#374151;"><strong>Fecha y hora:</strong> ${dateLabel}</p>
          <p style="margin:0 0 8px; font-size:15px; color:#374151;"><strong>Total:</strong> $${amountLabel}</p>
        </div>
      </div>
    `,
  });

  await transporter.sendMail({
    from,
    to: businessEmail,
    subject: "Confirmación enviada al cliente",
    text: `Hola ${businessName}, se confirmó la cita de ${clientName} para ${serviceName} el ${dateLabel}. Total: $${amountLabel}.`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; color:#171135;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px; border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:#6b7280;">STYLEHUB</p>
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#130b3a;">Cita confirmada</h1>
          <p style="margin:0 0 20px; font-size:16px; color:#374151;">Hola ${businessName}, ya se notificó al cliente por correo.</p>
          <p style="margin:0 0 8px; font-size:15px; color:#374151;"><strong>Cliente:</strong> ${clientName}</p>
          <p style="margin:0 0 8px; font-size:15px; color:#374151;"><strong>Servicio:</strong> ${serviceName}</p>
          <p style="margin:0 0 8px; font-size:15px; color:#374151;"><strong>Fecha y hora:</strong> ${dateLabel}</p>
          <p style="margin:0 0 8px; font-size:15px; color:#374151;"><strong>Total:</strong> $${amountLabel}</p>
        </div>
      </div>
    `,
  });
}

export async function sendSupportConversationEmail({
  to,
  subject,
  ticketId,
  contactName,
  contactEmail,
  route,
  summary,
  conversation,
}: SendSupportConversationEmailInput) {
  const host = normalizeEnv(getOptionalEnv("SMTP_HOST"));
  const user = normalizeEnv(getOptionalEnv("SMTP_USER"));
  const pass = normalizeEnv(getOptionalEnv("SMTP_PASSWORD"));
  const port = Number(normalizeEnv(getOptionalEnv("SMTP_PORT")) ?? "587");
  const secure = normalizeEnv(getOptionalEnv("SMTP_SECURE")) === "true" || port === 465;
  const from = normalizeEnv(getOptionalEnv("SMTP_FROM")) ?? user ?? "STYLEHUB <no-reply@stylehub.local>";

  const transcript = conversation
    .map((entry) => `${entry.role.toUpperCase()}${entry.name ? ` (${entry.name})` : ""}: ${entry.message}`)
    .join("\n\n");

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[SUPPORT DEV] Ticket ${ticketId} transcript sent to ${to}`);
      console.warn(`[SUPPORT DEV] Route: ${route ?? "n/a"}`);
      console.warn(`[SUPPORT DEV] Summary: ${summary ?? "n/a"}`);
      console.warn(`[SUPPORT DEV] Transcript:\n${transcript}`);
      return;
    }

    throw new Error("SMTP configuration is incomplete.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text: [
      `Ticket: ${ticketId}`,
      `Contacto: ${contactName} <${contactEmail}>`,
      route ? `Ruta: ${route}` : null,
      summary ? `Resumen: ${summary}` : null,
      "",
      transcript,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; color:#171135;">
        <div style="max-width:720px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px; border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:#6b7280;">STYLEHUB · AURA</p>
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#130b3a;">${subject}</h1>
          <p style="margin:0 0 10px; font-size:15px; color:#374151;"><strong>Ticket:</strong> ${ticketId}</p>
          <p style="margin:0 0 10px; font-size:15px; color:#374151;"><strong>Contacto:</strong> ${contactName} &lt;${contactEmail}&gt;</p>
          ${route ? `<p style="margin:0 0 10px; font-size:15px; color:#374151;"><strong>Ruta:</strong> ${route}</p>` : ""}
          ${summary ? `<p style="margin:0 0 20px; font-size:15px; color:#374151;"><strong>Resumen:</strong> ${summary}</p>` : ""}
          <div style="border:1px solid #e5e7eb; border-radius:16px; padding:16px; background:#fafafa; white-space:pre-wrap; font-size:14px; line-height:1.6; color:#1f2937;">${transcript.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
      </div>
    `,
  });
}
