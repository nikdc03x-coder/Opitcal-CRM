// Database/driver errors can include connection URLs, query parameters or tokens.
// Log a stable operation and error code instead of dumping the error object.
export function logError(operation: string, error: unknown): void {
  const candidate =
    typeof error === "object" && error !== null
      ? ((error as any).code ??
        (error as any).errorCode ??
        (typeof (error as any).cause === "object" && (error as any).cause !== null
          ? (error as any).cause.code
          : undefined))
      : undefined;
  const code =
    typeof candidate === "string" && /^[A-Z0-9_]{1,40}$/.test(candidate) ? candidate : "UNEXPECTED";
  console.error(operation, { code });
}
