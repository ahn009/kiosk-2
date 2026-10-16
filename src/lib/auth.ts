// Backwards-compatibility shim. All session logic lives in
// `@/lib/auth-runtime` (durable, database-backed). Prefer importing from
// there directly.
export * from "./auth-runtime";
