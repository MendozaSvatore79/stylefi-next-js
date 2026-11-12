/** Archivos subidos: validados por contenido, guardados fuera de public/ y servidos con permisos. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Query } from "./fake-db";

const NEGOCIO = "b0000000-0000-0000-0000-000000000001";
const OTRO_NEGOCIO = "b0000000-0000-0000-0000-000000000002";
const ADMIN = "a0000000-0000-0000-0000-000000000001";
const COMPROBANTE = "10000000-0000-0000-0000-000000000001";
const IMAGEN = "10000000-0000-0000-0000-000000000002";

// Archivos de ejemplo por sus primeros bytes
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8 ")]);
const PDF = new Uint8Array(Buffer.from("%PDF-1.7\n%âãÏÓ\n"));
const HTML = new Uint8Array(Buffer.from("<html><script>alert(1)</script></html>"));
const SVG = new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'));
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 6, 0]); // ZIP (Word moderno)

const archivo = (bytes: Uint8Array, nombre: string, tipo: string) => new File([new Uint8Array(bytes)], nombre, { type: tipo });

const estado = vi.hoisted(() => ({
  sesion: null as null | { user: Record<string, unknown> },
  queries: [] as Array<{ text: string; values: unknown[] }>,
  archivos: {} as Record<string, { owner_user_id: string; kind: string; content_type: string; data_base64: string }>,
  sucursal: null as null | { image_url: string | null; ownership_proof_url: string | null },
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => estado.sesion), default: vi.fn() }));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = { text: strings.join("$?").replace(/\s+/g, " ").trim(), values };
    estado.queries.push(q);
    return Promise.resolve(responder(q));
  },
}));

let siguienteId = 100;
function responder(q: Query): unknown[] {
  const t = q.text;
  if (t.includes("account_type = 'admin'")) return q.values[0] === ADMIN ? [{ id: ADMIN, email: "admin@test" }] : [];
  if (t.includes("account_type FROM stylehub_users")) return [{ account_type: "negocio" }];
  if (t.startsWith("INSERT INTO stylehub_files")) {
    const id = `20000000-0000-0000-0000-000000000${siguienteId++}`;
    estado.archivos[id] = { owner_user_id: String(q.values[0]), kind: String(q.values[1]), content_type: String(q.values[2]), data_base64: String(q.values[4]) };
    return [{ id }];
  }
  if (t.startsWith("SELECT id, owner_user_id, kind, content_type")) {
    const a = estado.archivos[String(q.values[0])];
    return a ? [{ id: q.values[0], ...a }] : [];
  }
  if (t.startsWith("DELETE FROM stylehub_files")) {
    const a = estado.archivos[String(q.values[0])];
    if (a && a.owner_user_id === q.values[1]) delete estado.archivos[String(q.values[0])];
    return [];
  }
  if (t.includes("COUNT(*)::int AS total")) return [{ total: 0 }];
  if (t.startsWith("SELECT image_url, ownership_proof_url")) return estado.sucursal ? [estado.sucursal] : [];
  if (t.startsWith("INSERT INTO stylehub_business_branches")) return [{ id: "suc1" }];
  if (t.startsWith("UPDATE stylehub_business_branches")) return [{ id: "suc1" }];
  return [];
}

const sesionDe = (id: string, accountType: string) => ({ user: { id, email: `${id}@test`, accountType } });

beforeEach(() => {
  estado.sesion = null;
  estado.queries = [];
  estado.sucursal = null;
  estado.archivos = {
    [COMPROBANTE]: { owner_user_id: NEGOCIO, kind: "branch_proof", content_type: "application/pdf", data_base64: Buffer.from(PDF).toString("base64") },
    [IMAGEN]: { owner_user_id: NEGOCIO, kind: "branch_image", content_type: "image/png", data_base64: Buffer.from(PNG).toString("base64") },
  };
});

describe("validación por contenido", () => {
  it.each([
    [PNG, "image/png", "png"],
    [JPG, "image/jpeg", "jpg"],
    [WEBP, "image/webp", "webp"],
    [PDF, "application/pdf", "pdf"],
  ])("detecta %#", async (bytes, mime, extension) => {
    const { detectarTipo } = await import("@/lib/storage");
    expect(detectarTipo(bytes)).toEqual({ mime, extension });
  });

  it.each([
    ["HTML que dice ser PNG", HTML, "foto.png", "image/png"],
    ["SVG", SVG, "logo.svg", "image/svg+xml"],
    ["Word", DOCX, "comprobante.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ])("rechaza %s como comprobante y como imagen", async (_caso, bytes, nombre, tipo) => {
    const { validarArchivo, ArchivoInvalido } = await import("@/lib/storage");
    await expect(validarArchivo(archivo(bytes, nombre, tipo), "branch_proof")).rejects.toBeInstanceOf(ArchivoInvalido);
    await expect(validarArchivo(archivo(bytes, nombre, tipo), "branch_image")).rejects.toBeInstanceOf(ArchivoInvalido);
  });

  it("un PDF sirve como comprobante pero no como imagen de sucursal", async () => {
    const { validarArchivo, ArchivoInvalido } = await import("@/lib/storage");
    await expect(validarArchivo(archivo(PDF, "c.pdf", "application/pdf"), "branch_proof")).resolves.toMatchObject({ extension: "pdf" });
    await expect(validarArchivo(archivo(PDF, "c.pdf", "application/pdf"), "branch_image")).rejects.toBeInstanceOf(ArchivoInvalido);
  });

  it("la extensión sale del contenido, no del nombre ni del tipo que dice el navegador", async () => {
    const { validarArchivo } = await import("@/lib/storage");
    const r = await validarArchivo(archivo(PNG, "pagina.html", "text/html"), "branch_image");
    expect(r).toMatchObject({ mime: "image/png", extension: "png" });
  });

  it("rechaza archivos de más de 4 MB", async () => {
    const { validarArchivo, MAX_BYTES } = await import("@/lib/storage");
    const grande = new Uint8Array(MAX_BYTES + 1);
    grande.set(PNG);
    await expect(validarArchivo(archivo(grande, "g.png", "image/png"), "branch_image")).rejects.toThrow("4 MB");
  });

  it("guarda en la base (no en disco) y devuelve la URL de /api/files", async () => {
    const { guardarArchivo } = await import("@/lib/storage");
    const url = await guardarArchivo(NEGOCIO, "branch_proof", archivo(PDF, "c.pdf", "application/pdf"));
    expect(url).toMatch(/^\/api\/files\/[0-9a-f-]{36}$/);
    const insert = estado.queries.find((q) => q.text.startsWith("INSERT INTO stylehub_files"))!;
    expect(insert.values.slice(0, 4)).toEqual([NEGOCIO, "branch_proof", "application/pdf", PDF.byteLength]);
    expect(Buffer.from(String(insert.values[4]), "base64")).toEqual(Buffer.from(PDF));
  });
});

describe("GET /api/files/[id]", () => {
  async function descargar(id: string) {
    const { GET } = await import("@/app/api/files/[id]/route");
    return GET(new Request(`http://localhost/api/files/${id}`), { params: Promise.resolve({ id }) });
  }

  it("la imagen de sucursal es pública, con su tipo y nosniff", async () => {
    const r = await descargar(IMAGEN);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toContain("sandbox");
    expect(Buffer.from(await r.arrayBuffer())).toEqual(Buffer.from(PNG));
  });

  it("el comprobante sin sesión responde 401", async () => {
    expect((await descargar(COMPROBANTE)).status).toBe(401);
  });

  it.each([
    ["otro negocio", () => sesionDe(OTRO_NEGOCIO, "negocio")],
    ["un cliente", () => sesionDe("c0000000-0000-0000-0000-000000000001", "cliente")],
    ["un JWT de admin que la base no confirma", () => sesionDe("ex-admin", "admin")],
  ])("el comprobante para %s responde 404", async (_caso, sesion) => {
    estado.sesion = sesion();
    const r = await descargar(COMPROBANTE);
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("PDF");
  });

  it.each([
    ["el negocio dueño", () => sesionDe(NEGOCIO, "negocio")],
    ["la administración", () => sesionDe(ADMIN, "admin")],
  ])("el comprobante lo descarga %s, como adjunto y sin caché", async (_caso, sesion) => {
    estado.sesion = sesion();
    const r = await descargar(COMPROBANTE);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="comprobante.pdf"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each(["no-existe", "20000000-0000-0000-0000-000000000999", "../../etc/passwd"])("%s responde 404", async (id) => {
    expect((await descargar(id)).status).toBe(404);
  });
});

describe("API de sucursales", () => {
  beforeEach(() => {
    estado.sesion = sesionDe(NEGOCIO, "negocio");
  });

  async function enviar(metodo: "POST" | "PUT", campos: Record<string, string | File>) {
    const form = new FormData();
    form.set("branchName", "Centro");
    for (const [k, v] of Object.entries(campos)) form.set(k, v);
    const mod = await import("@/app/api/business/branches/route");
    // Los handlers están tipados como Response | undefined; en estas rutas siempre responden
    return (await mod[metodo](new Request("http://localhost/api/business/branches", { method: metodo, body: form }))) as Response;
  }

  const insertSucursal = () => estado.queries.find((q) => q.text.startsWith("INSERT INTO stylehub_business_branches"));

  it("con comprobante e imagen válidos guarda ambos en la base y la sucursal apunta a /api/files", async () => {
    const r = await enviar("POST", {
      ownershipProof: archivo(PDF, "c.pdf", "application/pdf"),
      branchImage: archivo(JPG, "f.jpg", "image/jpeg"),
    });
    expect(r.status).toBe(201);
    const valores = insertSucursal()!.values.map(String);
    expect(valores.filter((v) => v.startsWith("/api/files/"))).toHaveLength(2);
    expect(Object.values(estado.archivos).map((a) => a.kind).sort()).toEqual(["branch_image", "branch_image", "branch_proof", "branch_proof"]);
  });

  it("una URL escrita a mano no sirve como comprobante", async () => {
    const r = await enviar("POST", { ownershipProofUrl: "https://sitio-falso.test/comprobante.pdf" });
    expect(r.status).toBe(400);
    expect(insertSucursal()).toBeUndefined();
  });

  it.each([
    ["HTML disfrazado de comprobante", { ownershipProof: archivo(HTML, "c.pdf", "application/pdf") }],
    ["SVG como imagen", { ownershipProof: archivo(PDF, "c.pdf", "application/pdf"), branchImage: archivo(SVG, "i.svg", "image/svg+xml") }],
    ["URL javascript:", { ownershipProof: archivo(PDF, "c.pdf", "application/pdf"), imageUrl: "javascript:alert(1)" }],
    ["URL http://", { ownershipProof: archivo(PDF, "c.pdf", "application/pdf"), imageUrl: "http://sin-cifrar.test/i.png" }],
  ])("%s: responde 400 y no guarda nada", async (_caso, campos) => {
    const antes = Object.keys(estado.archivos).length;
    const r = await enviar("POST", campos as Record<string, string | File>);
    expect(r.status).toBe(400);
    expect(insertSucursal()).toBeUndefined();
    expect(Object.keys(estado.archivos)).toHaveLength(antes); // ni un archivo huérfano
  });

  it("acepta una URL de imagen https://", async () => {
    const r = await enviar("POST", { ownershipProof: archivo(PDF, "c.pdf", "application/pdf"), imageUrl: "https://cdn.test/salon.jpg" });
    expect(r.status).toBe(201);
    expect(insertSucursal()!.values).toContain("https://cdn.test/salon.jpg");
  });

  it("al editar sin archivo nuevo conserva el comprobante; con uno nuevo borra el anterior", async () => {
    estado.sucursal = { image_url: null, ownership_proof_url: `/api/files/${COMPROBANTE}` };
    expect((await enviar("PUT", { id: "suc1" })).status).toBe(200);
    expect(estado.archivos[COMPROBANTE]).toBeDefined();

    const r = await enviar("PUT", { id: "suc1", ownershipProof: archivo(PNG, "c.png", "image/png") });
    expect(r.status).toBe(200);
    expect(estado.archivos[COMPROBANTE]).toBeUndefined();
  });
});

describe("guardia", () => {
  const RAIZ = path.resolve(import.meta.dirname, "..");
  const fuentes = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = path.join(dir, n);
      if (statSync(p).isDirectory()) return fuentes(p);
      return /\.(ts|tsx|mjs)$/.test(n) ? [p] : [];
    });

  it("ningún código escribe archivos en public/", () => {
    const culpables = ["app", "lib", "components"].flatMap((d) => fuentes(path.join(RAIZ, d))).filter((f) => {
      const s = readFileSync(f, "utf8");
      return /writeFile|createWriteStream|mkdir\(/.test(s) && /["']public["']/.test(s);
    });
    expect(culpables).toEqual([]);
  });
});
