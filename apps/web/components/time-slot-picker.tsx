"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Slot = {
  time: string;
  isAvailable: boolean;
  iso: string;
};

interface TimeSlotPickerProps {
  businessUserId: string;
  serviceId: string;
  branchId?: string | null;
  stylistId?: string | null; // null o vacío = cualquiera
  selectedDate: string; // YYYY-MM-DD
  onSelectTime: (isoDateTime: string) => void;
  isLoading?: boolean;
  serviceDuration?: number; // minutos
}

export default function TimeSlotPicker({
  businessUserId,
  serviceId,
  branchId = null,
  stylistId = null,
  selectedDate,
  onSelectTime,
  isLoading = false,
  serviceDuration = 30,
}: TimeSlotPickerProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(serviceDuration);

  // Sin negocio, servicio o fecha no hay horarios que mostrar: se deriva en el render, sin vaciar el estado en el efecto
  const faltanDatos = !businessUserId || !serviceId || !selectedDate;

  useEffect(() => {
    if (!businessUserId || !serviceId || !selectedDate) {
      return;
    }

    // Si cambia la fecha (o el servicio) antes de que responda, la respuesta vieja ya no pisa los horarios nuevos
    let vigente = true;
    const loadSlots = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ businessUserId, serviceId, date: selectedDate });
        if (branchId) params.set("branchId", branchId);
        if (stylistId) params.set("stylistId", stylistId);
        const response = await api(`/api/client/appointments/availability?${params}`, { cache: "no-store" });
        if (!response.ok || !vigente) {
          return;
        }
        const payload = (await response.json()) as { slots: Slot[]; serviceDuration?: number };
        if (!vigente) {
          return;
        }
        setSlots(payload.slots ?? []);
        setDuration(payload.serviceDuration ?? serviceDuration);
      } catch (error) {
        console.error("Error loading slots:", error);
      } finally {
        if (vigente) {
          setLoading(false);
        }
      }
    };

    void loadSlots();
    return () => {
      vigente = false;
    };
  }, [businessUserId, serviceId, branchId, stylistId, selectedDate, serviceDuration]);

  const handleSelectTime = (slot: Slot) => {
    if (!slot.isAvailable) return;
    setSelectedTime(slot.iso);
    onSelectTime(slot.iso);
  };

  if (!businessUserId || !selectedDate) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center">
        <p className="text-sm text-slate-600">Selecciona negocio, servicio y fecha para ver horarios disponibles</p>
      </div>
    );
  }

  const visibles = faltanDatos ? [] : slots;

  if ((loading && !faltanDatos) || isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-sm text-slate-600">Cargando horarios...</p>
        </div>
      </div>
    );
  }

  if (visibles.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 py-8 text-center">
        <p className="text-sm text-amber-700">No hay horarios disponibles para esta fecha</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Horarios disponibles ({duration} min cada uno)
      </label>
      <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
        {visibles.map((slot) => (
          <button
            key={slot.time}
            type="button"
            onClick={() => handleSelectTime(slot)}
            disabled={!slot.isAvailable}
            className={`relative py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              slot.isAvailable
                ? selectedTime === slot.iso
                  ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer"
                : "bg-red-100 text-red-500 cursor-not-allowed opacity-60"
            }`}
          >
            {slot.time}
            {!slot.isAvailable && (
              <span className="absolute top-0.5 right-0.5 text-xs" title="Ocupado">
                ✕
              </span>
            )}
          </button>
        ))}
      </div>
      {selectedTime && (
        <p className="text-xs text-emerald-700 mt-2">
          ✓ Horario seleccionado: {visibles.find((s) => s.iso === selectedTime)?.time} ({duration} min)
        </p>
      )}
    </div>
  );
}
