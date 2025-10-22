/**
 * Drizzle Kit configuration
 * Used for generating migrations and introspection
 */

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_PATH || "./data/cas.db",
  },
} satisfies Config;
