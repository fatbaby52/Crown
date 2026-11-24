# Crown client upload portal — admin and deployment runbook

Private file-request portal for Crown Consulting. Staff create a request for one
organization and one authorized recipient, copy the invite link, and send it
themselves. The client verifies with a one-time email code, uploads PDF/JPG/PNG
files straight to private storage, and Crown downloads them only after a
malware scan clears them.

Status (Nov 2026): **built and unit-tested; not yet deployed or configured.**
Client intake stays off (`PORTAL_MODE=staff_only`) until Crown approves the
sender, storage, scanner, retention policy and access tests listed at the end.

---

## 1. Pieces

| Piece | Where |
|---|---|
| Client upload page | `/upload/` (`upload/index.html`, `upload.js`, `portal.css`) |
| Staff console | `/portal/` (`portal/index.html`, `staff.js`) |
| Client API | `netlify/functions/portal.js` → `/api/portal/*` |
| Staff API | `netlify/functions/staff.js` → `/api/staff/*` |
| Scanner worker | `netlify/functions/portal-scan-background.js` (Netlify background function) |
| Daily housekeeping | `netlify/functions/portal-cleanup.js` (scheduled `@daily` in `netlify.toml`) |
| Shared helpers | `netlify/functions/lib/*` |
| Database + bucket | Supabase project **BidFuel** (`aaeudtfmjuuowvkexrfh`), tables `portal_*`, bucket `client-uploads` |
| Migrations | `supabase/migrations/0001_portal_schema.sql`, `0002_portal_templates.sql` (already applied to BidFuel) |
| Tests | `npm test` (Node built-in runner, no database needed) |

The portal shares the BidFuel Supabase project by decision of Crown (Nov 2026).
All portal tables have RLS enabled with **no policies**, and all grants to
`anon`/`authenticated` are revoked, so BidFuel's browser clients cannot read
them. The `client-uploads` bucket is private with no storage policies; only the
service key (server side) can read, list or sign anything.

## 2. How a request flows

1. Staff signs in at `/portal/` (Supabase Auth email + password, then TOTP).
   The API refuses any token whose `aal` claim is not `aal2`, and any user not
   in `portal_staff` with `is_active = true`.
2. Staff creates a **draft**: organization, purpose, recipient email,
   instructions, checklist (start from a template, edit freely), expiry days.
3. Staff clicks **Issue link**. The server generates a random token, stores
   only its SHA-256 hash, sets status `open`, and returns the link **once**.
   Staff copies it and sends it manually. Issuing again rotates the token and
   revokes any client sessions.
4. Client opens `/upload/?r=<token>`. The page immediately removes the token
   from the address bar and POSTs it to `lookup`, which answers only with a
   masked email hint. Nothing about the organization is shown yet.
5. Client requests a code. `send-code` rate-limits (per request, per IP, 60 s
   cooldown), stores a hashed 6-digit code with 10-minute expiry, and emails
   the address bound to the request. Arbitrary addresses are impossible.
6. Client enters the code. Five attempts per code; single use; replay fails.
   Success creates a 60-minute request-scoped session: `Secure; HttpOnly;
   SameSite=Strict` cookie scoped to `/api/portal`, plus a CSRF token the page
   keeps in `sessionStorage` and sends as `X-CSRF-Token`. Writes also require a
   same-origin `Origin` header.
7. For each file, `grant` validates extension/MIME/size/quota, reserves a
   `portal_files` row with a server-chosen key `requests/<request>/<file>.<ext>`,
   and returns a presigned upload token (Supabase `createSignedUploadUrl`,
   `upsert: false`, ~2 h). The browser uploads directly to Supabase with
   tus-js-client (resumable, 6 MB chunks) using the `x-signature` header; a
   plain PUT fallback uses the same token. No bytes pass through Netlify.
8. `finalize` re-checks the request is still open (late uploads after a close
   are deleted and refused), confirms the object exists, reads its real size
   and first/last 4 KB, verifies the file signature matches the extension,
   rejects archives and password-protected PDFs, re-checks the total quota
   with real bytes, marks the row `pending_scan`, and triggers the scanner.
   Duplicate finalize calls are idempotent.
9. The background scanner downloads the object server-side, runs the
   configured scanner, and sets `clean`, `infected` (object deleted) or
   `scan_failed`. Anything but `clean` cannot be downloaded.
10. When a batch finishes, the page calls `batch-done`; Crown receives one
    receipt email with the case reference and file counts only.
11. Staff downloads a clean file via a 60-second signed URL, can delete files,
    rescan failures, and close or revoke the request. Closing invalidates the
    link and sessions instantly and blocks new grants.

## 3. First-time setup

### 3.1 Supabase (BidFuel project)

Migrations `0001` and `0002` are already applied. If you ever need to
re-apply them (new project, restore), run them in order through the SQL editor
or the Supabase MCP `apply_migration`.

**Auth settings** (Dashboard → Authentication):
- Providers → Email: enabled, "Confirm email" on.
- Disable public sign-ups (Authentication → Sign In / Up → *Allow new users to
  sign up* = off) **unless BidFuel needs them**. If BidFuel needs sign-ups
  open, that is fine: an auth user alone gets nothing; they must also be in
  `portal_staff`.
- Multi-Factor → TOTP enabled.

**Create a staff user** (Dashboard → Authentication → Users → Add user, with a
strong temporary password; the user changes it after first sign-in), then
allow-list them:

```sql
insert into portal_staff (user_id, email, display_name)
select id, email, 'Alex' from auth.users where email = 'alex@crownconsultingteam.com';
```

To remove access: `update portal_staff set is_active = false where email = '...';`

**Keys** (Project Settings → API keys): copy the **service_role** (or a
secret key) for `SUPABASE_SERVICE_ROLE_KEY` (server only) and the
**publishable** key for `SUPABASE_PUBLISHABLE_KEY` (used by the staff console
in the browser; it is public by design).

### 3.2 Email sender (Resend)

1. Create a Resend account, add and verify `crownconsultingteam.com`
   (DKIM + return-path records in Squarespace DNS; the existing Google
   Workspace SPF record stays and gets `include:amazonses.com` added only if
   Resend's instructions say so).
2. Create an API key → `RESEND_API_KEY`.
3. `PORTAL_FROM_EMAIL="Crown Consulting <uploads@crownconsultingteam.com>"`.
4. `PORTAL_RECEIPT_EMAIL` = the Crown inbox that should get receipts.

For local development only, `EMAIL_PROVIDER=console` prints codes to the
function log. The code refuses that provider when `PORTAL_MODE=live`.

### 3.3 Malware scanner

The portal never sends files to a public scanning service. Options:

- **`clamav-rest`** (recommended): run a private ClamAV REST container
  (e.g. `benzino77/clamav-rest-api` or `ajilaag/clamav-rest`) on Railway, Fly
  or a small VM, behind HTTPS with a bearer token. Set `SCANNER_PROVIDER=clamav-rest`,
  `SCANNER_URL=https://…`, `SCANNER_TOKEN=…`. The adapter understands both
  images' JSON shapes (`lib/scanner.js`).
- **`none`** (default): every file ends `scan_failed` and stays locked. Safe
  but useless for real intake.
- **`staging-stub`**: marks files clean without scanning. Honoured only when
  `PORTAL_ENV=staging`; refused everywhere else. Use it to exercise the
  download path in staging before the real scanner exists.

Netlify background functions can run 15 minutes and have ~1 GB memory; a
25 MB file is comfortably within that.

### 3.4 Netlify environment variables

Use `.env.example` as the checklist. Set them per deploy context in Netlify
UI (Site configuration → Environment variables), marking secrets as *secret*:

| Variable | Production | Staging (branch deploy / separate site) |
|---|---|---|
| `PORTAL_MODE` | `staff_only` until approved, then `live` | `live` |
| `PORTAL_ENV` | `production` | `staging` |
| `PORTAL_SITE_URL` | `https://crownconsultingteam.com` | the staging URL |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | BidFuel | BidFuel (same project; staging data is synthetic) |
| `PORTAL_IP_PEPPER`, `PORTAL_INTERNAL_SECRET` | `openssl rand -base64 32` each | different values |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `PORTAL_FROM_EMAIL`, `PORTAL_RECEIPT_EMAIL` | Resend | Resend (or `console`) |
| `SCANNER_PROVIDER`, `SCANNER_URL`, `SCANNER_TOKEN` | `clamav-rest` | `clamav-rest` or `staging-stub` |

Because staging and production share one Supabase project, use a dedicated
Netlify **branch deploy** (e.g. branch `portal-staging`) with its own env
values, and keep staging requests clearly named (e.g. "ZZ Test Co").
If Crown later wants hard isolation, create a second Supabase project and
point staging's three `SUPABASE_*` variables at it; nothing else changes.

### 3.5 Deploy

The repo has no build step. Netlify installs `package.json` dependencies
(`@supabase/supabase-js`) and bundles the functions with esbuild. The
scheduled cleanup and the `/api/*` redirects are declared in `netlify.toml`.
After the first deploy, confirm in Netlify → Functions that `portal`, `staff`,
`portal-scan-background` and `portal-cleanup` (scheduled) all appear.

## 4. Day-to-day operations

- **Create a request**: `/portal/` → New request → pick a template → edit the
  checklist → Save draft → Issue link → copy → send to the recipient yourself.
- **Review uploads**: open the request; files show `scanning`, `cleared`,
  `scan failed`, `blocked (malware)` or `rejected: <reason>`. Download appears
  only on cleared files and opens a 60-second link.
- **Close** when the packet is complete, or **revoke** on suspected misuse.
  Both stop the link and sessions immediately. Uploads already in flight may
  still reach storage until their grant expires (≤ 2 h); `finalize` refuses
  them and the nightly job deletes the orphaned objects.
- **Resend / new link**: Issue new link (rotates the token).
- **Kill switch**: set `PORTAL_MODE=off` (everything 503) or `staff_only`
  (staff can still review and download; client endpoints refuse) and
  redeploy or trigger a redeploy. Stored files never become public either way.
- **Audit**: the request detail shows the last 50 events; the full trail is in
  `portal_audit` (creation, issue, OTP sent/failed, verification, grant,
  receipt, rejection, scan verdicts, downloads, deletions, retention purges).
  No filenames, codes, tokens or email bodies are logged there.

## 5. Data retention and deletion

- `PORTAL_RETENTION_DAYS` (default 90) counts from the request's close/revoke/
  expiry. The nightly job deletes every object for such requests and then the
  `portal_requests` row (cascading to files, sessions, OTP rows). Audit rows
  stay, keyed by request id, with no file content or names.
- Orphaned reservations older than `PORTAL_ORPHAN_GRACE_HOURS` (24) are
  purged; rejected and infected objects are deleted immediately and swept
  nightly as a safety net.
- Staff deletion of a single file removes the object at once and marks the row
  `deleted`.
- Supabase daily backups retain deleted data for the plan's window (7 days on
  Pro); Point-in-Time Recovery, if enabled, follows its own window. Storage
  objects are not in database backups: once deleted they are gone.
- **Crown must set and approve the retention period before go-live.** Change
  it with the env var; no code change needed.

## 6. Acceptance test script (staging)

Create two synthetic requests with two different recipient addresses you
control (never a real client). Then verify:

1. Private browser + phone: the link alone shows only a masked email and a
   "Email me a code" button; the organization appears only after the code.
2. A forwarded link opened by someone without the inbox cannot proceed.
3. Wrong code → generic failure. Same code twice → failure. Wait 10 min →
   failure. Six wrong attempts → locked. Seven send requests in an hour → 429.
4. Upload a PDF, a JPG, a PNG; watch progress; kill Wi-Fi mid-upload and
   reconnect (tus resumes); retry a failed file individually.
5. Upload a 26 MB file → refused before upload. Rename `x.zip` to `x.pdf` →
   accepted for upload but rejected at confirmation with the archive message.
   Password-protected PDF → rejected with the password message. A PNG renamed
   `.jpg` → rejected as a mismatch.
6. Open the second request in another browser; confirm you cannot see the
   first request's files or finalize its file ids (404), and that direct URL
   access to `https://<project>.supabase.co/storage/v1/object/client-uploads/...`
   is denied without a signed URL.
7. Close the request from the staff console while an upload is in progress:
   the client sees "request closed" and the file is marked `rejected: late`.
8. Staff without MFA (fresh user, skipped TOTP): `/api/staff/*` returns
   `mfa_required`; the console forces enrolment. A user not in `portal_staff`
   sees "Not authorized".
9. With `SCANNER_PROVIDER=none`, files stay `scan failed` and Download never
   appears. Switch to the real scanner (or `staging-stub` in staging), rescan,
   download, then delete the file and confirm the object is gone.
10. Confirm the receipt email names only the reference and counts.

## 7. Remaining configuration and known risks

- **Not yet done**: Resend domain + keys, scanner deployment, Netlify env vars,
  staff users + MFA enrolment, staging branch deploy, running the acceptance
  script above, retention approval.
- **Shared Supabase project**: the portal lives in BidFuel by Crown's choice.
  Isolation relies on RLS-without-policies plus revoked grants; anyone with
  BidFuel's service key or dashboard access can read portal data. Treat
  BidFuel dashboard access as Crown-staff-only.
- **Staging shares the production database** unless a second project is
  created; keep staging data synthetic and clean it up.
- **Email deliverability**: codes depend on Resend reaching the recipient's
  spam filters; verify DKIM and warm the domain before real intake.
- **Encrypted-PDF detection** is a signature check (`/Encrypt` in the first or
  last 4 KB). It catches standard writers; the scanner stage is the backstop.
- **Presigned upload tokens** live ~2 hours and cannot be revoked individually
  once issued; closing a request only prevents finalization. Objects uploaded
  late are unreadable and deleted nightly.
- **Rate limits** are per request and per hashed IP in Postgres; a large
  distributed attacker could still trigger many emails up to the per-request
  cap (6/hour). Raise or lower with the `PORTAL_OTP_*` variables.
- **CDN scripts**: `tus-js-client` and `supabase-js` load from jsDelivr with
  CSP restricting script sources. For stricter supply-chain control, vendor
  the two files into the repo and drop the CDN entries from the CSP.
- **No automatic invites or reminders** in v1 by design; staff send links.

## 8. Go-live checklist (status 2026-11-24)

Done:
- [x] Migrations applied to BidFuel; bucket `client-uploads` private, 25 MB, PDF/JPG/PNG only.
- [x] `alex@crownconsultingteam.com` added to `portal_staff` (existing BidFuel auth user).
- [x] Netlify env (crownconsulting site): `PORTAL_MODE=staff_only`, `PORTAL_ENV`, `PORTAL_SITE_URL`,
      `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `PORTAL_BUCKET`, `EMAIL_PROVIDER=resend`,
      `SCANNER_PROVIDER=none`, `PORTAL_FROM_EMAIL`, `PORTAL_RECEIPT_EMAIL`,
      and secrets `PORTAL_IP_PEPPER`, `PORTAL_INTERNAL_SECRET` (production context).

To do, in order:
1. **Supabase dashboard (BidFuel)** → Authentication → Multi-Factor: enable TOTP.
   Authentication → Users: make sure the alex@ user has a password you know
   (Send password recovery if not).
2. **Netlify UI** → Site configuration → Environment variables: add
   `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Project Settings → API keys),
   scope *Functions*, mark **Secret**. Paste it there directly, never into chat
   or the repo. Then Deploys → Trigger deploy so functions pick it up.
   After this, `/portal/` sign-in + MFA enrolment works and you can create
   draft requests.
3. **Resend**: sign up, Domains → add `crownconsultingteam.com`, add the DKIM,
   SPF-include and return-path records Resend shows into Squarespace DNS
   (keep the existing Google Workspace MX and SPF entries; merge the SPF
   include into the one existing `v=spf1` TXT record). Create an API key
   (sending only) and add it in Netlify as `RESEND_API_KEY` (Secret).
   Send yourself a test from Resend's dashboard first.
4. **Scanner**: deploy `benzino77/clamav-rest-api` (or `ajilaag/clamav-rest`)
   as a Railway/Fly service with 2 GB RAM, HTTPS, and a bearer token env.
   Set `SCANNER_PROVIDER=clamav-rest`, `SCANNER_URL`, `SCANNER_TOKEN` (Secret)
   in Netlify and redeploy. Until then every upload stays locked as
   "scan failed", which is the intended fail-closed behaviour.
5. **Staging**: push a `portal-staging` branch; in Netlify set branch-deploy
   context overrides `PORTAL_MODE=live`, `PORTAL_ENV=staging`,
   `PORTAL_SITE_URL=https://portal-staging--crownconsulting.netlify.app`.
   Run section 6 there with two synthetic requests.
6. **Approve** sender, scanner, retention days (`PORTAL_RETENTION_DAYS`,
   default 90) and the access tests; then set production `PORTAL_MODE=live`
   and redeploy. Send the first real invite.
