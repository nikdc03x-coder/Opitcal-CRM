# Accounts and password recovery

The existing Prisma `Admin` model and cookie authentication are extended rather than replaced. The account migration preserves IDs, passwords and sessions, removes the single-account constraint, and adds email, display name, role, activation status, hashed reset tokens and shared email rate limits. Existing accounts retain the ADMIN role.

## Setup

1. Apply migrations with `npm --prefix server run db:migrate`.
2. Configure an email sender in the server environment using either Gmail SMTP or Resend (see below). Keep secrets out of source control. `CLIENT_URL` supplies the trusted origin in reset links; production requires HTTPS.
3. Sign in with the existing administrator credentials, open Settings → My Account, and add the administrator's name and email using the current password. Existing accounts have no email until it is supplied; recovery cannot deliver to them before this step.

Administrators create users in Settings → User Management. Active users receive a setup link and choose their own password. Inactive users cannot sign in; activate them and send a reset link when access is needed. The administrator never handles a user's plaintext password. Password setup/reset email requests return a generic acknowledgment; delivery failures are logged without recipient addresses or secrets. If delivery fails, check provider configuration and request another link.

### Gmail email delivery

The email saved in My Account is the **recipient** of recovery messages. It does not authorize the backend to send email. To send through Gmail, enable Google 2-Step Verification and create an [App Password](https://support.google.com/accounts/answer/185833). Save the following in the gitignored `server/.env` locally:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-google-app-password
```

Use the App Password, not the normal Google password. Never paste credentials into chat or commit them. `EMAIL_FROM` defaults to `SMTP_USER`. Restart the backend after saving `.env`, run `npm --prefix server run email:check -- --verify` to verify SMTP authentication without sending mail, then request a reset link. Google may restrict App Password availability for some accounts; see its linked instructions.

Alternatively, retain `RESEND_API_KEY` and a verified `EMAIL_FROM` for [Resend delivery](https://resend.com/docs/api-reference/emails/send-email). A complete Resend configuration takes precedence over SMTP. The SMTP implementation requires TLS, verifies certificates, disables debug logging, and uses the same hashed, expiring reset-token flow.

### Connection troubleshooting

From the repository root, run `npm run dev` to start both the frontend on 5173 and the API on 5000. Starting only Vite does not start the backend. Open `http://localhost:5173/api/health` to verify the proxy reaches Express. Vite uses a strict port so it cannot silently move to a different origin from `CLIENT_URL`.

Recovery requests use the same `/api` proxy as login, include cookies, and have a finite timeout. Network failures and non-JSON proxy errors show an actionable retry message; structured API errors remain visible. A response saying email is unavailable means the API was reached but sender credentials are missing. It is separate from a browser “Failed to fetch” network failure. Run `npm --prefix server run email:check -- --verify` to check the sender configuration without sending mail.

### Settings transaction timeouts

The Settings “unexpected server error” was traced to Prisma `P2028`. A profile save reproduced the failure with a 5.5-second delay inside the transaction. Account transactions now explicitly allow up to 10 seconds to acquire a connection and 20 seconds to execute, while retaining serializable isolation and atomic session/reset-token invalidation. Remaining transaction API failures return a safe, retryable 503 rather than a generic 500. No schema change or migration is required.

The isolated-branch verification supports `--slow-profile` to repeat this delayed profile-save test. The configured-database verification also saves and reloads profile details through the actual Settings API using its own temporary account. Browser checks cover incorrect passwords, retrying after a transaction failure, successful saving, clearing the password input, and reloading the saved details.

## Access and security

- ADMIN can manage users. USER can use the existing daily CRM workflows and manage their own account. All Settings endpoints consult PostgreSQL on every request; signed read proofs are never accepted for Settings.
- Password changes require the current password and matching 12–1024-character new passwords. Existing scrypt hashing is retained.
- Reset links contain 32 random bytes, expire after 30 minutes, and store only a SHA-256 digest in PostgreSQL. The secret travels in the URL fragment, is removed from browser history on page load, and is submitted in POST bodies. Verification does not consume the token; successful password replacement consumes it atomically. Concurrent reuse cannot change the password twice.
- Password changes/resets revoke every account session and outstanding reset token in the same transaction. Changes to email, username, role or status through user management also revoke both. Profile email changes require the current password and invalidate reset links.
- Public recovery gives identical responses for known, unknown and inactive email addresses. It allows three email requests per address per 15-minute bucket across workers, plus an IP limit of ten requests per 15 minutes per endpoint per API process. Settings password/profile/admin mutations are also rate limited per process. Use ingress rate limits for a multi-instance deployment.
- Existing business APIs retain their original signed read proof behavior: revoked sessions can read those APIs for up to 30 seconds after their most recent proof. Writes and all Settings requests revalidate sessions immediately.
- Account updates lock rows and use serializable transactions. The last active administrator cannot be demoted or deactivated, including during concurrent changes. Conflicting transactions return a retryable 409.
- No user listing or account response returns password or token hashes. Recovery email configuration errors are global and do not reveal account membership.

## Verification

- `npm --prefix server run typecheck`
- `npm --prefix client run lint`
- `npm run build`
- `npm --prefix server run test:build`
- `npm --prefix server run db:validate`
- From `server`: `npx tsx --test tests/account.test.ts tests/auth.test.ts tests/authClient.test.ts`
- `node scripts/check-settings.mjs` checks the built UI using synthetic API responses and headless Edge, with screenshots under ignored `artifacts/settings`.
- `server/scripts/database/verifyAccounts.ts` is restricted to the explicitly named isolated Neon test endpoint. It deploys Prisma migrations there, tests real HTTP account flows and database persistence, stubs only outbound email, and cleans up its synthetic accounts. It never changes the configured database host in `.env`.

Live inbox delivery requires the configured sender/API key and is a separate operational check. No credential or reset token is printed by the verification script.

## Current rollout status

After explicit authorization to fix the database migration error, `20261023090000_account_management` was deployed successfully with the existing Prisma migration workflow. Before deployment, the configured database lacked `admins.email`, `admins.name`, `admins.role`, `admins.isActive`, `PasswordResetToken`, and `AccountRateLimit`; Prisma account reads reproduced `P2022`. After deployment, Prisma reads and live HTTP account/session operations passed.

The database history also includes three older migrations absent from this checkout (`20261017060000_customer_workflows`, `20261019090000_product_inventory`, and `20261019150000_add_crm_soft_delete`). That historical difference was preserved; no migration records were edited, no database reset was performed, and no existing records were removed. These history warnings are separate from the now-resolved missing account schema.

Before and after deployment, counts were unchanged: 89 customers, 95 purchases, 20 prescriptions, 3 frames, 4 lenses, 0 orders, and 1 original account. Live verification created and cleaned up only its own synthetic account, session, reset token and rate-limit row. No existing account details or password hashes were changed.

The existing `RequireAdmin` component now also handles guest-only `/login`. Both modes wait for a backend session check. Guests retain their intended private pathname, query and fragment; authenticated visitors to `/` or `/login` reach `/dashboard`. Distinct React keys prevent the guest guard's state from being reused for private routes after login. Logout and session-expiry handling continue to use the existing cookie API and shared 401 event. Session-check failures display a retry action instead of redirecting as if the user were unauthenticated.
