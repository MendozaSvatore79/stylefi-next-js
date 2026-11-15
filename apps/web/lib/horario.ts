/**
 * Horario semanal de una sucursal (decisiones de producto, 2026-11-14): informativo, no limita reservas; un bloque
 * por día sin cruzar la medianoche; horas cada 30 minutos de 06:00 a 23:30. Días: 0 = lunes … 6 = domingo, igual
 * que el backend (negocios/horario.ts), que vuelve a validar todo.
 */

export type Idioma = "es" | "en";

export type DiaHorario = { dia: number; abierto: boolean; abre: string | null; cierra: string | null };

const NOMBRES = {
  es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};
const CORTOS = {
  es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export function nombreDelDia(dia: number, idioma: Idioma) {
  return NOMBRES[idioma][dia] ?? "";
}

/** "06:00", "06:30" … "23:30". */
export const HORAS: string[] = Array.from({ length: (24 - 6) * 2 }, (_, i) => {
  const minutos = 6 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${minutos % 60 === 0 ? "00" : "30"}`;
});

/** Al crear una sucursal: lunes a viernes 09:00–20:00, sábado 09:00–16:00, domingo cerrado. */
export function horarioPorOmision(): DiaHorario[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dia) =>
    dia === 6
      ? { dia, abierto: false, abre: null, cierra: null }
      : { dia, abierto: true, abre: "09:00", cierra: dia === 5 ? "16:00" : "20:00" },
  );
}

/** El horario del lunes también de martes a viernes. */
export function copiarLunesAViernes(horario: DiaHorario[]): DiaHorario[] {
  const lunes = horario.find((d) => d.dia === 0);
  if (!lunes) return horario;
  return horario.map((d) => (d.dia >= 1 && d.dia <= 4 ? { ...lunes, dia: d.dia } : d));
}

/** Cambia un día; al abrir un día cerrado le pone 09:00–20:00 para no dejarlo sin horas. */
export function cambiarDia(horario: DiaHorario[], dia: number, cambio: Partial<Omit<DiaHorario, "dia">>): DiaHorario[] {
  return horario.map((d) => {
    if (d.dia !== dia) return d;
    const nuevo = { ...d, ...cambio };
    if (nuevo.abierto) return { ...nuevo, abre: nuevo.abre ?? "09:00", cierra: nuevo.cierra ?? "20:00" };
    return { ...nuevo, abre: null, cierra: null };
  });
}

/** Días con la apertura igual o después del cierre (se marcan en rojo y no se deja guardar). */
export function diasInvalidos(horario: DiaHorario[]): number[] {
  return horario.filter((d) => d.abierto && (!d.abre || !d.cierra || d.abre >= d.cierra)).map((d) => d.dia);
}

/** Horario que vino del backend (jsonb), o null si no hay o no tiene la forma esperada. */
export function leerHorario(valor: unknown): DiaHorario[] | null {
  if (!Array.isArray(valor) || valor.length !== 7) return null;
  const dias = valor as DiaHorario[];
  const ordenados = [...dias].sort((a, b) => a.dia - b.dia);
  if (!ordenados.every((d, i) => d && d.dia === i && typeof d.abierto === "boolean")) return null;
  return ordenados;
}

/**
 * Resumen corto agrupando días seguidos con el mismo horario: ["Lun–Vie 09:00–20:00", "Sáb 09:00–16:00",
 * "Dom cerrado"].
 */
export function resumenHorario(horario: DiaHorario[], idioma: Idioma): string[] {
  const texto = (d: DiaHorario) => (d.abierto ? `${d.abre}–${d.cierra}` : idioma === "en" ? "closed" : "cerrado");
  const lineas: string[] = [];
  let inicio = 0;
  for (let i = 1; i <= horario.length; i++) {
    if (i < horario.length && texto(horario[i]) === texto(horario[inicio])) continue;
    const dias = i - 1 === inicio ? CORTOS[idioma][inicio] : `${CORTOS[idioma][inicio]}–${CORTOS[idioma][i - 1]}`;
    lineas.push(`${dias} ${texto(horario[inicio])}`);
    inicio = i;
  }
  return lineas;
}

/** Texto viejo (opening_hours / closing_hours libres) para las sucursales que aún no tienen horario semanal. */
export function horarioAnterior(apertura: string | null | undefined, cierre: string | null | undefined): string | null {
  const a = apertura?.trim();
  const c = cierre?.trim();
  if (a && c) return `${a} – ${c}`;
  return a || c || null;
}
