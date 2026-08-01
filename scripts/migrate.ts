import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl === "[SENSITIVE]") {
  throw new Error("A usable DATABASE_URL is required to run migrations.");
}

const verifiedDatabaseUrl: string = databaseUrl;

async function runMigrations() {
  const client = postgres(verifiedDatabaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    await migrate(drizzle(client), {
      migrationsFolder: "./drizzle",
      migrationsSchema: "platform",
      migrationsTable: "__pikko_migrations",
    });
    console.log("Database migrations are up to date.");
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
