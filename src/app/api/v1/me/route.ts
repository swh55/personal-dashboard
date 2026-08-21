// =============================================================================
// GET /api/v1/me — convenience alias for GET /api/v1/auth/me
// =============================================================================
// Some native client conventions prefer /me over /auth/me. This route simply
// re-exports the auth/me handler.

export { GET } from "@/app/api/v1/auth/me/route";
