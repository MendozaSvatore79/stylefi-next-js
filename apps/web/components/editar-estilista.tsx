"use client";

import { useState } from "react";

import { useToast } from "@/components/toast";
import { api } from "@/lib/api";
import { leerJson } from "@/lib/ubicacion";
import { ANIOS_MAXIMOS, errorCorreo, errorRango, errorTelefono, errorTexto, errorUrl, LIMITES, limpiarTelefono, primerError } from "@/lib/validacion";

export type EstilistaEditable = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  years_experience: number | null;
  image_url: string | null;
  available: boolean;
  branch_id: string | null;
};

const campo =
  "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring";

/**
 * Edición en línea de un estilista. Decisión de producto: cambiarlo de sucursal con citas próximas da 409 (el
 * mensaje se muestra aquí); sin citas, pierde los servicios que no son de la nueva sucursal. Sus servicios y su
 * horario se siguen editando en «Horario y servicios»; la disponibilidad, con su interruptor.
 */
export default function EditarEstilista({
  estilista,
  sucursales,
  idioma,
  onCancelar,
  onGuardado,
}: {
  estilista: EstilistaEditable;
  sucursales: Array<{ id: string; branch_name: string }>;
  idioma: "es" | "en";
  onCancelar: () => void;
  onGuardado: () => Promise<void> | void;
}) {
  const en = idioma === "en";
  const { showToast } = useToast();
  const [form, setForm] = useState({
    firstName: estilista.first_name,
    lastName: estilista.last_name,
    email: estilista.email ?? "",
    phone: estilista.phone ?? "",
    specialization: estilista.specialization ?? "",
    yearsExperience: estilista.years_experience !== null ? String(estilista.years_experience) : "",
    imageUrl: estilista.image_url ?? "",
    branchId: estilista.branch_id ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambiaDeSucursal = Boolean(estilista.branch_id) && form.branchId !== estilista.branch_id;

  const cambiar = (k: keyof typeof form) => (event: { target: { value: string } }) => {
    const valor = event.target.value;
    setForm((f) => ({ ...f, [k]: k === "phone" ? limpiarTelefono(valor) : valor }));
  };

  const guardar = async () => {
    // Datos viejos sin tocar se aceptan como en el backend
    const sinCambio = (k: keyof typeof form, original: string | null) => form[k].trim() === (original ?? "");
    const errorDeCampos = primerError(
      sinCambio("firstName", estilista.first_name)
        ? null
        : errorTexto(form.firstName, { es: "El nombre", en: "The first name" }, LIMITES.nombre, idioma, { obligatorio: true }),
      sinCambio("lastName", estilista.last_name)
        ? null
        : errorTexto(form.lastName, { es: "El apellido", en: "The last name" }, LIMITES.nombre, idioma, { obligatorio: true }),
      sinCambio("email", estilista.email) ? null : errorCorreo(form.email, idioma),
      sinCambio("phone", estilista.phone) ? null : errorTelefono(form.phone, idioma),
      sinCambio("specialization", estilista.specialization)
        ? null
        : errorTexto(form.specialization, { es: "La especialidad", en: "The specialization" }, LIMITES.nombreCorto, idioma),
      Number(form.yearsExperience || 0) === (estilista.years_experience ?? 0)
        ? null
        : errorRango(form.yearsExperience, { es: "Los años de experiencia", en: "Years of experience" }, 0, ANIOS_MAXIMOS, idioma, { entero: true }),
      sinCambio("imageUrl", estilista.image_url) ? null : errorUrl(form.imageUrl, { es: "La URL de la imagen", en: "The image URL" }, idioma, { soloHttps: true }),
      form.branchId ? null : en ? "Choose a branch." : "Elige una sucursal.",
    );
    if (errorDeCampos) {
      setError(errorDeCampos);
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const response = await api("/api/business/stylists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: estilista.id, ...form, available: estilista.available }),
      });
      const cuerpo = await leerJson(response);
      if (!response.ok) {
        setError(typeof cuerpo.error === "string" && cuerpo.error ? cuerpo.error : en ? "Could not save the stylist." : "No se pudo guardar el estilista.");
        return;
      }
      showToast({ type: "success", title: en ? "Stylist updated" : "Estilista actualizado" });
      await onGuardado();
    } catch {
      setError(en ? "Could not reach the server." : "No se pudo contactar al servidor.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div data-editar-estilista className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      <select value={form.branchId} onChange={cambiar("branchId")} className={campo} aria-label={en ? "Branch" : "Sucursal"}>
        <option value="">{en ? "Select a branch" : "Selecciona una sucursal"}</option>
        {sucursales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.branch_name}
          </option>
        ))}
      </select>
      {cambiaDeSucursal ? (
        <p className="text-xs text-amber-700">
          {en
            ? "They will lose the services of their current branch. With upcoming appointments they can't be moved."
            : "Perderá los servicios de su sucursal actual. Con citas próximas no se puede cambiar."}
        </p>
      ) : null}
      <div className="grid gap-2 @sm:grid-cols-2">
        <input className={campo} value={form.firstName} onChange={cambiar("firstName")} maxLength={LIMITES.nombre} placeholder={en ? "First name" : "Nombre"} />
        <input className={campo} value={form.lastName} onChange={cambiar("lastName")} maxLength={LIMITES.nombre} placeholder={en ? "Last name" : "Apellido"} />
      </div>
      <div className="grid gap-2 @sm:grid-cols-2">
        <input className={campo} type="email" value={form.email} onChange={cambiar("email")} maxLength={LIMITES.correo} placeholder="Email" />
        <input className={campo} value={form.phone} onChange={cambiar("phone")} inputMode="numeric" autoComplete="tel" placeholder={en ? "Phone (10 digits)" : "Teléfono (10 dígitos)"} />
      </div>
      <div className="grid gap-2 @sm:grid-cols-2">
        <input className={campo} value={form.specialization} onChange={cambiar("specialization")} maxLength={LIMITES.nombreCorto} placeholder={en ? "Specialization" : "Especialidad"} />
        <input
          className={campo}
          type="number"
          min="0"
          max={ANIOS_MAXIMOS}
          step="1"
          value={form.yearsExperience}
          onChange={cambiar("yearsExperience")}
          placeholder={en ? "Years of experience" : "Años de experiencia"}
        />
      </div>
      <input className={campo} value={form.imageUrl} onChange={cambiar("imageUrl")} maxLength={LIMITES.url} placeholder={en ? "Photo URL (optional)" : "URL de foto (opcional)"} />
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-800">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 @sm:flex-row @sm:justify-end">
        <button type="button" onClick={onCancelar} disabled={guardando} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-70">
          {en ? "Cancel" : "Cancelar"}
        </button>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {guardando ? (en ? "Saving..." : "Guardando...") : en ? "Save changes" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
