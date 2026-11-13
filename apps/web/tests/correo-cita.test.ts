/** Correo de confirmación de cita: hora del negocio aunque el servidor esté en UTC, y nombres escapados en el HTML. */
import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn().mockResolvedValue({});
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

const zona = process.env.TZ;

afterEach(() => {
  vi.unstubAllEnvs();
  sendMail.mockClear();
  if (zona === undefined) delete process.env.TZ;
  else process.env.TZ = zona;
});

describe("sendAppointmentConfirmationEmails", () => {
  it("la hora va en la zona del negocio y los nombres van escapados", async () => {
    process.env.TZ = "UTC"; // como Vercel
    vi.stubEnv("SMTP_HOST", "smtp.prueba.invalid");
    vi.stubEnv("SMTP_USER", "yo");
    vi.stubEnv("SMTP_PASSWORD", "x");
    const { sendAppointmentConfirmationEmails } = await import("@/lib/email");
    await sendAppointmentConfirmationEmails({
      businessEmail: "negocio@prueba.invalid",
      businessName: "Alfa",
      clientEmail: "cliente@prueba.invalid",
      clientName: '<b>Carla</b> & "amigas"',
      serviceName: "Corte",
      scheduledAt: "2026-11-20T17:00:00Z", // 11:00 en la Ciudad de México
      totalAmount: 250,
    });
    expect(sendMail).toHaveBeenCalledTimes(2);
    for (const [correo] of sendMail.mock.calls) {
      expect(correo.text).toMatch(/20 de noviembre de 2026,? 11:00/);
      expect(correo.text).not.toContain("17:00");
      expect(correo.html).not.toContain("<b>Carla</b>");
      expect(correo.html).toContain("&lt;b&gt;Carla&lt;/b&gt; &amp; &quot;amigas&quot;");
    }
  });
});
