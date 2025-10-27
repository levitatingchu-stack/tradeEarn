export function safeGetEnv(key: string): string | undefined {
  if (typeof Deno === "undefined" || typeof Deno.env === "undefined") {
    return undefined;
  }
  try {
    return Deno.env.get(key);
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      return undefined;
    }
    throw error;
  }
}
