import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export type ModuleStatus = "online" | "degraded" | "offline";

export type LiveDashboardModule = {
  key: string;
  title: string;
  description: string;
  pathPrefix: string | null;
  isEnabled: boolean;
  isMaintenance: boolean;
  status: ModuleStatus;
  primaryStat: string;
  secondaryStat: string;
  updatedAt: string;
};

export type ModuleAccessReason = "disabled" | "maintenance";

export type ModuleAccessResult = {
  module: {
    key: string;
    title: string;
    pathPrefix: string | null;
    isEnabled: boolean;
    isMaintenance: boolean;
  } | null;
  blocked: boolean;
  reason: ModuleAccessReason | null;
};

export type LiveDashboardPayload = {
  overallStatus: ModuleStatus;
  isMaintenanceMode: boolean;
  modules: LiveDashboardModule[];
  weeklyActivity: {
    bars: number[];
    totalCurrentWeek: number;
    totalPreviousWeek: number;
    changePercent: number;
    trendLabel: string;
  };
};

type ModuleBase = {
  key: string;
  title: string;
  description: string;
  displayOrder: number;
  pathPrefix: string | null;
};

type ModuleMetric = {
  status: ModuleStatus;
  primaryStat: string;
  secondaryStat: string;
};

const defaultModules: ModuleBase[] = [
  {
    key: "client-salones",
    title: "Salones",
    description: "Explorar salones disponibles para reservar",
    displayOrder: 1,
    pathPrefix: "/dashboard/cliente/salones",
  },
  {
    key: "client-citas",
    title: "Mis citas",
    description: "Historial y próximas citas del cliente",
    displayOrder: 2,
    pathPrefix: "/dashboard/cliente/citas",
  },
  {
    key: "client-wallet",
    title: "Wallet y pagos",
    description: "Métodos de pago y recargas del cliente",
    displayOrder: 3,
    pathPrefix: "/dashboard/cliente/pagos",
  },
  {
    key: "client-config",
    title: "Configuración cliente",
    description: "Preferencias y seguridad del perfil cliente",
    displayOrder: 4,
    pathPrefix: "/dashboard/cliente/configuracion",
  },
  {
    key: "business-sucursales",
    title: "Sucursales",
    description: "Administración y validación de sucursales",
    displayOrder: 5,
    pathPrefix: "/dashboard/negocio/sucursales",
  },
  {
    key: "business-servicios",
    title: "Servicios",
    description: "Catálogo y precios de servicios",
    displayOrder: 6,
    pathPrefix: "/dashboard/negocio/servicios",
  },
  {
    key: "business-estilistas",
    title: "Estilistas",
    description: "Equipo, disponibilidad y perfiles",
    displayOrder: 7,
    pathPrefix: "/dashboard/negocio/estilistas",
  },
  {
    key: "business-citas",
    title: "Citas negocio",
    description: "Agenda del negocio y citas activas",
    displayOrder: 8,
    pathPrefix: "/dashboard/negocio/citas",
  },
  {
    key: "business-config",
    title: "Configuración negocio",
    description: "Perfil del salón y datos del negocio",
    displayOrder: 9,
    pathPrefix: "/dashboard/negocio/configuracion",
  },
];

const supportedModuleKeys = new Set(defaultModules.map((item) => item.key));

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

async function ensureDefaultModules() {
  const db = getDb();

  for (const moduleItem of defaultModules) {
    await db`
      INSERT INTO stylehub_live_dashboard_modules (module_key, title, description, path_prefix, display_order)
      VALUES (${moduleItem.key}, ${moduleItem.title}, ${moduleItem.description}, ${moduleItem.pathPrefix}, ${moduleItem.displayOrder})
      ON CONFLICT (module_key)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        path_prefix = EXCLUDED.path_prefix,
        display_order = EXCLUDED.display_order
    `;
  }
}

function isPathMatch(pathname: string, pathPrefix: string) {
  return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);
}

async function resolveBranchesMetric(): Promise<ModuleMetric> {
  const db = getDb();

  try {
    const [result] = (await db`
      SELECT
        COUNT(*)::int AS total_branches,
        COUNT(*) FILTER (WHERE validation_status = 'approved')::int AS approved_branches,
        COUNT(*) FILTER (WHERE validation_status = 'pending')::int AS pending_branches
      FROM stylehub_business_branches
    `) as Array<{
      total_branches: number;
      approved_branches: number;
      pending_branches: number;
    }>;

    const totalBranches = result?.total_branches ?? 0;
    const approvedBranches = result?.approved_branches ?? 0;
    const pendingBranches = result?.pending_branches ?? 0;

    return {
      status: pendingBranches > 0 ? "degraded" : "online",
      primaryStat: `${formatNumber(approvedBranches)}/${formatNumber(totalBranches)} aprobadas`,
      secondaryStat: `${formatNumber(pendingBranches)} pendientes`,
    };
  } catch {
    return {
      status: "offline",
      primaryStat: "Sin conexión",
      secondaryStat: "Error consultando sucursales",
    };
  }
}

async function resolveAppointmentsMetric(): Promise<ModuleMetric> {
  const db = getDb();

  try {
    const [result] = (await db`
      SELECT
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'confirmed')
            AND scheduled_at >= NOW()
        )::int AS active_appointments,
        COUNT(*) FILTER (
          WHERE scheduled_at >= DATE_TRUNC('day', NOW())
            AND scheduled_at < DATE_TRUNC('day', NOW()) + INTERVAL '7 day'
        )::int AS week_appointments
      FROM stylehub_client_appointments
    `) as Array<{ active_appointments: number; week_appointments: number }>;

    const activeAppointments = result?.active_appointments ?? 0;
    const weekAppointments = result?.week_appointments ?? 0;

    return {
      status: "online",
      primaryStat: `${formatNumber(activeAppointments)} activas`,
      secondaryStat: `${formatNumber(weekAppointments)} esta semana`,
    };
  } catch {
    return {
      status: "offline",
      primaryStat: "Sin conexión",
      secondaryStat: "Error consultando citas",
    };
  }
}

async function resolvePaymentsMetric(): Promise<ModuleMetric> {
  const db = getDb();

  try {
    const [methodsResult] = (await db`
      SELECT COUNT(*)::int AS payment_methods
      FROM stylehub_client_payment_methods
    `) as Array<{ payment_methods: number }>;

    const [walletResult] = (await db`
      SELECT COALESCE(SUM(amount), 0)::numeric AS month_total
      FROM stylehub_client_wallet_transactions
      WHERE status = 'completed'
        AND transaction_type = 'recharge'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
    `) as Array<{ month_total: string }>;

    const paymentMethods = methodsResult?.payment_methods ?? 0;
    const monthTotal = Number(walletResult?.month_total ?? 0);

    return {
      status: "online",
      primaryStat: `${formatNumber(paymentMethods)} métodos`,
      secondaryStat: `${formatCurrency(monthTotal)} recargado`,
    };
  } catch {
    return {
      status: "offline",
      primaryStat: "Sin conexión",
      secondaryStat: "Error consultando pagos",
    };
  }
}

async function resolveModuleMetrics() {
  const branches = await resolveBranchesMetric();
  const appointments = await resolveAppointmentsMetric();
  const payments = await resolvePaymentsMetric();

  return {
    "client-salones": branches,
    "business-sucursales": branches,
    "client-citas": appointments,
    "business-citas": appointments,
    "client-wallet": payments,
    "business-servicios": payments,
    "business-estilistas": appointments,
    "business-config": branches,
    "client-config": branches,
  } as Record<string, ModuleMetric>;
}

async function resolveWeeklyActivity() {
  const db = getDb();

  try {
    const rows = (await db`
      SELECT
        TO_CHAR(DATE_TRUNC('day', scheduled_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS total
      FROM stylehub_client_appointments
      WHERE scheduled_at >= DATE_TRUNC('day', NOW()) - INTERVAL '13 day'
      GROUP BY 1
      ORDER BY 1 ASC
    `) as Array<{ day: string; total: number }>;

    const totalsByDay = new Map(rows.map((row) => [row.day, row.total]));
    const today = new Date();
    const baseDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const values: number[] = [];

    for (let offset = 13; offset >= 0; offset -= 1) {
      const day = new Date(baseDay);
      day.setDate(day.getDate() - offset);
      const dayKey = day.toISOString().slice(0, 10);
      values.push(totalsByDay.get(dayKey) ?? 0);
    }

    const previousWeek = values.slice(0, 7);
    const currentWeek = values.slice(7);

    const totalPreviousWeek = previousWeek.reduce((sum, value) => sum + value, 0);
    const totalCurrentWeek = currentWeek.reduce((sum, value) => sum + value, 0);

    const changePercent =
      totalPreviousWeek === 0
        ? totalCurrentWeek > 0
          ? 100
          : 0
        : Math.round(((totalCurrentWeek - totalPreviousWeek) / totalPreviousWeek) * 100);

    const maxCurrentWeek = Math.max(...currentWeek, 0);

    return {
      bars: currentWeek.map((value) => {
        if (maxCurrentWeek === 0) {
          return 8;
        }

        return Math.max(12, Math.round((value / maxCurrentWeek) * 100));
      }),
      totalCurrentWeek,
      totalPreviousWeek,
      changePercent,
      trendLabel: `${changePercent >= 0 ? "+" : ""}${changePercent}% reservas`,
    };
  } catch {
    return {
      bars: [8, 8, 8, 8, 8, 8, 8],
      totalCurrentWeek: 0,
      totalPreviousWeek: 0,
      changePercent: 0,
      trendLabel: "0% reservas",
    };
  }
}

function resolveOverallStatus(modules: LiveDashboardModule[]): ModuleStatus {
  const hasDisabled = modules.some((module) => !module.isEnabled);
  const enabledModules = modules.filter((module) => module.isEnabled);

  if (enabledModules.length === 0) {
    return "offline";
  }

  const hasMaintenance = enabledModules.some((module) => module.isMaintenance);
  const hasOffline = enabledModules.some((module) => !module.isMaintenance && module.status === "offline");
  const hasDegraded = enabledModules.some((module) => !module.isMaintenance && module.status === "degraded");

  if (hasDisabled || hasMaintenance || hasOffline) {
    return "degraded";
  }

  return hasDegraded ? "degraded" : "online";
}

export async function getLiveDashboardPayload(options?: { includeDisabled?: boolean }): Promise<LiveDashboardPayload> {
  await ensureStylehubSchema();
  await ensureDefaultModules();

  const db = getDb();

  const modulesFromDb = (await db`
    SELECT module_key, title, description, path_prefix, is_enabled, is_maintenance, display_order, updated_at
    FROM stylehub_live_dashboard_modules
    ORDER BY display_order ASC, module_key ASC
  `) as Array<{
    module_key: string;
    title: string;
    description: string;
    path_prefix: string | null;
    is_enabled: boolean;
    is_maintenance: boolean;
    display_order: number;
    updated_at: string;
  }>;

  const metricByKey = await resolveModuleMetrics();

  const allModules: LiveDashboardModule[] = modulesFromDb
    .filter((module) => supportedModuleKeys.has(module.module_key))
    .map((module) => {
    const metric = metricByKey[module.module_key] ?? {
      status: "online",
      primaryStat: "Módulo habilitado",
      secondaryStat: "Controlado por administración",
    };

    return {
      key: module.module_key,
      title: module.title,
      description: module.description,
      pathPrefix: module.path_prefix,
      isEnabled: module.is_enabled,
      isMaintenance: module.is_maintenance,
      status: module.is_maintenance ? "offline" : metric.status,
      primaryStat: metric.primaryStat,
      secondaryStat: module.is_maintenance ? "Módulo en mantenimiento" : metric.secondaryStat,
      updatedAt: module.updated_at,
    };
  });

  const modules = options?.includeDisabled ? allModules : allModules.filter((module) => module.isEnabled);
  const isMaintenanceMode = allModules.length > 0 && allModules.every((module) => !module.isEnabled || module.isMaintenance);
  const weeklyActivity = await resolveWeeklyActivity();

  return {
    overallStatus: resolveOverallStatus(allModules),
    isMaintenanceMode,
    modules,
    weeklyActivity,
  };
}

export async function updateLiveDashboardModule(moduleKey: string, updates: { isEnabled?: boolean; isMaintenance?: boolean }) {
  await ensureStylehubSchema();
  await ensureDefaultModules();

  if (typeof updates.isEnabled !== "boolean" && typeof updates.isMaintenance !== "boolean") {
    return false;
  }

  const db = getDb();

  const updated = (await db`
    UPDATE stylehub_live_dashboard_modules
    SET
        is_enabled = COALESCE(${typeof updates.isEnabled === "boolean" ? updates.isEnabled : null}, is_enabled),
        is_maintenance = COALESCE(${typeof updates.isMaintenance === "boolean" ? updates.isMaintenance : null}, is_maintenance),
        updated_at = NOW()
    WHERE module_key = ${moduleKey}
    RETURNING module_key
  `) as Array<{ module_key: string }>;

  if (updated.length === 0) {
    return false;
  }

  if (typeof updates.isEnabled === "boolean" && !updates.isEnabled) {
    await db`
      UPDATE stylehub_live_dashboard_modules
      SET is_maintenance = FALSE,
          updated_at = NOW()
      WHERE module_key = ${moduleKey}
    `;
  }

  return true;
}

export async function getModuleAccessByPath(pathname: string): Promise<ModuleAccessResult> {
  await ensureStylehubSchema();
  await ensureDefaultModules();

  const db = getDb();

  const rows = (await db`
    SELECT module_key, title, path_prefix, is_enabled, is_maintenance
    FROM stylehub_live_dashboard_modules
    WHERE path_prefix IS NOT NULL
  `) as Array<{
    module_key: string;
    title: string;
    path_prefix: string;
    is_enabled: boolean;
    is_maintenance: boolean;
  }>;

  const matched = rows
    .filter((row) => supportedModuleKeys.has(row.module_key) && isPathMatch(pathname, row.path_prefix))
    .sort((a, b) => b.path_prefix.length - a.path_prefix.length)[0];

  if (!matched) {
    return {
      module: null,
      blocked: false,
      reason: null,
    };
  }

  if (!matched.is_enabled) {
    return {
      module: {
        key: matched.module_key,
        title: matched.title,
        pathPrefix: matched.path_prefix,
        isEnabled: matched.is_enabled,
        isMaintenance: matched.is_maintenance,
      },
      blocked: true,
      reason: "disabled",
    };
  }

  if (matched.is_maintenance) {
    return {
      module: {
        key: matched.module_key,
        title: matched.title,
        pathPrefix: matched.path_prefix,
        isEnabled: matched.is_enabled,
        isMaintenance: matched.is_maintenance,
      },
      blocked: true,
      reason: "maintenance",
    };
  }

  return {
    module: {
      key: matched.module_key,
      title: matched.title,
      pathPrefix: matched.path_prefix,
      isEnabled: matched.is_enabled,
      isMaintenance: matched.is_maintenance,
    },
    blocked: false,
    reason: null,
  };
}
