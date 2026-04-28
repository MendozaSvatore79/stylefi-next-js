"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";
import TimeSlotPicker from "@/components/time-slot-picker";

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

type Branch = {
  id: string;
  branch_name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  phone: string | null;
  image_url: string | null;
  is_primary: boolean;
};

type Service = {
  id: string;
  service_name: string;
  description: string | null;
  price: number | string;
  duration_minutes: number | null;
  image_url: string;
  branch_id?: string | null;
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
  branch_id?: string | null;
};

type PaymentMethod = {
  id: string;
  provider: "card" | "transfer" | "cash" | "wallet" | "paypal";
  card_brand: string | null;
  card_last4: string | null;
  holder_name: string | null;
  paypal_email: string | null;
  is_default: boolean;
};

export default function SalonModal({
  businessId,
  onClose,
}: {
  businessId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { status } = useSession();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"servicios" | "estilistas" | "ubicacion">("servicios");
  const [view, setView] = useState<"profile" | "booking">("profile");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStep, setBookingStep] = useState<"details" | "payment">("details");
  const [requiresAuth, setRequiresAuth] = useState(false);
  const paymentSectionRef = useRef<HTMLDivElement | null>(null);
  const bookingScrollRef = useRef<HTMLDivElement | null>(null);
  const [bookingForm, setBookingForm] = useState({
    serviceId: "",
    scheduledAt: "",
    notes: "",
    paymentProvider: "cash" as "cash" | "wallet" | "card",
    paymentMethodId: "",
  });

  useEffect(() => {
    const fetchDetails = async () => {
      if (status === "unauthenticated") {
        setRequiresAuth(true);
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/businesses?businessId=${businessId}`, {
          cache: "no-store",
        });

        if (res.status === 401) {
          setRequiresAuth(true);
          return;
        }

        if (res.ok) {
          const data = (await res.json()) as {
            business: BusinessDetail;
            branches?: Branch[];
            services: Service[];
            stylists: Stylist[];
          };
          setBusiness(data.business);
          setServices(data.services ?? []);
          setStylists(data.stylists ?? []);
          setBranches(data.branches ?? []);

          // choose default selected branch: primary first, else first branch
          const defaultBranch = (data.branches ?? []).find((b) => b.is_primary) ?? (data.branches && data.branches[0]) ?? null;
          setSelectedBranchId(defaultBranch ? defaultBranch.id : null);
        }

        const paymentMethodsRes = await fetch("/api/client/payment-methods", { cache: "no-store" });
        if (paymentMethodsRes.ok) {
          const paymentMethodsData = (await paymentMethodsRes.json()) as {
            methods?: PaymentMethod[];
            wallet?: { balance: string };
          };

          setPaymentMethods(paymentMethodsData.methods ?? []);
          setWalletBalance(paymentMethodsData.wallet ? Number(paymentMethodsData.wallet.balance) : null);
        }
      } catch (error) {
        console.error(t("modal.loadError"), error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [businessId, status, t]);

  const selectedService = services.find((service) => service.id === bookingForm.serviceId) ?? null;
  const servicesForBranch = selectedBranchId
    ? services.filter((service) => service.branch_id ? String(service.branch_id) === String(selectedBranchId) : false)
    : services;
  const stylistsForBranch = selectedBranchId
    ? stylists.filter((stylist) => stylist.branch_id ? String(stylist.branch_id) === String(selectedBranchId) : false)
    : stylists;
  const savedCardMethods = paymentMethods.filter((method) => method.provider === "card");

  useEffect(() => {
    if (!bookingForm.serviceId) {
      return;
    }

    const serviceStillAvailable = servicesForBranch.some((service) => service.id === bookingForm.serviceId);
    if (!serviceStillAvailable) {
      setBookingForm((current) => ({ ...current, serviceId: "", scheduledAt: "" }));
      setBookingDate("");
      setBookingStep("details");
    }
  }, [bookingForm.serviceId, servicesForBranch]);

  const handleAgendar = () => {
    setView("booking");
    setBookingStep("details");
  };

  const handleBackToProfile = () => {
    setView("profile");
    setBookingStep("details");
    requestAnimationFrame(() => {
      bookingScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
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

    if (bookingForm.paymentProvider === "card" && !bookingForm.paymentMethodId) {
      showToast({
        type: "error",
        title: "Selecciona una tarjeta",
        message: "Debes elegir una tarjeta guardada para continuar.",
      });
      return;
    }

    if (bookingForm.paymentProvider === "card") {
      const selectedCard = savedCardMethods.find((method) => method.id === bookingForm.paymentMethodId);
      if (!selectedCard) {
        showToast({
          type: "error",
          title: "Tarjeta no válida",
          message: "La tarjeta seleccionada no está disponible.",
        });
        return;
      }
    }

    setIsBooking(true);

    try {
      const response = await fetch("/api/client/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessUserId: business.id,
          branchId: selectedBranchId,
          serviceId: selectedService.id,
          serviceName: selectedService.service_name,
          scheduledAt: bookingForm.scheduledAt,
          totalAmount: Number(selectedService.price),
          paymentProvider: bookingForm.paymentProvider,
          paymentMethodId: bookingForm.paymentProvider === "card" ? bookingForm.paymentMethodId : null,
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

  const selectedCard = savedCardMethods.find((method) => method.id === bookingForm.paymentMethodId) ?? null;

  useEffect(() => {
    if (view !== "booking" || bookingStep !== "payment") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [bookingStep, view]);

  useEffect(() => {
    if (view === "profile") {
      bookingScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [view]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="h-96 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl animate-pulse" />
      </div>
    );
  }

  if (requiresAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-md">
        <div className="w-full max-w-xl rounded-3xl border border-white/60 bg-white p-8 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-600">Acceso restringido</p>
          <h2 className="mt-2 text-3xl font-black text-[#151138]">Inicia sesión para ver más detalles</h2>
          <p className="mt-4 text-sm text-slate-600">
            La información completa del salón, servicios, estilistas y agenda está disponible solo para usuarios autenticados.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-xl border border-slate-300 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => router.push("/iniciar-sesion")}
              className="h-11 flex-1 rounded-xl bg-blue-700 font-bold text-white transition hover:bg-blue-800"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!business) {
    return null;
  }

  const selectedDate = bookingDate || bookingForm.scheduledAt.split("T")[0] || "";

  // Determine which branch to show details for (if branches loaded)
  const selectedBranch = branches.find((b) => b.id === selectedBranchId) ?? null;
  const displayPhone = selectedBranch?.phone ?? business.phone ?? null;
  const displayAddress = [selectedBranch?.address, selectedBranch?.city, selectedBranch?.state].filter(Boolean).join(", ") || `${business.address}, ${business.city}`;
  const displayLatitude = selectedBranch?.latitude ?? business.latitude;
  const displayLongitude = selectedBranch?.longitude ?? business.longitude;
  const displayHasLocation = displayLatitude !== null && displayLongitude !== null && Number.isFinite(Number(displayLatitude)) && Number.isFinite(Number(displayLongitude));
  const headerImage = selectedBranch?.image_url || business.image_url;
  const headerLabel = selectedBranch?.branch_name || business.salon_name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 px-4 py-8 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl ring-1 ring-indigo-100/60">
        <div className="relative h-56 bg-linear-to-br from-indigo-100 via-indigo-50 to-purple-100">
          {headerImage && (
            <div
              className="h-full w-full bg-cover bg-center"
              role="img"
              aria-label={headerLabel}
              style={{ backgroundImage: `url(${headerImage})` }}
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
            <h2 className="text-2xl font-black text-white sm:text-3xl">{headerLabel}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/90">{business.description || t("modal.defaultDescription")}</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-6 sm:p-8">
          <div className="h-full overflow-hidden rounded-2xl">
            {view === "profile" ? (
              <div className="h-full overflow-y-auto pr-2">
              <div className="mt-1 flex flex-col gap-3 text-sm">
                {branches.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {branches.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBranchId(b.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${selectedBranchId === b.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200"}`}
                      >
                        {b.branch_name}
                        {b.is_primary ? <span className="ml-2 text-[10px] font-bold text-emerald-700">Principal</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {displayPhone ? (
                    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                      <span>📱</span>
                      <span>{displayPhone}</span>
                    </div>
                  ) : null}
                  {displayAddress ? (
                    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                      <span>📍</span>
                      <span>{displayAddress}</span>
                    </div>
                  ) : null}
                </div>
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
              {servicesForBranch.length === 0 ? (
                <p className="py-8 text-center text-slate-600">{t("modal.noServices")}</p>
              ) : (
                servicesForBranch.map((service: any) => (
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
                stylistsForBranch.map((stylist) => (
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
              {displayHasLocation ? (
                <>
                  <div className="flex h-80 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps?q=${displayLatitude},${displayLongitude}&z=16&output=embed`}
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <p className="text-sm text-slate-600">
                      <strong>Dirección:</strong> {displayAddress}
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
            ) : (
              <div ref={bookingScrollRef} className="h-full overflow-y-auto pl-0 pr-1">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">{t("modal.quickBooking")}</p>
                <h3 className="mt-2 text-xl font-black text-[#151138]">{t("modal.bookTitle")}</h3>
                <p className="mt-1 text-sm text-slate-600">{t("modal.bookSubtitle")} {headerLabel}.</p>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Flujo de reserva</p>
                  <p className="text-sm font-bold text-[#151138]">
                    {bookingStep === "payment" ? "Paso 2 de 2 · Pago" : "Paso 1 de 2 · Datos y horario"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackToProfile}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t("modal.back")}
                </button>
              </div>

              <div className="mt-5 flex min-h-0 flex-col gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("modal.service")}</label>
                  <select
                    value={bookingForm.serviceId}
                    onChange={(event) => setBookingForm((current) => ({ ...current, serviceId: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
                  >
                    <option value="">{t("modal.selectService")}</option>
                    {servicesForBranch.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.service_name} · ${Number(service.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("modal.dateTime")}</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      setBookingDate(nextDate);
                      setBookingForm((current) => ({ ...current, scheduledAt: "" }));
                    }}
                    min={new Date().toISOString().split("T")[0]}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
                  />
                </div>

                {bookingForm.serviceId && selectedDate ? (
                  <TimeSlotPicker
                    key={`${bookingForm.serviceId}-${selectedDate}`}
                    businessUserId={business.id}
                    serviceId={bookingForm.serviceId}
                    selectedDate={selectedDate}
                    serviceDuration={selectedService?.duration_minutes ?? 30}
                    onSelectTime={(isoDateTime) => {
                      setBookingForm((current) => ({
                        ...current,
                        scheduledAt: isoDateTime,
                      }));
                      setBookingStep("payment");
                    }}
                  />
                ) : null}

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

                <div ref={paymentSectionRef} className="scroll-mt-6">
                  {bookingStep === "payment" ? (
                    <>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("modal.payment")}</label>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Paso 2 de 2</p>
                        <p className="text-xs text-slate-500">Último paso para confirmar</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setBookingForm((current) => ({ ...current, paymentProvider: "cash", paymentMethodId: "" }))}
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
                          onClick={() => setBookingForm((current) => ({ ...current, paymentProvider: "wallet", paymentMethodId: "" }))}
                          className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                            bookingForm.paymentProvider === "wallet"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          Saldo wallet
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookingForm((current) => ({ ...current, paymentProvider: "card" }))}
                          className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                            bookingForm.paymentProvider === "card"
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          Tarjeta guardada
                        </button>
                      </div>
                      {bookingForm.paymentProvider === "wallet" ? (
                        <p className="mt-2 text-xs text-slate-600">
                          {walletBalance !== null
                            ? `${t("modal.availableBalance")} $${walletBalance.toFixed(2)}`
                            : t("modal.noBalance")}
                        </p>
                      ) : bookingForm.paymentProvider === "card" ? (
                        <div className="mt-2 space-y-2">
                          <select
                            value={bookingForm.paymentMethodId}
                            onChange={(event) => setBookingForm((current) => ({ ...current, paymentMethodId: event.target.value }))}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
                          >
                            <option value="">Selecciona una tarjeta guardada</option>
                            {savedCardMethods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {`${(method.card_brand || "Tarjeta").toUpperCase()} •••• ${method.card_last4 || "0000"}`}
                              </option>
                            ))}
                          </select>
                          {selectedCard ? (
                            <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                              Se cobrará directamente a {`${(selectedCard.card_brand || "tarjeta").toUpperCase()} •••• ${selectedCard.card_last4 || "0000"}`}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-600">
                              No hay tarjetas guardadas disponibles. Ve a Pagos para agregar una.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-600">{t("modal.payAtSalon")}</p>
                      )}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-5 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Paso 2 de 2</p>
                      <p className="mt-2 text-sm text-slate-700">Selecciona un horario disponible para mostrar el método de pago.</p>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white/95 pt-4 backdrop-blur-sm">
                  {selectedService ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                      {t("modal.estimatedTotal")} ${Number(selectedService.price).toFixed(2)}
                    </p>
                  ) : null}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleBackToProfile}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
