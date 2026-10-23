// Keep redirects inside the CRM and avoid returning to an authentication page.
export function loginDestination(from: unknown): string {
  if (
    typeof from !== "string" ||
    !from.startsWith("/") ||
    from.startsWith("//") ||
    from.includes("\\") ||
    Array.from(from).some((character) => character.charCodeAt(0) < 32)
  )
    return "/dashboard";
  const url = new URL(from, "https://crm.invalid");
  if (
    url.origin !== "https://crm.invalid" ||
    ["/login", "/forgot-password", "/reset-password"].includes(url.pathname.replace(/\/+$/, ""))
  )
    return "/dashboard";
  return `${url.pathname}${url.search}${url.hash}`;
}
