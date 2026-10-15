import { DrizzleQueryError } from "drizzle-orm";

export const UNIQUE_VIOLATION = "23505";
export const EXCLUSION_VIOLATION = "23P01";

// True when a query failed because Postgres raised the given error code.
export function isPostgresError(error: unknown, code: string) {
  return error instanceof DrizzleQueryError && (error.cause as { code?: string } | undefined)?.code === code;
}
