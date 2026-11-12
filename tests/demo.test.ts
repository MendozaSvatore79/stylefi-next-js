/** El script de demostración solo acepta bases locales. */
import { describe, expect, it } from "vitest";

import { esBaseLocal } from "@/scripts/demo.mjs";

describe("esBaseLocal", () => {
  it("acepta localhost, 127.0.0.1 y ::1", () => {
    expect(esBaseLocal("postgres://u:p@localhost:54329/db")).toBe(true);
    expect(esBaseLocal("postgres://u:p@127.0.0.1:54329/db")).toBe(true);
    expect(esBaseLocal("postgres://u:p@[::1]:54329/db")).toBe(true);
  });

  it("rechaza RDS, Neon y hosts que solo se parecen", () => {
    expect(esBaseLocal("postgres://u:p@stylefi.abc.us-east-1.rds.amazonaws.com:5432/db")).toBe(false);
    expect(esBaseLocal("postgres://u:p@ep-x.us-east-2.aws.neon.tech/db")).toBe(false);
    expect(esBaseLocal("postgres://u:p@localhost.evil.com/db")).toBe(false);
  });
});
