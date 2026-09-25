import { defineConfig } from "drizzle-kit";

const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

export default defineConfig({
  schema: "./src/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
