# Work Permit Hub

Build a full-stack Permit to Work (PTW) management web application for a CMMS internship assignment.

Use React + TypeScript + Tailwind CSS with Supabase/PostgreSQL.

Create the foundation only:

- Professional operations/industrial UI

- Dashboard and permit list

- Real PostgreSQL/Supabase database

- Shared Permit entity/model, NOT four separate permit models

- Roles: Requester, Area Owner, Safety Officer, Admin

- Permit types: Hot Work, Confined Space Entry, Working at Height, Electrical/Isolation (LOTO)

- Common permit fields: requester, contractor/team, work description, plant, area, equipment, planned start/end, hazards, PPE, precautions, approvals, status

- Type-specific fields should be flexible so a fifth permit type can be added later without rewriting the Permit model

- Permit statuses: DRAFT, PENDING_APPROVAL, APPROVED, ACTIVE, SUSPENDED, REJECTED, EXPIRED, CLOSED, CLOSED_VERIFIED, CANCELLED

- Create the database schema and relationships properly.

Important: do not build optional features yet. Do not use mock-only data or local/in-memory storage. Use the real database.

This project was built with [Lovable](https://lovable.dev).

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
