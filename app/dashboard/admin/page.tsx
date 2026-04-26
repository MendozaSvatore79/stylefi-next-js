"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, LayoutGrid, ShieldCheck } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type ModuleStatus = "online" | "degraded" | "offline";

type AdminLiveModule = {
  key: string;
  title: string;
  description: string;
  status: ModuleStatus;
  primaryStat: string;
  secondaryStat: string;
  isEnabled: boolean;
  isMaintenance: boolean;
  pathPrefix: string | null;
};

type BranchActionDialogState = {
  branchId: string;
  status: "approved" | "rejected";
  branchName: string;
} | null;

type ModuleActionDialogState = {
  moduleKey: string;
  moduleTitle: string;
  updates: { isEnabled?: boolean; isMaintenance?: boolean };
  actionLabel: string;
} | null;

const statusLabel: Record<ModuleStatus, string> = {
  online: "Online",
  degraded: "Desactivado",
  offline: "Offline",
};

const statusVariantByModuleStatus: Record<ModuleStatus, "success" | "warning" | "danger"> = {
  online: "success",
  degraded: "warning",
  offline: "danger",
};

export default function AdminDashboardPage() {
  const [branches, setBranches] = useState<BranchVerification[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [liveModules, setLiveModules] = useState<AdminLiveModule[]>([]);
  const [liveDashboardStatus, setLiveDashboardStatus] = useState<ModuleStatus>("offline");
  const [liveLoading, setLiveLoading] = useState<boolean>(true);
  const [liveSavingKey, setLiveSavingKey] = useState<string | null>(null);
  const [branchQuery, setBranchQuery] = useState("");
  const [moduleQuery, setModuleQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [branchActionDialog, setBranchActionDialog] = useState<BranchActionDialogState>(null);
  const [moduleActionDialog, setModuleActionDialog] = useState<ModuleActionDialogState>(null);

  const loadBranches = async () => {
    const response = await fetch("/api/admin/branch-verifications?status=pending", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { branches: BranchVerification[] };
    setBranches(payload.branches ?? []);
  };

  const loadLiveDashboard = async () => {
    setLiveLoading(true);

    try {
      const response = await fetch("/api/admin/live-dashboard", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        overallStatus: ModuleStatus;
        modules: AdminLiveModule[];
      };

      setLiveModules(payload.modules ?? []);
      setLiveDashboardStatus(payload.overallStatus ?? "offline");
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadBranches(), loadLiveDashboard()]);
  }, []);

  const refreshDashboard = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadBranches(), loadLiveDashboard()]);
    } finally {
      setRefreshing(false);
    }
  };

  const pendingCount = useMemo(() => branches.length, [branches.length]);

  const liveSummary = useMemo(() => {
    const total = liveModules.length;
    const enabled = liveModules.filter((module) => module.isEnabled).length;
    const maintenance = liveModules.filter((module) => module.isEnabled && module.isMaintenance).length;
    const disabled = liveModules.filter((module) => !module.isEnabled).length;
    return { total, enabled, maintenance, disabled };
  }, [liveModules]);

  const filteredBranches = useMemo(() => {
    const query = branchQuery.trim().toLowerCase();
    if (!query) {
      return branches;
    }

    return branches.filter((branch) => {
      const owner = branch.business_name || `${branch.first_name ?? ""} ${branch.last_name ?? ""}`.trim();
      const location = [branch.city, branch.state].filter(Boolean).join(" ");
      return [branch.branch_name, owner, branch.email, branch.address, location].join(" ").toLowerCase().includes(query);
    });
  }, [branches, branchQuery]);

  const filteredModules = useMemo(() => {
    const query = moduleQuery.trim().toLowerCase();
    if (!query) {
      return liveModules;
    }

    return liveModules.filter((module) => {
      return [module.title, module.description, module.pathPrefix, module.primaryStat, module.secondaryStat]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [liveModules, moduleQuery]);

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

  const updateLiveModule = async (moduleKey: string, updates: { isEnabled?: boolean; isMaintenance?: boolean }) => {
    try {
      setLiveSavingKey(moduleKey);
      const response = await fetch("/api/admin/live-dashboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, ...updates }),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        overallStatus: ModuleStatus;
        modules: AdminLiveModule[];
      };

      setLiveModules(payload.modules ?? []);
      setLiveDashboardStatus(payload.overallStatus ?? "offline");
    } finally {
      setLiveSavingKey(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="border-slate-200 bg-linear-to-r from-[#13193a] to-[#1f2d64] text-white shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-3xl font-black text-white">Centro de control administrativo</CardTitle>
          <CardDescription className="text-white/80">
            Opera verificaciones, gobierno de módulos y estabilidad de la plataforma desde una sola consola.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="border-white/20 bg-white/10 text-white">
              <ShieldCheck className="mr-1 size-3.5" /> Panel oficial
            </Badge>
            <Badge variant="secondary" className="border-white/20 bg-white/10 text-white">
              Estado: {statusLabel[liveDashboardStatus]}
            </Badge>
          </div>
          <Button variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={() => void refreshDashboard()}>
            {refreshing ? "Actualizando..." : "Actualizar datos"}
          </Button>
        </CardContent>
      </Card>

      <section id="metricas" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sucursales pendientes</CardDescription>
            <CardTitle className="text-3xl font-black">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Módulos activos</CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-700">{liveSummary.enabled}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>En mantenimiento</CardDescription>
            <CardTitle className="text-3xl font-black text-amber-700">{liveSummary.maintenance}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Desactivados</CardDescription>
            <CardTitle className="text-3xl font-black text-red-700">{liveSummary.disabled}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumen">
            <LayoutGrid className="size-4" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="verificaciones" id="verificaciones">
            <ShieldCheck className="size-4" /> Verificaciones
          </TabsTrigger>
          <TabsTrigger value="modulos" id="modulos">
            <Clock3 className="size-4" /> Módulos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <Card>
            <CardHeader>
              <CardTitle>Resumen operativo</CardTitle>
              <CardDescription>Vista ejecutiva de salud y control administrativo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Estado general</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{statusLabel[liveDashboardStatus]}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Módulos totales</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{liveSummary.total}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verificaciones">
          <Card>
            <CardHeader>
              <CardTitle>Verificación de sucursales</CardTitle>
              <CardDescription>Revisa evidencia de propiedad antes de aprobar publicación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={branchQuery} onChange={(event) => setBranchQuery(event.target.value)} placeholder="Buscar por sucursal, negocio, correo o ciudad" />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Negocio</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Evidencia</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBranches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-semibold text-slate-900">{branch.branch_name}</TableCell>
                      <TableCell>{branch.business_name || `${branch.first_name ?? ""} ${branch.last_name ?? ""}`.trim() || "Negocio"}</TableCell>
                      <TableCell>{branch.email}</TableCell>
                      <TableCell>{[branch.city, branch.state].filter(Boolean).join(", ") || "Sin ubicación"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {branch.image_url ? (
                            <a href={branch.image_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-700 hover:underline">
                              Imagen
                            </a>
                          ) : null}
                          {branch.ownership_proof_url ? (
                            <a href={branch.ownership_proof_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-700 hover:underline">
                              Comprobante
                            </a>
                          ) : (
                            <Badge variant="danger">Sin comprobante</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              setBranchActionDialog({
                                branchId: branch.id,
                                status: "approved",
                                branchName: branch.branch_name,
                              })
                            }
                            disabled={loadingId === branch.id}
                          >
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setBranchActionDialog({
                                branchId: branch.id,
                                status: "rejected",
                                branchName: branch.branch_name,
                              })
                            }
                            disabled={loadingId === branch.id}
                          >
                            Rechazar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredBranches.length === 0 ? <p className="text-sm text-slate-500">No hay sucursales pendientes para el filtro actual.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modulos">
          <Card>
            <CardHeader>
              <CardTitle>Gobierno de módulos oficiales</CardTitle>
              <CardDescription>Activa, desactiva o manda a mantenimiento cada módulo del sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={moduleQuery} onChange={(event) => setModuleQuery(event.target.value)} placeholder="Buscar módulo por nombre, ruta o stat" />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Estado técnico</TableHead>
                    <TableHead>Stat</TableHead>
                    <TableHead className="text-right">Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModules.map((module) => (
                    <TableRow key={module.key}>
                      <TableCell>
                        <p className="font-semibold text-slate-900">{module.title}</p>
                        <p className="text-xs text-slate-500">{module.description}</p>
                      </TableCell>
                      <TableCell className="text-xs">{module.pathPrefix || "Sin ruta"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariantByModuleStatus[module.status]}>{statusLabel[module.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-900">{module.primaryStat}</p>
                        <p className="text-xs text-slate-500">{module.secondaryStat}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant={module.isEnabled ? "destructive" : "default"}
                            disabled={liveSavingKey === module.key}
                            onClick={() =>
                              setModuleActionDialog({
                                moduleKey: module.key,
                                moduleTitle: module.title,
                                updates: { isEnabled: !module.isEnabled },
                                actionLabel: module.isEnabled ? "desactivar" : "activar",
                              })
                            }
                          >
                            {module.isEnabled ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={liveSavingKey === module.key || !module.isEnabled}
                            onClick={() =>
                              setModuleActionDialog({
                                moduleKey: module.key,
                                moduleTitle: module.title,
                                updates: { isMaintenance: !module.isMaintenance },
                                actionLabel: module.isMaintenance ? "quitar mantenimiento" : "poner en mantenimiento",
                              })
                            }
                          >
                            {module.isMaintenance ? "Quitar mantenimiento" : "Mantenimiento"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!liveLoading && filteredModules.length === 0 ? <p className="text-sm text-slate-500">No hay módulos para el filtro actual.</p> : null}
              {liveLoading ? <p className="text-sm text-slate-500">Cargando estado del live dashboard...</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={Boolean(branchActionDialog)} onOpenChange={(open) => !open && setBranchActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción de verificación</AlertDialogTitle>
            <AlertDialogDescription>
              {branchActionDialog
                ? `¿Deseas ${branchActionDialog.status === "approved" ? "aprobar" : "rechazar"} la sucursal ${branchActionDialog.branchName}?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!branchActionDialog) {
                  return;
                }
                void reviewBranch(branchActionDialog.branchId, branchActionDialog.status);
                setBranchActionDialog(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(moduleActionDialog)} onOpenChange={(open) => !open && setModuleActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de módulo</AlertDialogTitle>
            <AlertDialogDescription>
              {moduleActionDialog ? `¿Deseas ${moduleActionDialog.actionLabel} el módulo ${moduleActionDialog.moduleTitle}?` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!moduleActionDialog) {
                  return;
                }
                void updateLiveModule(moduleActionDialog.moduleKey, moduleActionDialog.updates);
                setModuleActionDialog(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
