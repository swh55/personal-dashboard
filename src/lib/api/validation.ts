// =============================================================================
// v1 API — request body validation with zod
// =============================================================================
// Every v1 mutation endpoint validates its body through a zod schema with
// `.strict()` so unknown fields are rejected — this is the primary defence
// against mass-assignment (e.g. a client sending `userId` in the body).

import { NextRequest } from "next/server";
import { z, ZodError, ZodSchema } from "zod";
import { apiValidationError } from "./response";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

/**
 * Parse and validate a JSON request body against a zod schema.
 * Returns `{ ok, data }` on success or `{ ok, response }` with a 422
 * NextResponse on failure — callers can return the response directly.
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: apiValidationError("Request body must be valid JSON"),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: apiValidationError(
        "Request body failed validation",
        formatZodError(result.error)
      ),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Format a zod error into a compact `{ field: message }` object for the
 * `details` field of the error response.
 */
function formatZodError(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_root";
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reusable primitive schemas
// ---------------------------------------------------------------------------
export const schemas = {
  cuid: z.string().min(1).max(100),
  nonEmptyString: z.string().min(1).max(10000),
  optionalString: z.string().max(10000).optional().nullable(),
  float: z.number().finite(),
  positiveFloat: z.number().finite().positive(),
  nonNegativeFloat: z.number().finite().min(0),
  int: z.number().int(),
  positiveInt: z.number().int().positive(),
  nonNegativeInt: z.number().int().min(0),
  isoDate: z.string().datetime({ offset: true }).or(z.string().datetime()),
  optionalIsoDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().datetime())
    .optional()
    .nullable(),
  version: z.number().int().min(1).optional(),
};

// Strict wrapper — rejects unknown keys. Use this on every create/update schema.
export function strict<T>(schema: z.ZodType<T>) {
  return z.object(schema._def.shape ?? {}).strict() as unknown as z.ZodSchema<T>;
}
