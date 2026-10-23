import { apiFetch } from "./http";

export type Account = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  createdAt: string;
};
export type UserInput = Pick<Account, "username" | "name" | "role" | "isActive"> & {
  email: string;
};
export async function accountRequest<T = { message: string }>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
      throw new Error("The CRM server took too long to respond. Please try again.", {
        cause: error,
      });
    }
    throw new Error(
      "Cannot connect to the CRM server. Make sure the backend is running, then try again.",
      { cause: error },
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success)
    throw new Error(
      data?.message ||
        (response.status >= 500
          ? "The CRM server is temporarily unavailable. Please try again."
          : "Unable to complete the request. Please try again."),
    );
  return data as T;
}
export const loadAccount = () => accountRequest<{ account: Account }>("/api/settings/me");
export const loadUsers = () => accountRequest<{ users: Account[] }>("/api/settings/users");
export const saveUser = (input: UserInput, id?: number) =>
  accountRequest(
    `/api/settings/users${id === undefined ? "" : `/${id}`}`,
    id === undefined ? "POST" : "PATCH",
    input,
  );
