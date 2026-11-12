/** GET /health: 200 si la base contesta, 503 si falla o tarda más de 2 s. */
import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SQL } from "../src/db/db.module.js";
import { HealthController } from "../src/health/health.controller.js";

let app: INestApplication | undefined;

async function levantar(sql: unknown) {
  const modulo = await Test.createTestingModule({ controllers: [HealthController], providers: [{ provide: SQL, useValue: sql }] }).compile();
  app = modulo.createNestApplication({ logger: false });
  await app.listen(0);
  return `${await app.getUrl()}/health`.replace("[::1]", "localhost");
}

afterEach(async () => {
  vi.useRealTimers();
  await app?.close();
  app = undefined;
});

describe("GET /health", () => {
  it("200 cuando la base contesta", async () => {
    const sql = vi.fn(async () => [{ "?column?": 1 }]);
    const res = await fetch(await levantar(sql));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ estado: "ok", base: "ok" });
    expect(sql).toHaveBeenCalledOnce();
  });

  it("503 cuando la base falla", async () => {
    const res = await fetch(await levantar(vi.fn(async () => { throw new Error("ECONNREFUSED"); })));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ estado: "error", base: "sin conexión" });
  });

  it("503 cuando la base no contesta en 2 s", async () => {
    const url = await levantar(vi.fn(() => new Promise(() => {})));
    const inicio = Date.now();
    const res = await fetch(url);
    expect(res.status).toBe(503);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(1900);
  });
});
