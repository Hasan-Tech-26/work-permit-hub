# Work Permit Hub

Tallyard PTW Control is a Permit to Work module for industrial CMMS operations. It provides a shared permit register, approval chain, controlled lifecycle, work logging, and an auditable closure workflow over the existing Supabase PostgreSQL database. The dashboard and register read seeded and user-created records; no mock or in-memory data is used.

## Stack and setup

- React 19, TypeScript, TanStack Start/Router/Query, Tailwind CSS
- Supabase Auth and PostgreSQL with migrations under `supabase/migrations`
- Node.js and npm

```sh
npm install
npm run dev
```

`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are supplied by Lovable Cloud. Run `npm run build` for the production compile and `npm run lint` for static checks.

## PTW model

There is one `permits` table and one shared `PermitRow` shape. Permit types are data in `permit_types`; each type stores its dynamic field definitions in `field_schema`, while a permit stores values in `type_data`. Adding a fifth permit type therefore requires an insert into `permit_types`, not a schema or TypeScript model fork.

The seeded types are Hot Work, Confined Space Entry, Working at Height, and Electrical / Isolation (LOTO). Plants and areas are database records, including Riverbend 04 (`RB04`) and Northgate Heat 02 (`NH02`), and the create form loads them as selectors.

## Lifecycle and permissions

The supported lifecycle is `DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> CLOSED -> CLOSED_VERIFIED`. Rejection, suspension/resume, cancellation, and expiry are controlled alternatives. Server functions validate every transition and the workflow migration adds a PostgreSQL trigger that rejects illegal direct status changes.

Requesters create and submit their own permits, close their active work, and cannot approve themselves. Area Owners approve permits in their assigned area. Safety Officers approve, reject, suspend/resume, and verify closure. Admins have full operational access. Mutations derive the actor from the Supabase bearer token and never trust a requester or role supplied by the browser.

## Architecture

Protected mutations live in `src/lib/ptw.functions.ts` and use `requireSupabaseAuth`. Approval rows are created on submission and each decision records the approver, comment, and timestamp. `permit_status_history` records lifecycle movements. The workflow migration adds append-only `permit_audit_log` and `permit_work_logs`; work logs are rejected unless the permit is currently `ACTIVE`.

Expiry is evaluated before activation and resume, and expired windows cannot be reactivated. The existing seeded examples cover active, pending, approved, suspended, rejected, expired, draft, closed, verified, and cancelled states; the workflow migration completes the seeded approved permit's admin approval.

## Demo data and authentication

The migrations include named profiles and role assignments for a requester, two Area Owners, a Safety Officer, and an Admin. In a deployed environment, authenticated Supabase users must have a matching `profiles.user_id` (the server also supports a profile ID equal to the auth subject for local seeded demonstrations). The app does not expose UUID entry fields in the UI.

## AI usage, limitations, and next steps

AI assistance was used to inspect the existing repository, preserve its UI conventions, implement the server-side workflow, and validate the TypeScript build. Known limitations are that profile-to-auth account provisioning is environment-specific, role-aware button visibility is intentionally conservative because the UI does not yet have a dedicated current-user query, and there is no automated test runner configured in the foundation. Future improvements include an admin role-management screen, database RPC transactions for multi-write mutations, scheduled expiry processing, attachment/evidence storage, and integration tests against a disposable Supabase project.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3c58581c-1899-41c8-91d8-1d8ae70ab91d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
