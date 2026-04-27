"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, LayoutGrid, ShieldCheck, Users } from "lucide-react";

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

type AdminUser = {
  id: string;
  account_type: "cliente" | "negocio";
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  phone: string | null;
  email: string;
  email_verified: boolean;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
};

type UsersSummary = {
  total: number;
  clients: number;
  businesses: number;
  verified: number;
  banned: number;
};

type UsersPagination = {
  page: number;
  pageSize: number;
  totalFiltered: number;
  totalPages: number;
};

type UserActionDialogState = {
  userId: string;
  userName: string;
  action: "delete" | "ban" | "unban";
} | null;

type EditUserFormState = {
  id: string;
  firstName: string;
  lastName: string;
  businessName: string;
  phone: string;
  email: string;
};

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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersSummary, setUsersSummary] = useState<UsersSummary>({ total: 0, clients: 0, businesses: 0, verified: 0, banned: 0 });
  const [usersPagination, setUsersPagination] = useState<UsersPagination>({ page: 1, pageSize: 10, totalFiltered: 0, totalPages: 1 });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [liveModules, setLiveModules] = useState<AdminLiveModule[]>([]);
  const [liveDashboardStatus, setLiveDashboardStatus] = useState<ModuleStatus>("offline");
  const [liveLoading, setLiveLoading] = useState<boolean>(true);
  const [liveSavingKey, setLiveSavingKey] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [userSavingId, setUserSavingId] = useState<string | null>(null);
  const [branchQuery, setBranchQuery] = useState("");
  const [moduleQuery, setModuleQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "cliente" | "negocio">("all");
  const [userBannedFilter, setUserBannedFilter] = useState<"all" | "yes" | "no">("all");
  const [userSortBy, setUserSortBy] = useState<"created_at" | "updated_at" | "email" | "account_type" | "name">("created_at");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [branchActionDialog, setBranchActionDialog] = useState<BranchActionDialogState>(null);
  const [moduleActionDialog, setModuleActionDialog] = useState<ModuleActionDialogState>(null);
  const [userActionDialog, setUserActionDialog] = useState<UserActionDialogState>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserFormState | null>(null);

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

  const loadUsers = useCallback(async (overrides?: Partial<{ page: number; pageSize: number }>) => {
    setUsersLoading(true);

    try {
      const page = overrides?.page ?? usersPagination.page;
      const pageSize = overrides?.pageSize ?? usersPagination.pageSize;

      const params = new URLSearchParams({
        search: userQuery,
        role: userRoleFilter,
        banned: userBannedFilter,
        sortBy: userSortBy,
        sortDir: userSortDir,
        page: String(page),
        pageSize: String(pageSize),
      });

      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        users: AdminUser[];
        summary: UsersSummary;
        pagination?: UsersPagination;
      };

      setUsers(payload.users ?? []);
      setUsersSummary(payload.summary ?? { total: 0, clients: 0, businesses: 0, verified: 0, banned: 0 });
      setUsersPagination(payload.pagination ?? { page: 1, pageSize, totalFiltered: 0, totalPages: 1 });
    } finally {
      setUsersLoading(false);
    }
  }, [userBannedFilter, userQuery, userRoleFilter, userSortBy, userSortDir, usersPagination.page, usersPagination.pageSize]);

  useEffect(() => {
    void Promise.all([loadBranches(), loadLiveDashboard()]);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const refreshDashboard = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadBranches(), loadLiveDashboard(), loadUsers()]);
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

  const filteredUsers = users;

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

  const saveUserEdit = async () => {
    if (!editUserForm) {
      return;
    }

    try {
      setUserSavingId(editUserForm.id);
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editUserForm.id,
          action: "edit",
          firstName: editUserForm.firstName,
          lastName: editUserForm.lastName,
          businessName: editUserForm.businessName,
          phone: editUserForm.phone,
          email: editUserForm.email,
        }),
      });

      if (!response.ok) {
        return;
      }

      setEditUserForm(null);
      await loadUsers();
    } finally {
      setUserSavingId(null);
    }
  };

  const runUserAction = async (action: NonNullable<UserActionDialogState>["action"], userId: string) => {
    try {
      setUserSavingId(userId);

      const response =
        action === "delete"
          ? await fetch("/api/admin/users", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            })
          : await fetch("/api/admin/users", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, action }),
            });

      if (!response.ok) {
        return;
      }

      await loadUsers();
    } finally {
      setUserSavingId(null);
    }
  };

  const getUserDisplayName = (user: AdminUser) => {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
    return fullName || user.business_name || user.email;
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
            <CardDescription>Usuarios totales</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">{usersSummary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usuarios baneados</CardDescription>
            <CardTitle className="text-3xl font-black text-amber-700">{usersSummary.banned}</CardTitle>
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
          <TabsTrigger value="usuarios" id="usuarios">
            <Users className="size-4" /> Usuarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <Card>
            <CardHeader>
              <CardTitle>Resumen operativo</CardTitle>
              <CardDescription>Vista ejecutiva de salud y control administrativo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Estado general</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{statusLabel[liveDashboardStatus]}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Módulos totales</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{liveSummary.total}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Usuarios verificados</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{usersSummary.verified}</p>
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

        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios de la plataforma</CardTitle>
              <CardDescription>Visualiza, edita, banea o elimina cuentas de clientes y negocios.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
                <Input
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                  placeholder="Buscar por nombre, negocio, correo, rol o teléfono"
                />
                <select
                  value={userRoleFilter}
                  onChange={(event) => setUserRoleFilter(event.target.value as "all" | "cliente" | "negocio")}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="all">Todos los roles</option>
                  <option value="cliente">Cliente</option>
                  <option value="negocio">Negocio</option>
                </select>
                <select
                  value={userBannedFilter}
                  onChange={(event) => setUserBannedFilter(event.target.value as "all" | "yes" | "no")}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="all">Todos los estados</option>
                  <option value="no">Activos</option>
                  <option value="yes">Baneados</option>
                </select>
                <select
                  value={userSortBy}
                  onChange={(event) => setUserSortBy(event.target.value as "created_at" | "updated_at" | "email" | "account_type" | "name")}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="created_at">Orden: Alta reciente</option>
                  <option value="updated_at">Orden: Última actualización</option>
                  <option value="name">Orden: Nombre</option>
                  <option value="email">Orden: Correo</option>
                  <option value="account_type">Orden: Rol</option>
                </select>
                <select
                  value={userSortDir}
                  onChange={(event) => setUserSortDir(event.target.value as "asc" | "desc")}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Clientes: {usersSummary.clients}</span>
                <span>·</span>
                <span>Negocios: {usersSummary.businesses}</span>
                <span>·</span>
                <span>Mostrando: {filteredUsers.length} de {usersPagination.totalFiltered}</span>
                <span>·</span>
                <span>Página {usersPagination.page} de {usersPagination.totalPages}</span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={usersLoading || usersPagination.page <= 1}
                  onClick={() => void loadUsers({ page: Math.max(1, usersPagination.page - 1) })}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={usersLoading || usersPagination.page >= usersPagination.totalPages}
                  onClick={() => void loadUsers({ page: Math.min(usersPagination.totalPages, usersPagination.page + 1) })}
                >
                  Siguiente
                </Button>
                <select
                  value={String(usersPagination.pageSize)}
                  onChange={(event) => void loadUsers({ page: 1, pageSize: Number(event.target.value) })}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                >
                  <option value="10">10 / página</option>
                  <option value="20">20 / página</option>
                  <option value="50">50 / página</option>
                </select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <p className="font-semibold text-slate-900">{getUserDisplayName(user)}</p>
                        <p className="text-xs text-slate-500">ID: {user.id.slice(0, 8)}...</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.account_type === "negocio" ? "warning" : "secondary"}>
                          {user.account_type === "negocio" ? "Negocio" : "Cliente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-900">{user.email}</p>
                        <p className="text-xs text-slate-500">{user.phone || "Sin teléfono"}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={user.is_banned ? "danger" : "success"}>{user.is_banned ? "Baneado" : "Activo"}</Badge>
                          <span className="text-xs text-slate-500">{user.email_verified ? "Verificado" : "Sin verificar"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={userSavingId === user.id}
                            onClick={() =>
                              setEditUserForm({
                                id: user.id,
                                firstName: user.first_name ?? "",
                                lastName: user.last_name ?? "",
                                businessName: user.business_name ?? "",
                                phone: user.phone ?? "",
                                email: user.email,
                              })
                            }
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={user.is_banned ? "default" : "destructive"}
                            disabled={userSavingId === user.id}
                            onClick={() =>
                              setUserActionDialog({
                                userId: user.id,
                                userName: getUserDisplayName(user),
                                action: user.is_banned ? "unban" : "ban",
                              })
                            }
                          >
                            {user.is_banned ? "Desbanear" : "Banear"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={userSavingId === user.id}
                            onClick={() =>
                              setUserActionDialog({
                                userId: user.id,
                                userName: getUserDisplayName(user),
                                action: "delete",
                              })
                            }
                          >
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {usersLoading ? <p className="text-sm text-slate-500">Cargando usuarios...</p> : null}
              {!usersLoading && filteredUsers.length === 0 ? <p className="text-sm text-slate-500">No hay usuarios para los filtros actuales.</p> : null}

              {editUserForm ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Editar usuario</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Input
                      value={editUserForm.firstName}
                      onChange={(event) => setEditUserForm((current) => (current ? { ...current, firstName: event.target.value } : null))}
                      placeholder="Nombre"
                    />
                    <Input
                      value={editUserForm.lastName}
                      onChange={(event) => setEditUserForm((current) => (current ? { ...current, lastName: event.target.value } : null))}
                      placeholder="Apellido"
                    />
                    <Input
                      value={editUserForm.businessName}
                      onChange={(event) => setEditUserForm((current) => (current ? { ...current, businessName: event.target.value } : null))}
                      placeholder="Nombre de negocio"
                    />
                    <Input
                      value={editUserForm.phone}
                      onChange={(event) => setEditUserForm((current) => (current ? { ...current, phone: event.target.value } : null))}
                      placeholder="Teléfono"
                    />
                    <Input
                      value={editUserForm.email}
                      onChange={(event) => setEditUserForm((current) => (current ? { ...current, email: event.target.value } : null))}
                      placeholder="Correo"
                    />
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditUserForm(null)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => void saveUserEdit()} disabled={userSavingId === editUserForm.id}>
                      {userSavingId === editUserForm.id ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                </div>
              ) : null}
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

      <AlertDialog open={Boolean(userActionDialog)} onOpenChange={(open) => !open && setUserActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción de usuario</AlertDialogTitle>
            <AlertDialogDescription>
              {userActionDialog
                ? `¿Deseas ${userActionDialog.action === "delete" ? "eliminar" : userActionDialog.action === "ban" ? "banear" : "desbanear"} a ${userActionDialog.userName}?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!userActionDialog) {
                  return;
                }
                void runUserAction(userActionDialog.action, userActionDialog.userId);
                setUserActionDialog(null);
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
