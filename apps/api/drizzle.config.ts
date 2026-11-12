import { defineConfig } from "drizzle-kit";

// Esquema en TypeScript y migraciones versionadas en drizzle/. Las aplica `npm run db:migrar`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://stylefi:stylefi-local@127.0.0.1:54329/stylefi" },
});
