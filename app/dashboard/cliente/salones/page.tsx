"use client";

import { useEffect, useState } from "react";
import SalonModal from "@/components/salon-modal";
import { useLanguage } from "@/lib/language-context";

type Business = {
  id: string;
  business_name: string;
  first_name: string;
  last_name: string;
  salon_name: string;
  description: string;
  address?: string | null;
  city: string;
  state?: string | null;
  image_url: string;
};

type FavoriteBusiness = {
  business_user_id: string;
  business_name: string;
  first_name: string;
  last_name: string;
  salon_name: string;
  description: string;
  address?: string | null;
  city: string;
  state?: string | null;
  image_url: string;
};

export default function SalonesPage() {
  const { t } = useLanguage();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [businessesRes, favoritesRes, onboardingRes] = await Promise.all([
          fetch("/api/businesses", { cache: "no-store" }),
          fetch("/api/client/favorites", { cache: "no-store" }),
          fetch("/api/client/onboarding", { cache: "no-store" }),
        ]);

        if (businessesRes.ok) {
          const data = (await businessesRes.json()) as { businesses: Business[] };
          setBusinesses(data.businesses ?? []);
        }

        if (favoritesRes.ok) {
          const data = (await favoritesRes.json()) as { favorites: FavoriteBusiness[] };
          setFavorites(data.favorites ?? []);
        }

        if (onboardingRes.ok) {
          const data = (await onboardingRes.json()) as { seen: boolean };
          setShowOnboarding(!data.seen);
        }
      } catch (error) {
        console.error("Error cargando datos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchInitialData();
  }, []);

  const favoriteIds = new Set(favorites.map((item) => item.business_user_id));

  const getLocationSummary = (location: { city?: string | null; state?: string | null; address?: string | null }) => {
    const city = location.city?.trim();
    const state = location.state?.trim();
    const address = location.address?.trim();

    if (city && state) {
      return `${city}, ${state}`;
    }

    if (city) {
      return city;
    }

    if (state) {
      return state;
    }

    if (address) {
      return address.length > 42 ? `${address.slice(0, 42)}…` : address;
    }

    return t("salons.cityUnknown");
  };

  const toggleFavorite = async (businessId: string) => {
    try {
      setFavoriteLoadingId(businessId);
      const isFavorite = favoriteIds.has(businessId);

      const response = await fetch("/api/client/favorites", {
        method: isFavorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessUserId: businessId }),
      });

      if (!response.ok) {
        return;
      }

      if (isFavorite) {
        setFavorites((current) => current.filter((item) => item.business_user_id !== businessId));
      } else {
        const business = businesses.find((item) => item.id === businessId);
        if (!business) {
          return;
        }

        setFavorites((current) => [
          {
            business_user_id: business.id,
            business_name: business.business_name,
            first_name: business.first_name,
            last_name: business.last_name,
            salon_name: business.salon_name,
            description: business.description,
            address: business.address,
            city: business.city,
            state: business.state,
            image_url: business.image_url,
          },
          ...current,
        ]);
      }
    } catch (error) {
      console.error("Error actualizando favorito:", error);
    } finally {
      setFavoriteLoadingId(null);
    }
  };

  const completeOnboarding = async () => {
    try {
      await fetch("/api/client/onboarding", {
        method: "POST",
      });
    } catch (error) {
      console.error("Error actualizando onboarding:", error);
    } finally {
      setShowOnboarding(false);
    }
  };

  return (
    <section className="space-y-8">
      <div className="stagger-enter relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm" style={{ animationDelay: "80ms" }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-100 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-purple-100 blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
            {t("salons.badge")}
          </span>
          <h2 className="mt-4 text-3xl font-black text-[#151138] sm:text-4xl">{t("salons.title")}</h2>
          <p className="mt-2 max-w-2xl text-slate-600">{t("salons.subtitle")}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <span>🏢</span>
            <span>
              {businesses.length} {t("salons.available")}
            </span>
          </div>
        </div>
      </div>

      {favorites.length > 0 ? (
        <div className="stagger-enter space-y-4" style={{ animationDelay: "140ms" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[#151138]">{t("salons.favorites")}</h3>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
              {favorites.length} {t("salons.saved")}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.slice(0, 3).map((favorite, index) => (
              <button
                key={favorite.business_user_id}
                onClick={() => setSelectedBusiness(favorite.business_user_id)}
                className="stagger-enter rounded-2xl border border-rose-200 bg-linear-to-r from-rose-50 to-white p-4 text-left shadow-sm transition hover:shadow-md"
                style={{ animationDelay: `${220 + index * 80}ms` }}
              >
                <p className="font-bold text-[#151138]">{favorite.salon_name || favorite.business_name}</p>
                <p className="mt-1 line-clamp-1 text-sm text-slate-600">{getLocationSummary(favorite)}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-88 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-44 animate-pulse rounded-2xl bg-linear-to-br from-slate-100 to-slate-200" />
              <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-200" />
              <div className="mt-5 h-8 w-28 animate-pulse rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white px-8 py-16 text-center shadow-sm">
          <p className="text-4xl">🏢</p>
          <p className="mt-4 text-lg font-bold text-[#151138]">{t("salons.noAvailable")}</p>
          <p className="mt-2 text-slate-600">{t("salons.noAvailableDesc")}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business, index) => (
            <article
              key={business.id}
              className="stagger-enter group relative overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-200/40"
              style={{ animationDelay: `${260 + index * 90}ms` }}
            >
              <button
                type="button"
                onClick={() => void toggleFavorite(business.id)}
                className={`absolute left-3 top-3 z-10 h-8 w-8 rounded-full border border-white/40 bg-black/20 text-sm text-white backdrop-blur-sm transition hover:bg-black/35 ${
                  favoriteLoadingId === business.id ? "opacity-60" : ""
                }`}
                aria-label={t("salons.favLabel")}
              >
                {favoriteIds.has(business.id) ? "❤" : "♡"}
              </button>

              <div className="absolute right-3 top-3 z-10 rounded-full border border-white/40 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                {t("salons.verified")}
              </div>

              <button
                type="button"
                onClick={() => setSelectedBusiness(business.id)}
                className="block w-full"
              >
              <div className="relative h-48 overflow-hidden bg-linear-to-br from-indigo-100 to-purple-100">
                {business.image_url ? (
                  <img
                    src={business.image_url}
                    alt={business.salon_name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl">💇</div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/35 via-black/0 to-transparent" />
              </div>

              <div className="p-6">
                <h3 className="text-xl font-black text-[#151138] transition-colors group-hover:text-indigo-600">
                  {business.salon_name || business.business_name}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                  {business.description || t("salons.descriptionFallback")}
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
                  <span>📍</span>
                  <span>{getLocationSummary(business)}</span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    {t("salons.viewServices")}
                  </span>
                  <span className="text-lg transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
              </button>
            </article>
          ))}
        </div>
      )}

      {selectedBusiness && (
        <SalonModal businessId={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
      )}

      {showOnboarding ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="stagger-enter w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl" style={{ animationDelay: "60ms" }}>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">{t("salons.welcomeBrand")}</p>
            <h3 className="mt-2 text-3xl font-black text-[#151138]">{t("salons.welcomeTitle")}</h3>
            <p className="mt-3 text-slate-600">{t("salons.welcomeSubtitle")}</p>

            <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>✅ {t("salons.welcome1")}</p>
              <p>✅ {t("salons.welcome2")}</p>
              <p>✅ {t("salons.welcome3")}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowOnboarding(false)}
                className="h-11 flex-1 rounded-xl border border-slate-300 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t("salons.later")}
              </button>
              <button
                type="button"
                onClick={() => void completeOnboarding()}
                className="h-11 flex-1 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 font-bold text-white transition hover:shadow-lg"
              >
                {t("salons.start")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
