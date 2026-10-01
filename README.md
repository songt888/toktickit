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

Initialize Prisma, apply the Lab 2/Lab 3 migrations, and seed reference data and Lab 3 demo users:

```bash
cd server
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

To sign in as a seeded Lab 3 user, supply a private initial password when seeding. Replace the
sample value with a local password that meets the 12-character minimum; do not commit it:

```bash
LAB3_SEED_INITIAL_PASSWORD="<YOUR_LOCAL_PASSWORD>" npm run prisma:seed
```

The local demo accounts are `ari.suksan@example.com` (Requester),
`nattakit.support@example.com` (IT Staff), and `lab.admin@example.com` (Administrator). They use the
initial password supplied to the seed and must change it at first sign-in. Do not use these demo
accounts or passwords in a deployed environment.

The seed is safe to run more than once. It creates four active categories, one inactive category
fixture, six active related systems, one inactive related-system fixture, four active requesters,
and one inactive requester fixture. The active categories are:

- Account and Access
- Hardware
- Software
- Network

The inactive fixtures are used to test that inactive database records cannot be selected for new
tickets.

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
responsive layouts. To watch the browser during E2E tests:

```bash
npm install
npm run test:e2e
npm run test:e2e:headed
```

Lab 2 and Lab 3 specifications and evidence are in [`docs/lab-02/`](docs/lab-02/) and
[`docs/lab-03/`](docs/lab-03/), including API/UI contracts, test traceability, peer-review records,
and AI-use reflections.
