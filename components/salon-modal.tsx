"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type BusinessDetail = {
  id: string;
  business_name: string;
  salon_name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  latitude: number | string | null;
  longitude: number | string | null;
  phone: string;
  image_url: string;
};

type Service = {
  id: string;
  service_name: string;
  description: string | null;
  price: number | string;
  duration_minutes: number | null;
  image_url: string;
};

type Stylist = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  specialization: string;
  years_experience: number;
  image_url: string;
  available: boolean;
};

export default function SalonModal({
  businessId,
  onClose,
}: {
  businessId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"servicios" | "estilistas" | "ubicacion">("servicios");
  const [view, setView] = useState<"profile" | "booking">("profile");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    serviceId: "",
    scheduledAt: "",
    notes: "",
    paymentProvider: "cash" as "cash" | "wallet",
  });

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/businesses?businessId=${businessId}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as {
            business: BusinessDetail;
            services: Service[];
            stylists: Stylist[];
          };
          setBusiness(data.business);
          setServices(data.services ?? []);
          setStylists(data.stylists ?? []);
        }

        const walletRes = await fetch("/api/client/payment-methods", { cache: "no-store" });
        if (walletRes.ok) {
          const walletData = (await walletRes.json()) as { wallet?: { balance: string } };
          setWalletBalance(walletData.wallet ? Number(walletData.wallet.balance) : null);
        }
      } catch (error) {
        console.error(t("modal.loadError"), error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [businessId]);

  const selectedService = services.find((service) => service.id === bookingForm.serviceId) ?? null;

  const handleAgendar = () => {
    setView("booking");
  };

  const handleSubmitBooking = async () => {
    if (!business || !selectedService || !bookingForm.scheduledAt) {
      showToast({
        type: "error",
        title: t("modal.completeBooking"),
        message: t("modal.selectServiceDate"),
      });
      return;
    }

    if (bookingForm.paymentProvider === "wallet" && walletBalance !== null && walletBalance < Number(selectedService.price)) {
      showToast({
        type: "error",
        title: t("modal.insufficientBalance"),
        message: t("modal.insufficientBalanceText"),
      });
      return;
    }

    setIsBooking(true);

    try {
      const response = await fetch("/api/client/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessUserId: business.id,
          serviceName: selectedService.service_name,
          scheduledAt: bookingForm.scheduledAt,
          totalAmount: Number(selectedService.price),
          paymentProvider: bookingForm.paymentProvider,
          notes: bookingForm.notes || null,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo agendar la cita.");
      }

      showToast({
        type: "success",
        title: t("modal.bookSuccess"),
        message: t("modal.bookSuccessMsg"),
      });

      onClose();
      router.push("/dashboard/cliente/citas");
    } catch (error) {
      showToast({
        type: "error",
        title: t("modal.bookFail"),
        message: error instanceof Error ? error.message : t("security.cantLoad"),
      });
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="h-96 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl animate-pulse" />
      </div>
    );
  }

  if (!business) {
    return null;
  }

  const latitude = business.latitude === null ? null : Number(business.latitude);
  const longitude = business.longitude === null ? null : Number(business.longitude);
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 px-4 py-8 backdrop-blur-md">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl ring-1 ring-indigo-100/60">
        <div className="relative h-56 bg-linear-to-br from-indigo-100 via-indigo-50 to-purple-100">
          {business.image_url && (
            <img
              src={business.image_url}
              alt={business.salon_name}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/45 via-black/5 to-transparent" />
          <div className="absolute left-6 top-6 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            {t("modal.salonProfile")}
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/90 bg-white text-slate-700 shadow-lg transition-colors hover:bg-slate-100"
            aria-label={t("modal.close")}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div className="absolute bottom-6 left-6 right-6">
            <h2 className="text-2xl font-black text-white sm:text-3xl">{business.salon_name}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/90">{business.description || t("modal.defaultDescription")}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="overflow-hidden rounded-2xl">
            <div
            className={`flex w-[200%] will-change-transform transition-transform duration-500 ease-in-out ${
              view === "booking" ? "-translate-x-1/2" : "translate-x-0"
            }`}
          >
            <div className="w-1/2 shrink-0 box-border">
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {business.phone && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                <span>📱</span>
                <span>{business.phone}</span>
              </div>
            )}
            {business.address && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                <span>📍</span>
                <span>{business.address}, {business.city}</span>
              </div>
            )}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100/90 p-1.5">
            {["servicios", "estilistas", "ubicacion"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as "servicios" | "estilistas" | "ubicacion")}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                  activeTab === tab
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab === "servicios" && t("modal.services")}
                {tab === "estilistas" && t("modal.stylists")}
                {tab === "ubicacion" && t("modal.location")}
              </button>
            ))}
              </div>

              {activeTab === "servicios" && (
                <div className="mt-6 max-h-96 space-y-4 overflow-y-auto pr-1">
              {services.length === 0 ? (
                <p className="py-8 text-center text-slate-600">{t("modal.noServices")}</p>
              ) : (
                services.map((service) => (
                  <div key={service.id} className="rounded-2xl border border-slate-200 bg-linear-to-r from-white to-slate-50 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900">{service.service_name}</h4>
                        <p className="mt-1 text-sm text-slate-600">{service.description}</p>
                        {service.duration_minutes && (
                          <p className="mt-2 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">⏱️ {service.duration_minutes} min</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-indigo-700">${Number(service.price).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
                </div>
              )}

              {activeTab === "estilistas" && (
                <div className="mt-6 max-h-96 space-y-4 overflow-y-auto pr-1">
              {stylists.length === 0 ? (
                <p className="py-8 text-center text-slate-600">{t("modal.noStylists")}</p>
              ) : (
                stylists.map((stylist) => (
                  <div key={stylist.id} className="rounded-2xl border border-slate-200 bg-linear-to-r from-white to-slate-50 p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-purple-500 text-white font-bold">
                        {stylist.first_name[0]}{stylist.last_name[0]}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900">
                          {stylist.first_name} {stylist.last_name}
                        </h4>
                        {stylist.specialization && (
                          <p className="mt-1 text-sm text-slate-600">{stylist.specialization}</p>
                        )}
                        {stylist.years_experience && (
                          <p className="mt-1 text-xs text-slate-500">
                            {stylist.years_experience} años de experiencia
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            stylist.available
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {stylist.available ? t("modal.available") : t("modal.unavailable")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
                </div>
              )}

              {activeTab === "ubicacion" && (
                <div className="mt-6 space-y-4">
              {hasLocation ? (
                <>
                  <div className="flex h-80 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`}
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <p className="text-sm text-slate-600">
                      <strong>Dirección:</strong> {business.address}, {business.city}, {business.state}
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-slate-600">La ubicación no está disponible en este momento.</p>
                    <p className="text-slate-600">{t("modal.locationUnavailable")}</p>
                </div>
              )}
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              onClick={onClose}
              className="rounded-2xl border-2 border-slate-300 px-6 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {t("modal.closeButton")}
            </button>
            <button
              onClick={handleAgendar}
              className="rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 px-6 py-3 font-bold text-white transition-shadow hover:shadow-lg"
            >
              {t("modal.bookButton")}
            </button>
              </div>
            </div>

            <div className="w-1/2 shrink-0 box-border">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">{t("modal.quickBooking")}</p>
                <h3 className="mt-2 text-xl font-black text-[#151138]">{t("modal.bookTitle")}</h3>
                <p className="mt-1 text-sm text-slate-600">{t("modal.bookSubtitle")} {business.salon_name}.</p>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("modal.service")}</label>
                  <select
                    value={bookingForm.serviceId}
                    onChange={(event) => setBookingForm((current) => ({ ...current, serviceId: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
                  >
                    <option value="">{t("modal.selectService")}</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.service_name} · ${Number(service.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("modal.dateTime")}</label>
                  <input
                    type="datetime-local"
                    value={bookingForm.scheduledAt}
                    onChange={(event) => setBookingForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("modal.notes")}</label>
                  <textarea
                    rows={3}
                    value={bookingForm.notes}
                    onChange={(event) => setBookingForm((current) => ({ ...current, notes: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring"
                    placeholder={t("modal.bookingPlaceholder")}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("modal.payment")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBookingForm((current) => ({ ...current, paymentProvider: "cash" }))}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        bookingForm.paymentProvider === "cash"
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {t("modal.cashLocal")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingForm((current) => ({ ...current, paymentProvider: "wallet" }))}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        bookingForm.paymentProvider === "wallet"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {t("modal.wallet")}
                    </button>
                  </div>
                  {bookingForm.paymentProvider === "wallet" ? (
                    <p className="mt-2 text-xs text-slate-600">
                      {walletBalance !== null
                        ? `${t("modal.availableBalance")} $${walletBalance.toFixed(2)}`
                        : t("modal.noBalance")}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">{t("modal.payAtSalon")}</p>
                  )}
                </div>

                {selectedService ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    {t("modal.estimatedTotal")} ${Number(selectedService.price).toFixed(2)}
                  </p>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setView("profile")}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {t("modal.back")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmitBooking()}
                    disabled={isBooking}
                    className="rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isBooking ? t("modal.booking") : t("modal.confirmBook")}
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
