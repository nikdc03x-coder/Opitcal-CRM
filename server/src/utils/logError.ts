// Database/driver errors can include connection URLs, query parameters or tokens.
// Log a stable operation and error code instead of dumping the error object.
export function logError(operation: string, error: unknown): void {
  const code =
    typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  console.error(operation, {
    code: typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "UNEXPECTED",
  });
}
