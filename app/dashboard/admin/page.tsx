"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BranchVerification = {
  id: string;
  branch_name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  image_url: string | null;
  ownership_proof_url: string | null;
  validation_status: "pending" | "approved" | "rejected";
  validation_notes: string | null;
  created_at: string;
  verified_at: string | null;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

export default function AdminDashboardPage() {
  const [branches, setBranches] = useState<BranchVerification[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadBranches = async () => {
    const response = await fetch("/api/admin/branch-verifications?status=pending", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { branches: BranchVerification[] };
    setBranches(payload.branches ?? []);
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  const pendingCount = useMemo(() => branches.length, [branches.length]);

  const reviewBranch = async (branchId: string, status: "approved" | "rejected") => {
    try {
      setLoadingId(branchId);
      const response = await fetch("/api/admin/branch-verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          status,
          reviewer: "admin-panel",
          notes: status === "approved" ? "Información verificada por administración." : "Rechazada por revisión administrativa.",
        }),
      });

      if (!response.ok) {
        return;
      }

      setBranches((current) => current.filter((branch) => branch.id !== branchId));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#ececef] px-6 py-10 text-slate-900 sm:px-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Dashboard Admin</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-[#151138]">Verificación de sucursales</h1>
            <p className="mt-3 text-sm text-slate-600">Aprueba o rechaza sucursales nuevas según imagen y comprobante de propiedad.</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pendientes</p>
            <p className="text-2xl font-black text-amber-900">{pendingCount}</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {branches.map((branch) => (
            <article key={branch.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-[#151138]">{branch.branch_name}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {branch.business_name || `${branch.first_name ?? ""} ${branch.last_name ?? ""}`.trim() || "Negocio"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{branch.email}</p>
                  <p className="mt-2 text-sm text-slate-600">{branch.address || "Sin dirección"}</p>
                  <p className="text-sm text-slate-600">{[branch.city, branch.state].filter(Boolean).join(", ")}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {branch.image_url ? (
                    <a
                      href={branch.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                    >
                      Ver imagen
                    </a>
                  ) : null}
                  {branch.ownership_proof_url ? (
                    <a
                      href={branch.ownership_proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Ver comprobante
                    </a>
                  ) : (
                    <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                      Sin comprobante
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={loadingId === branch.id}
                  onClick={() => void reviewBranch(branch.id, "approved")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loadingId === branch.id ? "Procesando..." : "Aprobar"}
                </button>
                <button
                  type="button"
                  disabled={loadingId === branch.id}
                  onClick={() => void reviewBranch(branch.id, "rejected")}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Rechazar
                </button>
              </div>
            </article>
          ))}

          {branches.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              No hay sucursales pendientes por validar.
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#130b3a] px-5 text-sm font-semibold text-white transition hover:bg-[#231365]"
          >
            Ir al inicio
          </Link>
          <Link
            href="/iniciar-sesion"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Cerrar / volver
          </Link>
        </div>
      </section>
    </main>
  );
}
