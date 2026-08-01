import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to access PostgreSQL");
  }

  const client = neon(databaseUrl);
  return drizzle({ client, schema });
}

let database: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  if (!database) {
    database = createDatabase();
  }

  return database;
}

export type Database = ReturnType<typeof getDb>;
