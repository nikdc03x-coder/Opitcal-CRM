
/**
 * Optical CRM — Admin Authentication API
 *
 * nik - Keep login, logout and session checks in one place.
 * The browser sends HTTP-only cookies automatically.
 */

// nik - Use the Vite proxy in development.
// Production should serve or proxy /api on the same origin.
const API_URL = "";

export type Admin = {
  id?: number;
  username: string;
};

type AuthResponse = {
  success: boolean;
  admin?: Admin;
  message?: string;
};

// nik - Handle API errors even if the backend returns
// an empty body or a response that is not JSON.
async function authRequest(
  path: string,
  options: RequestInit = {}
): Promise<AuthResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/auth${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to the CRM server. Please try again."
    );
  }

  // nik - Read the body as text before attempting JSON parsing.
  const raw = await response.text();

  let data: AuthResponse | null = null;

  if (raw) {
    try {
      data = JSON.parse(raw) as AuthResponse;
    } catch {
      // nik - Some proxy errors return HTML instead of JSON.
      data = null;
    }
  }

  // nik - Preserve the existing login-redirect behavior.
  if (response.status === 401) {
    throw new Error(data?.message || "Not logged in.");
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `CRM request failed (HTTP ${response.status}).`
    );
  }

  if (!data) {
    throw new Error(
      "The CRM server returned an invalid response."
    );
  }

  return data;
}

// nik - Verify credentials and start a session.
export function loginAdmin(
  username: string,
  password: string
) {
  return authRequest("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// nik - Check whether the current browser is logged in.
export async function getCurrentAdmin(): Promise<Admin | null> {
  const response = await authRequest("/me");
  return response.admin ?? null;
}

// nik - Revoke the session and clear the login cookie.
export function logoutAdmin() {
  return authRequest("/logout", {
    method: "POST",
  });
}
