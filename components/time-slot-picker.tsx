"use client";

import { useEffect, useState } from "react";

type Slot = {
  time: string;
  isAvailable: boolean;
  iso: string;
};

interface TimeSlotPickerProps {
  businessUserId: string;
  serviceId: string;
  selectedDate: string; // YYYY-MM-DD
  onSelectTime: (isoDateTime: string) => void;
  isLoading?: boolean;
  serviceDuration?: number; // minutos
}

export default function TimeSlotPicker({
  businessUserId,
  serviceId,
  selectedDate,
  onSelectTime,
  isLoading = false,
  serviceDuration = 30,
}: TimeSlotPickerProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(serviceDuration);

  useEffect(() => {
    if (!businessUserId || !serviceId || !selectedDate) {
      setSlots([]);
      return;
    }

    const loadSlots = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/client/appointments/availability?businessUserId=${businessUserId}&serviceId=${serviceId}&date=${selectedDate}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { slots: Slot[]; serviceDuration?: number };
        setSlots(payload.slots ?? []);
        setDuration(payload.serviceDuration ?? serviceDuration);
      } catch (error) {
        console.error("Error loading slots:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadSlots();
  }, [businessUserId, serviceId, selectedDate, serviceDuration]);

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

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-sm text-slate-600">Cargando horarios...</p>
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
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
        {slots.map((slot) => (
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
          ✓ Horario seleccionado: {slots.find((s) => s.iso === selectedTime)?.time} ({duration} min)
        </p>
      )}
    </div>
  );
}
