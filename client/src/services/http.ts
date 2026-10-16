export const SESSION_EXPIRED_EVENT = "crm:session-expired";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// All application requests use the same origin and the browser's HttpOnly cookie.
// Tokens never pass through JavaScript or browser storage.
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(path, { ...options, credentials: "include", cache: "no-store" });
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return response;
}
