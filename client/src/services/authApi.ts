import type { Admin } from "../models/auth";

import { ApiError, apiFetch } from "./http";

/**
 * Optical CRM — Admin Authentication API
 *
 * Keep login, logout and session checks in one place.
 * The browser sends HTTP-only cookies automatically.
 */

// Use the Vite proxy in development.
// Production should serve or proxy /api on the same origin.
const API_URL = "";

type AuthResponse = {
  success: boolean;
  admin?: Admin;
  message?: string;
};

// Handle API errors even if the backend returns
// an empty body or a response that is not JSON.
async function authRequest(path: string, options: RequestInit = {}): Promise<AuthResponse> {
  let response: Response;

  try {
    response = await apiFetch(`${API_URL}/api/auth${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot connect to the CRM server. Please try again.");
  }

  // Read the body as text before attempting JSON parsing.
  const raw = await response.text();

  let data: AuthResponse | null = null;

  if (raw) {
    try {
      data = JSON.parse(raw) as AuthResponse;
    } catch {
      // Some proxy errors return HTML instead of JSON.
      data = null;
    }
  }

  // Preserve the existing login-redirect behavior.
  if (response.status === 401) {
    throw new ApiError(data?.message || "Not logged in.", 401);
  }

  if (!response.ok) {
    throw new Error(data?.message || `CRM request failed (HTTP ${response.status}).`);
  }

  if (!data?.success) {
    throw new Error("The CRM server returned an invalid response.");
  }

  return data;
}

// Verify credentials and start a session.
export function loginAdmin(username: string, password: string) {
  return authRequest("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// Share only an in-flight check (including React StrictMode's duplicate mount).
// No session or CRM data is persisted in localStorage or a file cache.
let sessionRequest: Promise<Admin | null> | null = null;
export function getCurrentAdmin(): Promise<Admin | null> {
  if (sessionRequest) return sessionRequest;
  sessionRequest = authRequest("/me")
    .then((response) => response.admin ?? null)
    .catch((error) => {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    })
    .finally(() => {
      sessionRequest = null;
    });
  return sessionRequest;
}

// Revoke the session and clear the login cookie.
export function logoutAdmin() {
  return authRequest("/logout", {
    method: "POST",
  });
}
