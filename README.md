# TokTickIT

TokTickIT is an IT service desk application with a React + TypeScript frontend and an Express + TypeScript backend. The backend uses Prisma and PostgreSQL for requester-specific tickets, categories, related systems, and attachment metadata.

## Requirements

- Node.js 20 or newer
- npm
- Docker Desktop for local PostgreSQL

## Project structure

```text
client/   React + TypeScript + Vite frontend
server/   Express + TypeScript + Prisma backend
docs/     Lab documentation and evidence
```

## Setup

Install dependencies:

```bash
cd server
npm install

cd ../client
npm install
```

Start PostgreSQL with Docker. Create the container once:

```bash
docker run --name toktickit-postgres \
  -e POSTGRES_USER=toktickit \
  -e POSTGRES_PASSWORD=toktickit \
  -e POSTGRES_DB=toktickit \
  -p 5432:5432 \
  -d postgres:16
```

If the container already exists, start it with:

```bash
docker start toktickit-postgres
```

Create the environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The default `DATABASE_URL` connects to the Docker database above. Keep `server/.env` private; it is ignored by Git.

Initialize Prisma, apply the Lab 2, Lab 3 and Lab 4 migrations, and seed reference data, demo users and
the Lab 4 fixtures. To sign in as a seeded user, supply a private initial password **on the first seed**:
the seed gives the password only to an account that does not exist yet or is still on the migration
placeholder password, and never resets a password that has been set. Use a local
password of at least 12 characters and do not commit it:

```bash
cd server
npx prisma generate
npx prisma migrate deploy
LAB3_SEED_INITIAL_PASSWORD="<YOUR_LOCAL_PASSWORD>" npm run prisma:seed
```

If you already seeded without a password, run the command above again: the Lab 2/3 users and the two
Lab 4 fixture users still on the migration placeholder password receive it, and accounts whose password
was already set are left alone.

The local demo accounts are `ari.suksan@example.com` (Requester),
`nattakit.support@example.com` (IT Staff), and `lab.admin@example.com` (Administrator). They use the
initial password supplied to the seed and must change it at first sign-in. Do not use these demo
accounts or passwords in a deployed environment.

The seed is safe to run more than once. It creates four active categories, one inactive category
fixture, six active related systems, one inactive related-system fixture, four active requesters
(plus the Lab 4 fixture Requester `malee.newcomer@example.com`, so five), and one inactive requester
fixture. The active categories are:

- Account and Access
- Hardware
- Software
- Network

The inactive fixtures are used to test that inactive database records cannot be selected for new
tickets.

## Lab 4 data migration and recovery

`npx prisma migrate deploy` (in `server/`) applies `20261030140000_lab4_actions_status_history`. It is additive only: new tables for Actions Taken, their revisions and Ticket status events, one nullable `Ticket.lastResolvedAt`, indexes, checks and triggers. No existing row, id, hash or sequence changes, and legacy Tickets get no invented Actions or status history.

Before migrating a database that holds real data, take a backup and keep it with the `server/uploads` files:

```bash
docker exec toktickit-postgres pg_dump -U toktickit -Fc toktickit > toktickit-backup.dump
```

If a deploy fails, the transactional DDL rolls back; fix the migration and redeploy. After new Lab 4 data exists, repair forward rather than dropping tables. Rehearse a restore on a disposable database (`createdb drill`, then `pg_restore -d drill`), never on the live one.

Seed: `npm run prisma:seed` also adds the Lab 4 fixtures (create-if-missing, safe to rerun). Application code that writes an Action must insert its revision in the same transaction; call `SET CONSTRAINTS "ActionTaken_revision_check" IMMEDIATE` before returning, because Prisma 5 does not surface an error raised by the final COMMIT.

Lab 4 also seeds `malee.newcomer@example.com` (a Requester with no Tickets) and
`kittipong.fresh@example.com` (IT Staff with no assignments) to show zero Dashboards. With
`LAB3_SEED_INITIAL_PASSWORD` set, the Lab 4 accounts and the other seeded Requesters and Staff
(for example `suda.servicedesk@example.com`) use that same private initial password.

## Run the application

Start the backend in one terminal:

```bash
cd server
npm run dev
```

The API runs at `http://localhost:3000`.

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Vite normally serves the frontend at `http://localhost:5173`.

The main requester workflow is:

1. Sign in with an active TokTickIT account. If the account requires a password change, complete
   that step before continuing.
2. Create a ticket with a category, related system, summary, description, priority, and optional
   attachment. The requester is taken from the authenticated session.
3. Open My Tickets to search, filter, sort, paginate, and view only the signed-in requester's
   tickets. There is no requester selector or client-side identity storage.
4. Open Ticket Detail to view read-only ticket data and attachment metadata.

IT Staff can use Ticket Queue to work with ticket ownership, IT Priority, status, comments, internal
notes, and attachment metadata. Administrators can use User Management to search, create, edit,
activate/deactivate accounts, and set initial passwords.

Lab 4 demo walkthrough (sign in after seeding):

1. Sign in as a Requester such as `ari.suksan@example.com`. Dashboard is the first page: Open
   Tickets, Waiting for You and Recently Resolved counts each open the matching My Tickets list.
   Ticket Detail shows read-only Actions Taken and Ticket Status History.
2. Sign in as IT Staff (`nattakit.support@example.com`). The Staff Dashboard shows Unassigned
   Tickets, My Tickets, My Pending Actions, status and IT Priority breakdowns; each opens the
   filtered Ticket Queue or the My Pending Actions list.
3. In a Ticket, open Actions Taken to add, edit, reassign, start, complete or cancel an Action and
   view its revision history. Resolve stays disabled until at least one Action is completed, none
   is pending and no follow-up is unsettled; the readiness summary explains why.
4. Sign in as the Administrator (`lab.admin@example.com`) to see the same Staff Dashboard for
   the Administrator's own assignments, plus User Management.
5. Sign in as `malee.newcomer@example.com` or `kittipong.fresh@example.com` to see zero counts and
   empty-state messages.

Attachments accept JPG/JPEG, PNG, WEBP, and PDF files up to 5 MB each, with no more than five
active files per ticket. Files are stored locally under `server/uploads/`, which is ignored by
Git. Removing an attachment keeps its metadata but prevents further download.

## Tests and builds

Run the complete automated suites and builds:

```bash
cd server
npm test -- --reporter=dot
npm run build

cd ../client
npm test -- --reporter=dot
npm run build

cd ..
npm run test:e2e
```

Vitest and Supertest cover server APIs; Playwright covers authenticated role workflows and
responsive layouts.

The Lab 4 Dashboard performance smoke (PERF-01, 10,000 Tickets and 30,000 Actions, about
30 seconds) is skipped by `npm test`. Run it on its own; it creates and drops its own database
and writes query plans next to [`perf-01.md`](artifacts/lab-04/performance/perf-01.md):

```bash
cd server
npm run test:perf
```

The database user in `DATABASE_URL` needs the `CREATEDB` privilege (the `toktickit` owner from the
Docker setup above has it, as the Postgres superuser). Each run makes a `toktickit_perf_<pid>_<time>`
database and drops it at the end; a run that is killed first leaves its database behind. To list
and remove leftovers:

```bash
docker exec toktickit-postgres psql -U toktickit -d toktickit -Atc "SELECT datname FROM pg_database WHERE datname LIKE 'toktickit_perf_%'"
docker exec toktickit-postgres psql -U toktickit -d toktickit -c 'DROP DATABASE "toktickit_perf_<pid>_<time>" WITH (FORCE)'
```

To watch the browser during E2E tests:

```bash
npm install
npm run test:e2e
npm run test:e2e:headed
```

Lab 2, Lab 3 and Lab 4 specifications and evidence are in [`docs/lab-02/`](docs/lab-02/),
[`docs/lab-03/`](docs/lab-03/) and [`docs/lab-04/`](docs/lab-04/), including API/UI contracts, test traceability, peer-review records,
and AI-use reflections.
