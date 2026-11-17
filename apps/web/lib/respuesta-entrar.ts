const ESPERA_REINTENTO_POR_DEFECTO = 60;
const ESPERA_REINTENTO_MAXIMA = 120;

export type ResultadoEntrar =
  | { tipo: "destino"; destino: string }
  | { tipo: "espera"; segundos: number }
  | { tipo: "error" };

function segundosDeReintento(valor: string | null): number {
  if (!valor) return ESPERA_REINTENTO_POR_DEFECTO;

  const segundos = Number(valor);
  const fecha = Number.isFinite(segundos) ? NaN : Date.parse(valor);
  const restante = Number.isFinite(segundos) ? segundos : (fecha - Date.now()) / 1000;
  if (!Number.isFinite(restante)) return ESPERA_REINTENTO_POR_DEFECTO;

  return Math.min(ESPERA_REINTENTO_MAXIMA, Math.max(1, Math.ceil(restante)));
}

export async function interpretarRespuestaEntrar(response: Response): Promise<ResultadoEntrar> {
  if (response.status === 429) {
    return { tipo: "espera", segundos: segundosDeReintento(response.headers.get("Retry-After")) };
  }
  if (response.status === 401) return { tipo: "destino", destino: "/iniciar-sesion" };
  if (!response.ok) return { tipo: "error" };

  const cuerpo = (await response.json()) as { destino?: unknown };
  return {
    tipo: "destino",
    destino: typeof cuerpo.destino === "string" && cuerpo.destino.startsWith("/") ? cuerpo.destino : "/iniciar-sesion",
  };
}
