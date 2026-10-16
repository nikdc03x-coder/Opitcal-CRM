export const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const READ_PROOF_AGE_MS = 30 * 1000;

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !/^[a-f0-9]{64,}$/i.test(secret)) {
    throw new Error("SESSION_SECRET must contain at least 32 random bytes encoded as hexadecimal.");
  }
  return secret;
}

export function clientOrigin(): string {
  const value = process.env.CLIENT_URL || "http://localhost:5173";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CLIENT_URL must be a valid origin.");
  }
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("CLIENT_URL must be an exact origin; production requires HTTPS.");
  }
  return value;
}
