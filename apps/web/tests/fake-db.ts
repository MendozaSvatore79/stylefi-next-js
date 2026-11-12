import { vi } from "vitest";

export type Query = { text: string; values: unknown[] };
type Handler = (query: Query) => unknown[];

/** Imita la función con plantillas del cliente postgres y guarda cada consulta. */
export function crearFakeDb(handler: Handler = () => []) {
  const queries: Query[] = [];
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = { text: strings.join("$?").replace(/\s+/g, " ").trim(), values };
    queries.push(query);
    return Promise.resolve(handler(query));
  });
  return { sql, queries };
}
