import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbName = process.env.DB_DATABASE || "database";
const user = process.env.DB_USERNAME || "root";
const password = process.env.DB_PASSWORD || "";
const dbPort = Number(process.env.DB_PORT) || 3306;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: dbHost,
    port: dbPort,
    user: user,
    password: password,
    database: dbName,
  },
  verbose: true,
});
