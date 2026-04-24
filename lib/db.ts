import { neon } from "@neondatabase/serverless";

import { requireEnv } from "@/lib/env";

let dbClient: ReturnType<typeof neon> | null = null;

export function getDb() {
  if (!dbClient) {
    dbClient = neon(requireEnv("DATABASE_URL"));
  }

  return dbClient;
}
